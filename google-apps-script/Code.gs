/**
 * Martinello Ofertas — API privada da base Vendedores (AMBIENTE DE TESTE).
 * Este projeto deve permanecer vinculado à planilha de TESTE indicada abaixo.
 * A API aceita apenas ações explícitas e nunca recebe um ID de planilha do navegador.
 *
 * Observação de escopo: Apps Script Web Apps não têm contexto de planilha ativa.
 * Por isso, a API abre o documento pelo URL fixo e requer o escopo "spreadsheets".
 * O código valida o ID fixo, a conta autorizada e um token privado antes de ler/gravar.
 */

const MART_V153_TEST_SHEET_ID = '127G49HueMod1v-bHP66Ci4X1bpP4sIhRPZRO0JJKxdA';
const MART_V153_TEST_SHEET_URL = 'https://docs.google.com/spreadsheets/d/' + MART_V153_TEST_SHEET_ID + '/edit';
const MART_V153_SHEET_NAME = 'Vendedores';
const MART_V153_HEADERS = [
  'matricula', 'nome', 'filial', 'codigo_filial', 'telefone_original',
  'telefone_normalizado', 'situacao_funcional', 'status_cadastro',
  'origem_cadastro', 'criado_em', 'atualizado_em', 'observacoes', 'status_telefone'
];

/**
 * Execute manualmente no editor do Apps Script, aberto pela planilha de TESTE.
 * Registra a conta que administrará o painel e gera um token privado.
 * O token aparece apenas neste alerta; guarde-o na configuração do admin de TESTE.
 */
function configurarAdministradorApiVendedoresV153() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss || ss.getId() !== MART_V153_TEST_SHEET_ID) {
    throw new Error('Proteção: abra Extensões > Apps Script diretamente pela planilha de TESTE antes de executar esta função.');
  }
  const email = String(Session.getEffectiveUser().getEmail() || '').trim().toLowerCase();
  if (!email) throw new Error('Não foi possível identificar a conta Google. Execute pelo editor com sua conta conectada.');

  const token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  PropertiesService.getScriptProperties().setProperties({
    MART_V153_ADMIN_EMAIL: email,
    MART_V153_API_TOKEN: token,
    MART_V153_SHEET_ID: ss.getId()
  }, false);

  SpreadsheetApp.getUi().alert(
    'Administrador configurado',
    'Conta autorizada: ' + email + '\n\nTOKEN PRIVADO (copie agora para o painel de teste):\n\n' + token + '\n\nNão publique nem compartilhe este token. Se perdê-lo, execute esta função novamente para gerar outro.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

/** Diagnóstico manual: confirma planilha, aba, cabeçalhos e quantidade de registros. */
function testarBaseVendedoresV153() {
  const ss = obterPlanilhaVendedoresV153_();
  const sh = obterAbaVendedoresV153_(ss);
  const resumo = {
    planilha: ss.getName(),
    aba: sh.getName(),
    registros: Math.max(0, sh.getLastRow() - 1),
    colunas: MART_V153_HEADERS.length
  };
  SpreadsheetApp.getUi().alert('Base encontrada', JSON.stringify(resumo, null, 2), SpreadsheetApp.getUi().ButtonSet.OK);
}

/** GET serve apenas para abrir uma página simples de autorização/diagnóstico. */
function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.action !== 'autorizar') {
    return HtmlService.createHtmlOutput('<h2>API Martinello</h2><p>Use o painel administrativo para consultar ou alterar a base.</p>');
  }
  try {
    exigirEmailAdministradorV153_();
    obterAbaVendedoresV153_(obterPlanilhaVendedoresV153_());
    return HtmlService.createHtmlOutput('<h2>API de vendedores autorizada</h2><p>Esta conta pode acessar a base de teste. Volte ao painel Martinello e clique em CONECTAR E CARREGAR.</p>');
  } catch (erro) {
    return HtmlService.createHtmlOutput('<h2>Acesso não autorizado</h2><p>' + escaparHtmlV153_(mensagemErroV153_(erro)) + '</p>');
  }
}

/**
 * API POST: todas as operações (inclusive leitura) recebem token no corpo do POST,
 * evitando colocar o token privado na URL, no histórico ou em cabeçalhos Referer.
 */
function doPost(e) {
  const p = (e && e.parameter) || {};
  const requestId = String(p.requestId || '').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 100);
  let parentOrigin = '';
  try {
    parentOrigin = validarOrigemPainelV153_(p.parentOrigin);
    exigirAdministradorV153_(p.apiToken);
    const textoPayload = String(p.payload || '{}');
    if (textoPayload.length > 500000) throw new Error('Solicitação muito grande. Reduza os dados e tente novamente.');
    const payload = JSON.parse(textoPayload);
    let resultado;

    if (p.action === 'listarVendedores') {
      const ss = obterPlanilhaVendedoresV153_();
      const sh = obterAbaVendedoresV153_(ss);
      const ultima = sh.getLastRow();
      const resumo = { total: Math.max(0, ultima - 1), planilha: ss.getName(), aba: sh.getName() };
      if (payload.apenasResumo === true) resultado = { resumo };
      else {
        const linhas = ultima >= 1 ? sh.getRange(1, 1, ultima, MART_V153_HEADERS.length).getDisplayValues() : [];
        resultado = { resumo, linhas };
      }
    } else if (p.action === 'verificarLinks') {
      const ids = Array.isArray(payload.matriculas) ? payload.matriculas.map(somenteDigitosV153_).filter(Boolean) : [];
      if (!ids.length || ids.length > 30) throw new Error('Informe de 1 a 30 matrículas por solicitação.');
      resultado = { resultados: verificarMatriculasV153_(ids) };
    } else if (p.action === 'salvarVendedor') {
      resultado = salvarVendedorV153_(payload);
    } else if (p.action === 'criarVendedor') {
      resultado = criarVendedorV153_(payload);
    } else if (p.action === 'importarFuncionarios') {
      resultado = importarFuncionariosV153_(payload);
    } else {
      throw new Error('Ação não reconhecida.');
    }
    return respostaPostV153_(requestId, true, '', resultado, parentOrigin);
  } catch (erro) {
    // Só ecoa para uma origem HTTPS do GitHub Pages validada; não usa targetOrigin '*'.
    if (!parentOrigin) {
      return HtmlService.createHtmlOutput('<h2>Solicitação recusada</h2><p>Origem do painel não autorizada.</p>');
    }
    return respostaPostV153_(requestId, false, mensagemErroV153_(erro), null, parentOrigin);
  }
}

function validarOrigemPainelV153_(origem) {
  const valor = String(origem || '').trim();
  if (!/^https:\/\/[a-z0-9-]+\.github\.io$/i.test(valor)) {
    throw new Error('Origem do painel não autorizada. Utilize o site de teste publicado no GitHub Pages.');
  }
  return valor;
}

function exigirEmailAdministradorV153_() {
  const emailAutorizado = String(PropertiesService.getScriptProperties().getProperty('MART_V153_ADMIN_EMAIL') || '').trim().toLowerCase();
  const emailAtivo = String(Session.getEffectiveUser().getEmail() || '').trim().toLowerCase();
  if (!emailAutorizado) throw new Error('API ainda não configurada. Execute configurarAdministradorApiVendedoresV153 no editor.');
  if (!emailAtivo || emailAtivo !== emailAutorizado) throw new Error('Conta Google não autorizada para acessar esta base.');
}

function exigirAdministradorV153_(tokenInformado) {
  exigirEmailAdministradorV153_();
  const tokenSalvo = String(PropertiesService.getScriptProperties().getProperty('MART_V153_API_TOKEN') || '');
  if (!tokenSalvo) throw new Error('Token da API não configurado. Execute configurarAdministradorApiVendedoresV153 no editor.');
  if (!tokenInformado || String(tokenInformado) !== tokenSalvo) throw new Error('Token privado inválido. Confira o token salvo no painel de teste.');
}

function escaparHtmlV153_(texto) {
  return String(texto || '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

/**
 * Em chamadas de web app não há planilha ativa. Abrimos somente a URL fixa acima
 * e confirmamos o ID novamente antes de qualquer operação.
 */
function obterPlanilhaVendedoresV153_() {
  const ss = SpreadsheetApp.openByUrl(MART_V153_TEST_SHEET_URL);
  if (!ss || ss.getId() !== MART_V153_TEST_SHEET_ID) {
    throw new Error('Proteção: a API está configurada para outra planilha. Nenhum dado foi alterado.');
  }
  const idConfigurado = String(PropertiesService.getScriptProperties().getProperty('MART_V153_SHEET_ID') || '');
  if (idConfigurado && idConfigurado !== ss.getId()) throw new Error('O ID vinculado à configuração não corresponde à planilha de TESTE.');
  return ss;
}

function obterAbaVendedoresV153_(ss) {
  const sh = ss.getSheetByName(MART_V153_SHEET_NAME);
  if (!sh) throw new Error('A aba Vendedores não foi encontrada.');
  const headers = sh.getRange(1, 1, 1, MART_V153_HEADERS.length).getDisplayValues()[0].map(v => String(v || '').trim());
  for (let i = 0; i < MART_V153_HEADERS.length; i++) {
    if (headers[i] !== MART_V153_HEADERS[i]) {
      throw new Error('Cabeçalho inesperado em Vendedores, coluna ' + (i + 1) + '. Nenhum dado foi alterado.');
    }
  }
  return sh;
}

function salvarVendedorV153_(p) {
  const matricula = somenteDigitosV153_(p.matricula);
  const nome = textoV153_(p.nome);
  const filial = textoV153_(p.filial);
  const telefone = somenteDigitosV153_(p.telefone);
  if (!matricula || !nome) throw new Error('Matrícula e nome são obrigatórios.');
  if (telefone && !telefoneValidoV153_(telefone)) throw new Error('Telefone inválido. Informe DDD e número com 10 ou 11 dígitos, ou o código 55 mais o telefone.');

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sh = obterAbaVendedoresV153_(obterPlanilhaVendedoresV153_());
    const ultima = sh.getLastRow();
    if (ultima < 2) throw new Error('A base Vendedores está vazia.');
    const mats = sh.getRange(2, 1, ultima - 1, 1).getDisplayValues().map(r => somenteDigitosV153_(r[0]));
    const indices = [];
    mats.forEach((m, i) => { if (m === matricula) indices.push(i + 2); });
    if (indices.length !== 1) throw new Error(indices.length ? 'Há matrículas duplicadas na base. Nenhuma alteração foi feita.' : 'Matrícula não encontrada na base Vendedores. Atualize a lista.');

    const linha = indices[0];
    const atual = sh.getRange(linha, 1, 1, 13).getValues()[0];
    const statusCadastro = textoV153_(p.statusCadastro).toUpperCase() || textoV153_(atual[7]) || 'ATIVO';
    const statusTelefone = telefone ? (textoV153_(p.statusTelefone).toUpperCase() === 'VALIDADO' ? 'VALIDADO' : 'PENDENTE') : 'PENDENTE';
    const agora = new Date().toISOString();
    const codigoFilial = String(atual[3] == null ? '' : atual[3]); // campo legado preservado sem aparecer no formulário
    const nova = [
      matricula, nome, filial, codigoFilial,
      telefone, normalizarTelefoneV153_(telefone),
      atual[6] || 'OK', statusCadastro, atual[8] || 'MIGRACAO_BANCO_DE_DADOS',
      atual[9] || agora, agora, textoV153_(p.observacoes, atual[11]), statusTelefone
    ];
    gravarLinhaTextoV153_(sh, linha, nova);
    return { matricula, linha, atualizadoEm: agora, statusTelefone };
  } finally {
    lock.releaseLock();
  }
}

function criarVendedorV153_(p) {
  const matricula = somenteDigitosV153_(p.matricula);
  const nome = textoV153_(p.nome);
  const filial = textoV153_(p.filial);
  const telefone = somenteDigitosV153_(p.telefone);
  if (!matricula || !nome || !filial) throw new Error('Matrícula, nome e filial são obrigatórios.');
  if (telefone && !telefoneValidoV153_(telefone)) throw new Error('Telefone inválido. Informe DDD e número com 10 ou 11 dígitos, ou o código 55 mais o telefone.');

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sh = obterAbaVendedoresV153_(obterPlanilhaVendedoresV153_());
    const ultima = sh.getLastRow();
    const existentes = ultima >= 2 ? sh.getRange(2, 1, ultima - 1, 1).getDisplayValues().map(r => somenteDigitosV153_(r[0])) : [];
    if (existentes.includes(matricula)) throw new Error('Esta matrícula já existe na base. Atualize a lista e edite o cadastro existente.');
    const agora = new Date().toISOString();
    const statusTelefone = telefone && textoV153_(p.statusTelefone).toUpperCase() === 'VALIDADO' ? 'VALIDADO' : 'PENDENTE';
    const linha = [
      matricula, nome, filial, '',
      telefone, normalizarTelefoneV153_(telefone),
      'PENDENTE_VALIDACAO', 'ATIVO', 'CADASTRO_MANUAL',
      agora, agora, textoV153_(p.observacoes), statusTelefone
    ];
    const destino = sh.getLastRow() + 1;
    gravarLinhaTextoV153_(sh, destino, linha);
    return { matricula, linha: destino, criadoEm: agora, statusTelefone };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Importação controlada do relatório de funcionários.
 * Atualiza nome/filial/situação pela matrícula, preservando telefones, validações,
 * observações, datas de criação e o campo legado codigo_filial.
 */
function importarFuncionariosV153_(payload) {
  const entrada = Array.isArray(payload.registros) ? payload.registros : [];
  if (!entrada.length) throw new Error('O relatório não contém vendedores válidos.');
  if (entrada.length > 2500) throw new Error('O limite é de 2.500 registros por importação.');

  const vistos = {};
  const registros = entrada.map((item, indice) => {
    const matricula = somenteDigitosV153_(item.matricula);
    const nome = textoV153_(item.nome);
    const filial = textoV153_(item.filial);
    if (!matricula || !nome || !filial) throw new Error('Registro inválido na linha importada ' + (indice + 1) + ': matrícula, nome e filial são obrigatórios.');
    if (vistos[matricula]) throw new Error('A matrícula ' + matricula + ' aparece mais de uma vez no arquivo. Corrija o relatório antes de importar.');
    vistos[matricula] = true;
    return {
      matricula,
      nome: nome.slice(0, 160),
      filial: filial.slice(0, 120),
      situacaoFuncional: textoV153_(item.situacaoFuncional) || (item.ativo === false ? 'INATIVO' : 'OK'),
      ativo: item.ativo !== false
    };
  });

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sh = obterAbaVendedoresV153_(obterPlanilhaVendedoresV153_());
    const ultima = sh.getLastRow();
    const totalExistente = Math.max(0, ultima - 1);
    const dados = totalExistente ? sh.getRange(2, 1, totalExistente, MART_V153_HEADERS.length).getDisplayValues() : [];
    const indicePorMatricula = {};
    dados.forEach((linha, i) => {
      const mat = somenteDigitosV153_(linha[0]);
      if (!mat) return;
      if (indicePorMatricula[mat] !== undefined) throw new Error('A base atual contém matrícula duplicada (' + mat + '). Nenhuma importação foi aplicada.');
      indicePorMatricula[mat] = i;
    });

    const entradaPorMatricula = {};
    registros.forEach(r => { entradaPorMatricula[r.matricula] = r; });
    const agora = new Date().toISOString();
    let novos = 0, atualizados = 0, semAlteracao = 0, inativados = 0;

    dados.forEach((linha, i) => {
      const mat = somenteDigitosV153_(linha[0]);
      if (!mat) return;
      const registro = entradaPorMatricula[mat];
      if (registro) {
        const antes = [linha[1], linha[2], linha[6], linha[7]].join('|');
        const depoisSituacao = registro.situacaoFuncional;
        const depoisStatus = registro.ativo ? 'ATIVO' : 'INATIVO';
        const depois = [registro.nome, registro.filial, depoisSituacao, depoisStatus].join('|');
        if (antes !== depois) {
          linha[1] = registro.nome;
          linha[2] = registro.filial;
          // linha[3] codigo_filial legado: manter sem alterações.
          linha[6] = depoisSituacao;
          linha[7] = depoisStatus;
          linha[10] = agora;
          atualizados++;
        } else semAlteracao++;
      } else if (payload.inativarAusentes === true
          && String(linha[7] || '').toUpperCase() !== 'INATIVO'
          && String(linha[8] || '').toUpperCase() !== 'CADASTRO_MANUAL') {
        linha[6] = 'NAO_ENCONTRADO_NO_RELATORIO';
        linha[7] = 'INATIVO';
        linha[10] = agora;
        inativados++;
      }
    });

    const novosRegistros = [];
    registros.forEach(r => {
      if (indicePorMatricula[r.matricula] !== undefined) return;
      novosRegistros.push([
        r.matricula, r.nome, r.filial, '', '', '',
        r.situacaoFuncional, r.ativo ? 'ATIVO' : 'INATIVO',
        'IMPORTACAO_RELATORIO', agora, agora, '', 'PENDENTE'
      ]);
      novos++;
    });

    // A aba Vendedores é uma tabela de valores (sem fórmulas). Regrava somente A:M.
    if (dados.length) {
      const destino = sh.getRange(2, 1, dados.length, MART_V153_HEADERS.length);
      destino.setNumberFormat('@');
      destino.setValues(dados.map(l => l.map(v => String(v == null ? '' : v))));
    }
    if (novosRegistros.length) {
      const inicio = sh.getLastRow() + 1;
      const destinoNovos = sh.getRange(inicio, 1, novosRegistros.length, MART_V153_HEADERS.length);
      destinoNovos.setNumberFormat('@');
      destinoNovos.setValues(novosRegistros);
    }
    SpreadsheetApp.flush();
    return {
      totalImportado: registros.length,
      novos,
      atualizados,
      semAlteracao,
      inativados,
      preservados: true,
      arquivo: textoV153_(payload.nomeArquivo)
    };
  } finally {
    lock.releaseLock();
  }
}

function gravarLinhaTextoV153_(sh, linha, valores) {
  const range = sh.getRange(linha, 1, 1, 13);
  range.setNumberFormat('@');
  range.setValues([valores.map(v => String(v == null ? '' : v))]);
  SpreadsheetApp.flush();
}

function respostaPostV153_(requestId, ok, erro, resultado, parentOrigin) {
  const dados = JSON.stringify({ tipo: 'MART_VENDEDORES_API', requestId, ok, erro: erro || '', resultado: resultado || null })
    .replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
  const destino = JSON.stringify(parentOrigin);
  // HtmlService envolve o conteúdo em iframes internos. O painel GitHub está na janela superior,
  // então parent.postMessage() alcançaria apenas o wrapper do Google. Use top.postMessage().
  const html = '<!doctype html><html><head><meta charset="utf-8"></head><body><script>window.top.postMessage(' + dados + ', ' + destino + ');</script>Solicitação processada.</body></html>';
  return HtmlService.createHtmlOutput(html).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function textoV153_(valor, padrao) {
  const texto = String(valor == null ? '' : valor).trim();
  return texto || String(padrao == null ? '' : padrao).trim();
}
function somenteDigitosV153_(valor) { return String(valor == null ? '' : valor).replace(/\D/g, ''); }
function telefoneValidoV153_(numero) {
  const n = somenteDigitosV153_(numero);
  if (n.length === 10 || n.length === 11) return true;
  return (n.length === 12 || n.length === 13) && n.indexOf('55') === 0;
}
function normalizarTelefoneV153_(numero) {
  let n = somenteDigitosV153_(numero);
  if (!n) return '';
  if ((n.length === 10 || n.length === 11) && n.indexOf('55') !== 0) n = '55' + n;
  return n;
}
function mensagemErroV153_(erro) { return String(erro && erro.message ? erro.message : erro || 'Erro não identificado.').slice(0, 500); }

// ============================================
// Verificador de links Martinello (mantido)
// ============================================
function verificarMatriculasV153_(matriculas) {
  const requisicoes = matriculas.map(function (matricula) {
    return {
      url: 'https://www.martinello.com.br/parceiros/' + encodeURIComponent(matricula),
      method: 'get', followRedirects: false, muteHttpExceptions: true, timeoutSeconds: 25,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MartinelloLinkCheck/1.0)' }
    };
  });
  let respostas = [];
  try {
    respostas = UrlFetchApp.fetchAll(requisicoes);
  } catch (erroLote) {
    respostas = requisicoes.map(function (req) {
      try { return UrlFetchApp.fetch(req.url, req); } catch (erro) { return null; }
    });
  }
  return matriculas.map(function (matricula, i) {
    const resposta = respostas[i];
    if (!resposta) return { matricula, status: 'erro', httpCode: '', destino: '', url: '' };
    const codigo = resposta.getResponseCode();
    const cabecalhos = resposta.getAllHeaders() || {};
    const chaveLocation = Object.keys(cabecalhos).find(k => k.toLowerCase() === 'location');
    const destino = chaveLocation ? String(cabecalhos[chaveLocation] || '') : '';
    let status = 'inconclusivo';
    let urlFinal = 'https://www.martinello.com.br/parceiros/' + matricula;
    if (/localhost:55191/i.test(destino)) { status = 'inativo'; urlFinal = destino; }
    else if (codigo >= 300 && codigo < 400) { status = 'redirecionamento'; urlFinal = destino || urlFinal; }
    else if (codigo === 404 || codigo === 410) status = 'inativo';
    else if (codigo >= 200 && codigo < 300) {
      const corpo = String(resposta.getContentText() || '').slice(0, 150000);
      if (/localhost:55191/i.test(corpo)) { status = 'inativo'; urlFinal = 'http://localhost:55191/'; }
      else status = 'ativo';
    }
    return { matricula, status, httpCode: codigo, destino, url: urlFinal };
  });
}
