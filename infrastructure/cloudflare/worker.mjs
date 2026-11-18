/**
 * Martinello — ponte HTTPS opcional (Cloudflare Workers Free).
 * O Worker NÃO autentica o administrador, NÃO guarda tokens e NÃO lê a planilha.
 * Ele transporta a requisição ao Apps Script, onde o Firebase ID token e as
 * permissões são verificados. Criar a variável APPS_SCRIPT_URL no painel Worker.
 */
const ORIGEM_PERMITIDA = 'https://e-commerce-martinello.github.io';
const LIMITE_BYTES = 600000;

function responder(corpo, status = 200, origem = ORIGEM_PERMITIDA) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, private',
      'Access-Control-Allow-Origin': origem,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '3600',
      'Vary': 'Origin',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer'
    }
  });
}

export default {
  async fetch(request, env) {
    const origem = request.headers.get('Origin');
    // O site de teste é a única origem habilitada para ler respostas.
    if (origem !== ORIGEM_PERMITIDA) return new Response('Origem não autorizada', {status: 403});
    if (request.method === 'OPTIONS') return responder({ok:true});
    if (request.method !== 'POST') return responder({erro:'Método não permitido.'},405);
    const upstream = String(env.APPS_SCRIPT_URL || '').trim();
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(upstream))
      return responder({erro:'Defina APPS_SCRIPT_URL nas configurações do Worker.'}, 503);
    const length = Number(request.headers.get('Content-Length') || 0);
    if (length > LIMITE_BYTES) return responder({erro:'Solicitação muito grande.'}, 413);
    let dados;
    try {
      const texto = await request.text();
      if (texto.length > LIMITE_BYTES) return responder({erro:'Solicitação muito grande.'},413);
      dados = JSON.parse(texto);
    } catch (_) { return responder({erro:'JSON inválido.'},400); }
    if (typeof dados.action !== 'string' || !/^[A-Za-z]{2,40}$/.test(dados.action) ||
        typeof dados.firebaseIdToken !== 'string' || dados.firebaseIdToken.length > 6000 ||
        typeof dados.requestId !== 'string' || !/^req_[A-Za-z0-9_]+$/.test(dados.requestId))
      return responder({erro:'Campos inválidos.'},400);
    const form = new URLSearchParams({
      action: dados.action,
      firebaseIdToken: dados.firebaseIdToken,
      requestId: dados.requestId,
      parentOrigin: ORIGEM_PERMITIDA,
      transport: 'proxy',
      payload: JSON.stringify(dados.payload || {})
    });
    try {
      // O ContentService do Google redireciona para script.googleusercontent.com.
      const response = await fetch(upstream, {
        method:'POST', redirect:'follow',
        headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8'},
        body:form.toString()
      });
      if (!response.ok) return responder({erro:`Apps Script respondeu HTTP ${response.status}. Confira a implantação e a opção de acesso público.`},502);
      const json = await response.json();
      if (json.tipo !== 'MART_VENDEDORES_API' || json.requestId !== dados.requestId || typeof json.ok !== 'boolean')
        return responder({erro:'Resposta inesperada do Apps Script. Atualize Code.gs e a implantação.'},502);
      // Não armazenar dados privados em cache.
      return responder(json);
    } catch (_) {
      return responder({erro:'O gateway não recebeu JSON do Apps Script. Confira a implantação e os registros de execução.'},502);
    }
  }
};
