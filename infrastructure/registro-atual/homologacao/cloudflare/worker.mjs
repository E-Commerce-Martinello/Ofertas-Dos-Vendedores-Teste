/**
 * Martinello Ofertas — gateway HTTPS (mesmo codigo em dois Workers independentes).
 * Cloudflare Workers: substitua TODO o conteúdo do editor por este arquivo.
 *
 * Exige a variável APPS_SCRIPT_URL apontando para o /exec da API administrativa.
 * O Google Apps Script continua validando o Firebase ID token e a lista de admins.
 * Não registre em logs o corpo da requisição, o token ou os URLs de redirecionamento.
 */
const ORIGEM_PERMITIDA = 'https://e-commerce-martinello.github.io';
const LIMITE_BYTES = 600000;

function responder(corpo, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'private, no-store, max-age=0',
      'Access-Control-Allow-Origin': ORIGEM_PERMITIDA,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '3600',
      'Vary': 'Origin',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer'
    }
  });
}

const pausa = ms => new Promise(resolve => setTimeout(resolve, ms));

async function receberJsonGoogle(upstream, campos) {
  // Nunca repetir o POST: operações como importação/edição não são idempotentes.
  const inicio = await fetch(upstream, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
    body: campos.toString()
  });

  let resposta = inicio;
  if ([301, 302, 303].includes(inicio.status)) {
    const destino = inicio.headers.get('Location') || '';
    let url;
    try { url = new URL(destino); } catch (_) { throw new Error('REDIRECT_INVALIDO'); }
    if (url.protocol !== 'https:' || url.hostname !== 'script.googleusercontent.com') {
      throw new Error('REDIRECT_INVALIDO');
    }
    // O ContentService fornece o resultado por um URL de uso temporário.
    // Caso esse GET dê 404, repetir somente o GET do MESMO endereço.
    // Isso não executa novamente o doPost nem duplica alterações.
    for (const espera of [0, 500, 1400, 2800]) {
      if (espera) await pausa(espera);
      resposta = await fetch(url.href, { method: 'GET', redirect: 'manual' });
      if (resposta.status !== 404) break;
    }
  }

  if (!resposta.ok) {
    throw new Error('HTTP_APPS_SCRIPT_' + resposta.status);
  }
  try { return await resposta.json(); }
  catch (_) { throw new Error('RESPOSTA_NAO_JSON'); }
}

export default {
  async fetch(request, env) {
    // A origem é uma restrição adicional; a autenticação REAL acontece na API.
    if (request.headers.get('Origin') !== ORIGEM_PERMITIDA) {
      return new Response('Origem não autorizada.', { status: 403 });
    }
    if (request.method === 'OPTIONS') return responder({ ok: true });
    if (request.method !== 'POST') return responder({ erro: 'Método não permitido.' }, 405);

    const upstream = String(env.APPS_SCRIPT_URL || '').trim();
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(upstream)) {
      return responder({ erro: 'Configure a variável APPS_SCRIPT_URL com o /exec da API administrativa.' }, 503);
    }
    const length = Number(request.headers.get('Content-Length') || 0);
    if (length > LIMITE_BYTES) return responder({ erro: 'Solicitação muito grande.' }, 413);

    let dados;
    try {
      const texto = await request.text();
      if (texto.length > LIMITE_BYTES) return responder({ erro: 'Solicitação muito grande.' }, 413);
      dados = JSON.parse(texto);
    } catch (_) { return responder({ erro: 'JSON inválido.' }, 400); }

    if (!dados || typeof dados !== 'object' ||
        typeof dados.action !== 'string' || !/^[A-Za-z]{2,40}$/.test(dados.action) ||
        typeof dados.firebaseIdToken !== 'string' || dados.firebaseIdToken.length > 6000 ||
        typeof dados.requestId !== 'string' || !/^req_[A-Za-z0-9_]+$/.test(dados.requestId)) {
      return responder({ erro: 'Campos inválidos.' }, 400);
    }

    const campos = new URLSearchParams({
      action: dados.action,
      firebaseIdToken: dados.firebaseIdToken,
      requestId: dados.requestId,
      parentOrigin: ORIGEM_PERMITIDA,
      transport: 'proxy',
      payload: JSON.stringify(dados.payload || {})
    });

    try {
      const json = await receberJsonGoogle(upstream, campos);
      if (json.tipo !== 'MART_VENDEDORES_API' || json.requestId !== dados.requestId || typeof json.ok !== 'boolean') {
        return responder({ erro: 'Resposta inesperada da API. Confira a versão publicada do Code.gs.' }, 502);
      }
      return responder(json);
    } catch (erro) {
      if (String(erro.message).startsWith('HTTP_APPS_SCRIPT_')) {
        const status = String(erro.message).slice('HTTP_APPS_SCRIPT_'.length);
        return responder({ erro: `O Google devolveu HTTP ${status}. Confira a implantação do Apps Script e os registros de execução.` }, 502);
      }
      return responder({ erro: 'Não foi possível obter a resposta JSON do Apps Script. Confira o Code.gs publicado e as execuções.' }, 502);
    }
  }
};
