/* Cliente público restrito do Portal de Gerentes. Não acessa operações administrativas. */
const GerentesAPI = {
  async executar(action, payload = {}) {
    if (!['consultarPainelGerente', 'criarSolicitacaoGerente'].includes(action))
      throw new Error('Operação não disponível no Portal de Gerentes.');
    const destino = new URL(String(CONFIG.adminProxyUrl || ''));
    if (destino.protocol !== 'https:' || !destino.hostname.endsWith('.workers.dev'))
      throw new Error('Serviço do Portal de Gerentes não configurado.');
    const requestId = 'req_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    try {
      const resposta = await fetch(destino.href, {
        method: 'POST', mode: 'cors', cache: 'no-store', credentials: 'omit',
        headers: {'Content-Type': 'application/json'},
        signal: controller.signal,
        body: JSON.stringify({action, firebaseIdToken:'', requestId, payload})
      });
      let dados;
      try { dados = await resposta.json(); }
      catch (_) { throw new Error('A API do gerente respondeu em formato inesperado.'); }
      if (!resposta.ok || !dados.ok) {
        const erro=String(dados.erro||'Não foi possível consultar o Portal de Gerentes.');
        if (/a[cç][aã]o n[aã]o reconhecida|opera[cç][aã]o desconhecida/i.test(erro))
          throw new Error('O Apps Script administrativo de TESTE ainda não reconhece o Portal de Gerentes. Publique a versão atual de Code.gs e Gerentes.gs e confira o /exec configurado no Worker.');
        throw new Error(erro);
      }
      if (dados.tipo !== 'MART_VENDEDORES_API' || dados.requestId !== requestId)
        throw new Error('Confirmação da API inválida.');
      return dados;
    } catch (erro) {
      if (erro.name === 'AbortError') throw new Error('A conexão demorou. Se enviou um pedido, confirme no administrador antes de repetir.');
      if (erro instanceof TypeError) throw new Error('Não foi possível conectar ao gateway do Portal de Gerentes.');
      throw erro;
    } finally { clearTimeout(timeout); }
  }
};
