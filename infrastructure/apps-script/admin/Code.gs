/** API administrativa v1.6.19. Token Firebase e permissões conferidos no servidor.
 * Configuração por projeto, em Script Properties:
 * MART_V153_SHEET_ID, MART_FIREBASE_WEB_API_KEY, MART_V153_ADMIN_EMAIL, MART_AMBIENTE.
 */
const MART_V153_TEST_SHEET_ID = String(PropertiesService.getScriptProperties().getProperty('MART_V153_SHEET_ID') || '').trim();
const MART_V153_TEST_SHEET_URL = 'https://docs.google.com/spreadsheets/d/' + MART_V153_TEST_SHEET_ID + '/edit';
const MART_V153_SHEET_NAME = 'Vendedores';
// API key Firebase Web: identificador publico do projeto, NAO e senha.
const MART_V160_FIREBASE_API_KEY = String(PropertiesService.getScriptProperties().getProperty('MART_FIREBASE_WEB_API_KEY') || '').trim();
const MART_V153_FILIAIS_SHEET_NAME = 'Filiais';
const MART_V161_ADMIN_LIST_PROP = 'MART_V161_EXTRA_ADMINS';
// UIDs obtidos APENAS após validação de token Firebase e email autorizado.
const MART_V169_ADMIN_UIDS_PROP = 'MART_V169_ADMIN_EMAIL_UIDS';
const MART_V169_ALLOWED_ORIGIN = 'https://e-commerce-martinello.github.io';
const MART_V153_HEADERS = [
  'matricula', 'nome', 'filial', 'codigo_filial', 'telefone_original',
  'telefone_normalizado', 'situacao_funcional', 'status_cadastro',
  'origem_cadastro', 'criado_em', 'atualizado_em', 'observacoes', 'status_telefone'
];

/**
 * Execute no editor do Apps Script administrativo do ambiente correspondente.
 * A API antiga por token permanente deixa de ser aceita nesta versão.
 */
function configurarAdministradorApiVendedoresV160() {
  const id=String(PropertiesService.getScriptProperties().getProperty('MART_V153_SHEET_ID')||'').trim();
  if(!/^[A-Za-z0-9_-]{25,}$/.test(id)) throw new Error('Configure MART_V153_SHEET_ID nas Propriedades do script.');
  const ss=SpreadsheetApp.openById(id);
  const ativa=SpreadsheetApp.getActiveSpreadsheet();
  if (ativa && ativa.getId() !== id) throw new Error('A planilha ativa e diferente da propriedade MART_V153_SHEET_ID.');
  const email = String(Session.getEffectiveUser().getEmail() || '').trim().toLowerCase();
  if (!email) throw new Error('Não foi possível identificar a conta Google.');
  const props = PropertiesService.getScriptProperties();
  props.setProperties({MART_V153_ADMIN_EMAIL: email, MART_V153_SHEET_ID: ss.getId()});
  props.deleteProperty('MART_V153_API_TOKEN');
  // Projetos standalone (sem planilha vinculada) nao possuem SpreadsheetApp.getUi().
  console.log('Administrador principal configurado: '+email+' / Planilha: '+ss.getName());
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

/** Endpoint público de diagnóstico; não confere nem revela acesso à planilha.
 * A autenticação real ocorre exclusivamente em doPost com Firebase ID token.
 */
// Diagnóstico sem dados privados: confirme a versão publicada via /exec?diagnostico=json.
const MART_V1692_API_VERSION = '1.6.19';
function doGet(e) {
  const modo = String((e && e.parameter && e.parameter.diagnostico) || '');
  if (modo === 'json') {
    return ContentService.createTextOutput(JSON.stringify({
      tipo: 'MART_API_DIAGNOSTICO', versao: MART_V1692_API_VERSION, formato: 'JSON'
    })).setMimeType(ContentService.MimeType.JSON);
  }
  return HtmlService.createHtmlOutput('<h2>API Martinello — v' + MART_V1692_API_VERSION + '</h2><p>Serviço disponível. A autorização é conferida pelo painel usando login Google.</p>');
}

/**
 * API POST: admins exigem Firebase ID Token; gerentes usam matrícula cadastrada.
 */
function doPost(e) {
  const p = (e && e.parameter) || {};
  const requestId = String(p.requestId || '').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 100);
  // Definir o formato ANTES da autorização, inclusive para respostas de erro.
  const usarJson = String(p.transport || '').trim() === 'proxy';
  console.log('MART_API_1692_ENTRADA', JSON.stringify({
    requestId: requestId, proxy: usarJson, origemValida: String(p.parentOrigin || '').trim() === MART_V169_ALLOWED_ORIGIN
  }));
  let parentOrigin = '';
  try {
    parentOrigin = validarOrigemPainelV153_(p.parentOrigin);
    const textoPayload = String(p.payload || '{}');
    if (textoPayload.length > 500000) throw new Error('Solicitação muito grande. Reduza os dados e tente novamente.');
    const payload = JSON.parse(textoPayload);
    const acaoGerente = ['consultarPainelGerente','criarSolicitacaoGerente'].includes(String(p.action||''));
    // Apenas estas duas ações aceitam matrícula sem login. Nenhuma operação
    // administrativa é aberta: todas as demais exigem Firebase ID token válido.
    const acesso = acaoGerente
      ? mart20_autorizarGerente_(payload.matriculaGerente)
      : exigirAdministradorV160_(p.firebaseIdToken);
    let resultado;

    const escrita=!/^(listar|consultar|sincronizar)/.test(String(p.action||''));
    if(escrita)mart19_invalidar_();
    if (p.action === 'consultarPainelGerente') {
      resultado = mart20_consultarPainelGerente_(payload,acesso);
    } else if (p.action === 'criarSolicitacaoGerente') {
      resultado = mart20_criarSolicitacaoGerente_(payload,acesso);
    } else if (p.action === 'listarCadastroGerentes') {
      resultado = mart20_listarCadastroGerentes_();
    } else if (p.action === 'salvarCadastroGerente') {
      resultado = mart20_salvarCadastroGerente_(payload);
    } else if (p.action === 'listarSolicitacoesGerentes') {
      resultado = mart20_listarSolicitacoesGerentes_();
    } else if (p.action === 'atualizarSolicitacaoGerente') {
      resultado = mart20_atualizarSolicitacaoGerente_(payload,acesso.email);
    } else if (p.action === 'consultarCapacidades') {
      resultado={versao:'1.6.19',sincronizacao:true,edicaoCompleta:typeof Sheets!=='undefined'&&!!mart1618_abaFones_(false),
        push:PropertiesService.getScriptProperties().getProperty('MART19_PUSH_ATIVO')==='true'};
    } else if (p.action === 'sincronizarAdmin') {
      resultado=mart19_snapshot_(payload,acesso);
    } else if (p.action === 'salvarCadastroCompleto') {
      resultado=mart19_salvarVendedor_(payload,acesso.email);
    } else if (p.action === 'listarVendedores') {
      const ss = obterPlanilhaVendedoresV153_();
      const sh = obterAbaVendedoresV153_(ss);
      const ultima = sh.getLastRow();
      const resumo = { total: Math.max(0, ultima - 1), planilha: ss.getName(), aba: sh.getName() };
      if (payload.apenasResumo === true) resultado = { resumo, email: acesso.email, proprietario: acesso.proprietario };
      else {
        const linhas = ultima >= 1 ? sh.getRange(1, 1, ultima, MART_V153_HEADERS.length).getDisplayValues() : [];
        resultado = { resumo, linhas, filiais: listarFiliaisV153_(ss) };
      }
    } else if (p.action === 'listarEventosPortal') {
      resultado = listarEventosPortalV1632_(payload);
    } else if (p.action === 'listarSolicitacoesTelefone') {
      resultado = mart1613_listarSolicitacoesTelefone_();
    } else if (p.action === 'listarWhatsApp') {
      resultado = mart164_listar_();
    } else if (p.action === 'importarWhatsApp') {
      resultado = mart164_importar_(payload);
    } else if (p.action === 'normalizarWhatsApp') {
      resultado = mart165_normalizarExistentes_(payload);
    } else if (p.action === 'salvarIdentificacaoWhatsApp') {
      resultado = mart164_salvarIdentificacao_(payload, acesso.email);
    } else if (p.action === 'listarVerificacoesLinks') {
      resultado = { resultados: mart167_listarLinks_() };
    } else if (p.action === 'listarCampanhas') {
      resultado = mart1614_listarCampanhas_();
    } else if (p.action === 'salvarCampanhas') {
      resultado = mart1614_salvarCampanhas_(payload, acesso.email);
    } else if (p.action === 'listarConfigContatos') {
      resultado = mart169_listarConfigContatos_();
    } else if (p.action === 'salvarConfigContatos') {
      resultado = mart169_salvarConfigContatos_(payload, acesso.email);
    } else if (p.action === 'listarContatosRecentes') {
      resultado = { contatos: mart167_listarContatos_() };
    } else if (p.action === 'registrarContatoRealizado') {
      resultado = mart167_registrarContato_(payload, acesso.email);
    } else if (p.action === 'verificarLinks') {
      const ids = Array.isArray(payload.matriculas) ? [...new Set(payload.matriculas.map(somenteDigitosV153_).filter(x => /^\d{2,8}$/.test(x)))] : [];
      if (!ids.length || ids.length > 30) throw new Error('Informe de 1 a 30 matrículas válidas por solicitação.');
      const verificacoes = verificarMatriculasV153_(ids);
      mart167_salvarLinks_(verificacoes, acesso.email);
      resultado = { resultados: verificacoes };
    } else if (p.action === 'listarTelefonesExtras') {
      resultado = mart1618_listarTelefones_();
    } else if (p.action === 'salvarTelefonesExtras') {
      throw new Error('Atualize o painel para v1.6.19 antes de editar cadastros.');
    } else if (p.action === 'salvarVendedor') {
      throw new Error('Atualize o painel para v1.6.19 antes de editar cadastros.');
    } else if (p.action === 'criarVendedor') {
      throw new Error('Atualize o painel para v1.6.19 antes de editar cadastros.');
    } else if (p.action === 'importarFuncionarios') {
      resultado = importarFuncionariosV153_(payload);
    } else if (p.action === 'listarAuditoria') {
      exigirProprietarioV161_(acesso);
      resultado = mart1615_listarAuditoria_();
    } else if (p.action === 'criarBackupPlanilha') {
      exigirProprietarioV161_(acesso);
      resultado = mart1615_criarBackupPlanilha_(acesso.email);
    } else if (p.action === 'registrarAuditoriaFirebase') {
      resultado = mart1615_validarRelatoFirebase_(payload);
    } else if (p.action === 'listarAdministradores') {
      exigirProprietarioV161_(acesso);
      resultado = listarAdministradoresV161_();
    } else if (p.action === 'adicionarAdministrador') {
      exigirProprietarioV161_(acesso);
      resultado = modificarAdministradoresV161_('adicionar', payload.email, acesso.email);
    } else if (p.action === 'removerAdministrador') {
      exigirProprietarioV161_(acesso);
      resultado = modificarAdministradoresV161_('remover', payload.email, acesso.email);
    } else {
      throw new Error('Ação não reconhecida.');
    }
    // O Apps Script valida o autor e registra somente ações de gravação concluídas.
    const evento = mart1615_eventoAuditavel_(String(p.action || ''), payload, resultado);
    if (evento) {
      try {
        mart1615_gravarAuditoria_(acesso.email, evento.origem, evento.acao, evento.alvo, evento.resumo, requestId);
      } catch (erroAuditoria) {
        console.warn('AUDITORIA_1615_INDISPONIVEL', String(erroAuditoria && erroAuditoria.name || 'Erro'));
        // Não falhar uma operação concluída e evitar repetição acidental do POST.
        // A interface mostra um aviso de auditoria pendente quando houver.
        if (resultado && typeof resultado === 'object' && !Array.isArray(resultado))
          resultado.avisoAuditoria = 'Operação concluída; auditoria temporariamente indisponível.';
      }
    }
    if(escrita)mart19_depoisEscrita_();
    return respostaPostV153_(requestId, true, '', resultado, parentOrigin, usarJson);
  } catch (erro) {
    // Mesmo que a origem seja inválida, o gateway recebe JSON com ok:false.
    // Nenhum conteúdo protegido é devolvido antes da autenticação.
    console.log('MART_API_1692_ERRO', JSON.stringify({ requestId: requestId, proxy: usarJson,
      origemValidada: !!parentOrigin, tipo: String((erro && erro.name) || 'Erro') }));
    if (usarJson) {
      return respostaPostV153_(requestId, false, mensagemErroV153_(erro), null, parentOrigin, true);
    }
    // Manter o comportamento de compatibilidade com o site antigo (iframe).
    if (!parentOrigin) {
      return HtmlService.createHtmlOutput('<h2>Solicitação recusada</h2><p>Origem do painel não autorizada.</p>');
    }
    return respostaPostV153_(requestId, false, mensagemErroV153_(erro), null, parentOrigin, false);
  }
}

function validarOrigemPainelV153_(origem) {
  const valor = String(origem || '').trim();
  if (valor !== MART_V169_ALLOWED_ORIGIN) {
    throw new Error('Origem do painel não autorizada. Utilize o GitHub Pages autorizado.');
  }
  return valor;
}

function exigirEmailAdministradorV153_() {
  const emailPrincipal = String(PropertiesService.getScriptProperties().getProperty('MART_V153_ADMIN_EMAIL') || '').trim().toLowerCase();
  const emailAtivo = String(Session.getEffectiveUser().getEmail() || '').trim().toLowerCase();
  if (!emailPrincipal) throw new Error('API ainda não configurada. Execute configurarAdministradorApiVendedoresV160 no editor.');
  if (!emailAtivo || (emailAtivo !== emailPrincipal && !obterAdministradoresV161_().includes(emailAtivo))) {
    throw new Error('Conta Google não autorizada para acessar esta base.');
  }
}

/**
 * Confere o Firebase ID token no servidor usando Identity Toolkit accounts:lookup.
 * O token nunca é aceito somente por email alegado pelo navegador.
 * Depois compara email VERIFICADO com a conta autorizada nas propriedades do script.
 */
function exigirAdministradorV160_(idToken) {
  const token = String(idToken || '');
  if (token.length < 200 || token.length > 6000) throw new Error('Faça login Google novamente. Token ausente ou inválido.');
  if (!/^AIza[A-Za-z0-9_-]{20,}$/.test(MART_V160_FIREBASE_API_KEY)) throw new Error('Configure MART_FIREBASE_WEB_API_KEY no Apps Script deste ambiente.');
  const url = 'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + encodeURIComponent(MART_V160_FIREBASE_API_KEY);
  const resposta = UrlFetchApp.fetch(url, {
    method:'post', contentType:'application/json',
    payload: JSON.stringify({idToken:token}), muteHttpExceptions:true
  });
  if (resposta.getResponseCode() !== 200) throw new Error('Sessão Google inválida ou expirada. Entre novamente.');
  let dados = {};
  try { dados = JSON.parse(resposta.getContentText()); } catch(e) { throw new Error('Resposta de autenticação inválida.'); }
  const usuario = Array.isArray(dados.users) && dados.users.length === 1 ? dados.users[0] : null;
  if (!usuario || !usuario.localId || usuario.emailVerified !== true || usuario.disabled === true) {
    throw new Error('Conta Google não verificada ou desativada.');
  }
  // Exigir que a conta Firebase tenha sido autenticada via provedor Google.
  const google = Array.isArray(usuario.providerUserInfo)
      && usuario.providerUserInfo.some(p => p.providerId === 'google.com');
  if (!google) throw new Error('É necessário autenticar com o Google.');
  const props = PropertiesService.getScriptProperties();
  const principal = String(props.getProperty('MART_V153_ADMIN_EMAIL') || '').trim().toLowerCase();
  const email = String(usuario.email || '').trim().toLowerCase();
  const extras = obterAdministradoresV161_();
  if (!principal || (email !== principal && !extras.includes(email))) {
    throw new Error('Esta conta Google não tem permissão para administrar a base.');
  }
  // A implantação agora executa COMO O PROPRIETÁRIO, sem exigir que cada
  // administrador receba acesso direto à planilha. Isso NÃO autoriza o visitante:
  // o token Firebase, provedor Google, e-mail verificado e lista de permissões
  // foram conferidos ACIMA, no servidor, para toda operação.
  registrarUidAdministradorV169_(email, String(usuario.localId));
  return { email: email, proprietario: email === principal, uid: String(usuario.localId) };
}

/** Associa o UID real ao e-mail permitido; nunca aceita UID do navegador. */
function obterUidsAdministradoresV169_() {
  try {
    const mapa = JSON.parse(PropertiesService.getScriptProperties().getProperty(MART_V169_ADMIN_UIDS_PROP) || '{}');
    if (!mapa || typeof mapa !== 'object' || Array.isArray(mapa)) return {};
    return mapa;
  } catch (_) { return {}; }
}
function registrarUidAdministradorV169_(email, uid) {
  if (!/^[a-zA-Z0-9_-]{6,128}$/.test(uid)) return;
  const atual = obterUidsAdministradoresV169_();
  if (atual[email] === uid) return;
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const mapa = obterUidsAdministradoresV169_();
    if (mapa[email] !== uid) {
      mapa[email] = uid;
      PropertiesService.getScriptProperties().setProperty(MART_V169_ADMIN_UIDS_PROP, JSON.stringify(mapa));
    }
  } finally { lock.releaseLock(); }
}

/** A lista de administradores complementares fica em Script Properties, não no GitHub. */
function obterAdministradoresV161_() {
  const raw = PropertiesService.getScriptProperties().getProperty(MART_V161_ADMIN_LIST_PROP) || '[]';
  let lista;
  try { lista = JSON.parse(raw); } catch (_) { throw new Error('Lista de administradores inválida no servidor.'); }
  if (!Array.isArray(lista)) throw new Error('Lista de administradores inválida no servidor.');
  return [...new Set(lista.map(e => String(e || '').trim().toLowerCase()).filter(Boolean))];
}

function exigirProprietarioV161_(acesso) {
  if (!acesso || acesso.proprietario !== true) throw new Error('Somente a conta principal pode gerenciar os administradores.');
}

function listarAdministradoresV161_() {
  const principal = String(PropertiesService.getScriptProperties().getProperty('MART_V153_ADMIN_EMAIL') || '').trim().toLowerCase();
  if (!principal) throw new Error('Configure o administrador principal primeiro.');
  const uids = obterUidsAdministradoresV169_();
  return { administradores: [{ email: principal, proprietario: true, uid: uids[principal] || '' }].concat(
    obterAdministradoresV161_().filter(email => email !== principal).map(email => ({ email, proprietario: false, uid: uids[email] || '' }))
  ) };
}

function modificarAdministradoresV161_(operacao, valor, ator) {
  const email = String(valor || '').trim().toLowerCase();
  if (!/^[a-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email) || email.length > 254) {
    throw new Error('Informe um e-mail válido.');
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const props = PropertiesService.getScriptProperties();
    const principal = String(props.getProperty('MART_V153_ADMIN_EMAIL') || '').trim().toLowerCase();
    if (email === principal) throw new Error('A conta principal não pode ser adicionada ou removida aqui.');
    const lista = obterAdministradoresV161_();
    if (operacao === 'adicionar') {
      if (!lista.includes(email)) lista.push(email);
      if (lista.length > 20) throw new Error('Limite de 20 administradores adicionais.');
    } else if (operacao === 'remover') {
      const idx = lista.indexOf(email);
      if (idx === -1) throw new Error('Esta conta não está cadastrada como administradora.');
      lista.splice(idx, 1);
    } else throw new Error('Operação desconhecida.');
    props.setProperty(MART_V161_ADMIN_LIST_PROP, JSON.stringify(lista));
    if (operacao === 'remover') {
      const uids = obterUidsAdministradoresV169_();
      delete uids[email];
      props.setProperty(MART_V169_ADMIN_UIDS_PROP, JSON.stringify(uids));
    }
    console.log('Gestão de acesso: ' + operacao + ' por ' + ator + ' para ' + email);
    return listarAdministradoresV161_();
  } finally { lock.releaseLock(); }
}

function escaparHtmlV153_(texto) {
  return String(texto || '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

/**
 * Em chamadas de web app não há planilha ativa. Abrimos somente a URL fixa acima
 * e confirmamos o ID novamente antes de qualquer operação.
 */
function obterPlanilhaVendedoresV153_() {
  if (!/^[A-Za-z0-9_-]{25,}$/.test(MART_V153_TEST_SHEET_ID)) throw new Error('Configure MART_V153_SHEET_ID antes de utilizar esta API.');
  const ss = SpreadsheetApp.openByUrl(MART_V153_TEST_SHEET_URL);
  if (!ss || ss.getId() !== MART_V153_TEST_SHEET_ID) {
    throw new Error('Proteção: a API está configurada para outra planilha. Nenhum dado foi alterado.');
  }
  const idConfigurado = String(PropertiesService.getScriptProperties().getProperty('MART_V153_SHEET_ID') || '');
  if (idConfigurado && idConfigurado !== ss.getId()) throw new Error('O ID vinculado à configuração não corresponde à planilha configurada.');
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

/** Relação opcional das filiais. Antes da primeira importação pode não existir. */
function listarFiliaisV153_(ss) {
  const sh = ss.getSheetByName(MART_V153_FILIAIS_SHEET_NAME);
  if (!sh || sh.getLastRow() < 2) return [];
  const h = sh.getRange(1, 1, 1, 2).getDisplayValues()[0];
  if (h[0] !== 'filial' || h[1] !== 'localidade') {
    throw new Error('A aba Filiais possui cabeçalhos inesperados. Nenhuma alteração realizada.');
  }
  const terceira=sh.getLastColumn()>=3?String(sh.getRange(1,3).getDisplayValue()).trim().toLowerCase():'';
  const colunas=terceira==='municipio'?3:2;
  return sh.getRange(2, 1, sh.getLastRow() - 1, colunas).getDisplayValues()
    .filter(r => /^\d+$/.test(String(r[0]).trim()) && String(r[1]).trim());
}

/** Guarda apenas o mapa numero -> nome, sem duplicar campos no cadastro. */
function sincronizarFiliaisV153_(ss, filiais) {
  if (!filiais.length) return 0;
  let sh = ss.getSheetByName(MART_V153_FILIAIS_SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(MART_V153_FILIAIS_SHEET_NAME);
    sh.getRange(1, 1, 1, 2).setValues([['filial', 'localidade']]);
  }
  const anteriores = listarFiliaisV153_(ss);
  const temMunicipio=String(sh.getRange(1,3).getDisplayValue()).toLowerCase()==='municipio';
  const mapa = new Map(anteriores.map(r => [String(r[0]), {localidade:String(r[1]),municipio:String(r[2]||'')}]));
  filiais.forEach(r => {
    const codigo=String(r.filial),prev=mapa.get(codigo)||{};
    mapa.set(codigo,{localidade:r.localidade,municipio:prev.municipio||''});
  });
  if (!filiais.some(r => String(r.filial) === '59999') &&
      /CGPI\s*\/\s*DIREX\s*\/\s*PF\s*\/\s*XX/i.test(mapa.get('59999')?.localidade||''))
    mapa.delete('59999');
  const linhas = [...mapa].sort((a,b)=>Number(a[0])-Number(b[0]));
  const qtd=Math.max(anteriores.length,linhas.length);
  if(qtd){
    const colunas=temMunicipio?3:2;
    const matriz=linhas.map(([id,v])=>temMunicipio?[id,v.localidade,v.municipio]:[id,v.localidade])
      .concat(Array.from({length:qtd-linhas.length},()=>Array(colunas).fill('')));
    sh.getRange(2,1,qtd,colunas).setNumberFormat('@').setValues(matriz);
  }
  return filiais.length;
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

  // O marcador de paginação "1" não entra na base, mesmo se o cliente enviar por engano.
  const vistos = {};
  const registros = entrada.filter(item => somenteDigitosV153_(item.matricula) !== '1').map((item, indice) => {
    const matricula = somenteDigitosV153_(item.matricula);
    const nome = textoV153_(item.nome);
    const filial = textoV153_(item.filial);
    if (!matricula || !nome || !/^\d{1,6}$/.test(filial)) throw new Error('Registro inválido na linha importada ' + (indice + 1) + ': matrícula, nome e número da filial são obrigatórios.');
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

  // Valida o mapa de filiais ANTES de qualquer gravação na planilha.
  const filiaisEntrada = Array.isArray(payload.filiais) ? payload.filiais : [];
  if (filiaisEntrada.length > 500) throw new Error('Mapa de filiais excede o limite permitido.');
  const filiaisMap = new Map();
  filiaisEntrada.forEach(item => {
    const filial = textoV153_(item.filial);
    const localidade = textoV153_(item.localidade).slice(0, 120);
    if (!/^\d{1,6}$/.test(filial) || !localidade) throw new Error('Mapa de filiais inválido.');
    if (filiaisMap.has(filial) && filiaisMap.get(filial) !== localidade) throw new Error('Localidade divergente para filial ' + filial);
    filiaisMap.set(filial, localidade);
  });
  const filiais = [...filiaisMap].map(([filial, localidade]) => ({filial, localidade}));

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const ss = obterPlanilhaVendedoresV153_();
    const sh = obterAbaVendedoresV153_(ss);
    // Se a aba existir, confira o cabeçalho antes de modificar os cadastros.
    listarFiliaisV153_(ss);
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
    const filiaisAtualizadas = sincronizarFiliaisV153_(ss, filiais);
    SpreadsheetApp.flush();
    return {
      filiaisAtualizadas,
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

function respostaPostV153_(requestId, ok, erro, resultado, parentOrigin, usarJson) {
  const dados = JSON.stringify({ tipo: 'MART_VENDEDORES_API', requestId, ok, erro: erro || '', resultado: resultado || null })
    .replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
  // A resposta JSON funciona via servidor intermediário HTTPS (sem iframe no celular).
  // O Apps Script continua validando o Firebase ID token e o administrador.
  if (usarJson) return ContentService.createTextOutput(dados).setMimeType(ContentService.MimeType.JSON);
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


/**
 * 1.6.3.2 — somente a API ADMINISTRATIVA lê os eventos armazenados no Sheets.
 * A autorização já foi validada em exigirAdministradorV160_ antes desta chamada.
 * Nunca disponibilize esta API como "Executar como eu / Qualquer pessoa".
 */
function listarEventosPortalV1632_(payload) {
  const periodo = String((payload && payload.periodo) || '30');
  if (periodo !== 'hoje' && !['7','30','90'].includes(periodo)) {
    throw new Error('Periodo invalido');
  }
  const ss = obterPlanilhaVendedoresV153_();
  const aba = ss.getSheetByName('Eventos_Portal');
  if (!aba || aba.getLastRow() <= 1) return {eventos:[], truncado:false, totalLinhas:0};
  const total = aba.getLastRow() - 1;
  const limite = 4000; // evite respostas maiores do que os quadros de mensagens do navegador
  const quantidade = Math.min(total, limite);
  const primeira = total - quantidade + 2;
  const valores = aba.getRange(primeira, 1, quantidade, 7).getValues();
  const agora = Date.now();
  const inicio = periodo === 'hoje' ? 0 : agora - Number(periodo) * 86400000;
  const hojeLocal = periodo === 'hoje'
    ? Utilities.formatDate(new Date(agora), 'America/Sao_Paulo', 'yyyyMMdd') : '';
  const eventos = [];
  for (const linha of valores) {
    const ms = Number(linha[2]);
    const ofertaId = String(linha[3] || '').trim();
    const rubi = String(linha[5] || '').replace(/\D/g, '');
    if (!Number.isFinite(ms) || ms <= 0 || ms > agora + 60000) continue;
    if (periodo === 'hoje') {
      if (Utilities.formatDate(new Date(ms), 'America/Sao_Paulo', 'yyyyMMdd') !== hojeLocal) continue;
    } else if (ms < inicio) continue;
    const tipo=String(linha[6]||'');
    if(tipo==='acesso_portal') {
      const sessao=String(linha[3]||'');
      if(!/^vis_[A-Za-z0-9_-]{8,38}$/.test(sessao)) continue;
      eventos.push({id:String(linha[0]||''),tipo:'acesso_portal',sessao,origem:String(linha[4]||'outro'),iniciadoEm:ms});
      continue;
    }
    if(tipo!=='inicio_compartilhamento')continue;
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(ofertaId) || !/^\d{3,5}$/.test(rubi)) continue;
    eventos.push({
      id:String(linha[0]||''),ofertaId, tituloOferta:String(linha[4] || 'Oferta').slice(0, 100),
      matricula:rubi, tipo:'inicio_compartilhamento', iniciadoEm:ms
    });
  }
  // Uma segunda aba armazena apenas campanha e cliques. Eventos antigos permanecem intactos.
  const meta=ss.getSheetByName('Eventos_Campanhas');
  let metaTruncada=false;
  if(meta && meta.getLastRow()>1){
    const quantidadeMeta=Math.min(meta.getLastRow()-1,4000);
    metaTruncada=meta.getLastRow()-1>quantidadeMeta;
    const linhasMeta=meta.getRange(meta.getLastRow()-quantidadeMeta+1,1,quantidadeMeta,9).getValues();
    const porId=new Map();
    for(const r of linhasMeta){
      const ms=Number(r[2]);
      if(!Number.isFinite(ms) || ms<=0 || ms>agora+60000)continue;
      if(periodo==='hoje'){
        if(Utilities.formatDate(new Date(ms),'America/Sao_Paulo','yyyyMMdd')!==hojeLocal)continue;
      }else if(ms<inicio)continue;
      const tipo=String(r[3]||'');
      const campanha=mart1614_slug_(r[6]);
      if(tipo==='clique_link'){
        const ofertaId=String(r[4]||''),matricula=String(r[5]||'').replace(/\D/g,'');
        if(/^[A-Za-z0-9_-]{1,40}$/.test(ofertaId)&&/^\d{3,5}$/.test(matricula)){
          eventos.push({id:String(r[0]||''),tipo:'clique_link',ofertaId,matricula,
            campanha,tituloOferta:String(r[8]||''),origem:'link_vendedor',iniciadoEm:ms});
        }
      }else if(tipo==='acesso_portal'||tipo==='inicio_compartilhamento'){
        porId.set(String(r[0]||''),{campanha});
      }
    }
    eventos.forEach(ev=>{if(porId.has(ev.id))ev.campanha=porId.get(ev.id).campanha;});
  }
  return {eventos, truncado:total > limite || metaTruncada, totalLinhas:total};
}

// =============================================================
// v1.6.4 — Grupo WhatsApp (planilha isolada por projeto, acesso administrativo)
// Dados oficiais continuam apenas em Vendedores. Identificações manuais
// podem alterar o telefone SOMENTE por ação explícita do administrador (v1.6.5).
// =============================================================
const MART164_GRUPO_ABA = 'WhatsApp_Atual';
const MART164_GRUPO_HEADERS = ['telefone_normalizado','nome_exibido','telefone_original','importado_em','lote_id'];
const MART164_MANUAL_ABA = 'Identificacoes_Manuais';
const MART164_MANUAL_HEADERS = ['telefone_normalizado','nome_exibido','tipo_pessoa','matricula_associada','observacao','criado_por','criado_em','atualizado_em'];

function mart164_aba_(ss, nome, headers, criar) {
  let sh = ss.getSheetByName(nome);
  if (!sh && criar) {
    sh = ss.insertSheet(nome);
    sh.getRange(1,1,1,headers.length).setNumberFormat('@').setValues([headers]);
    sh.setFrozenRows(1);
    sh.getRange(1,1,1,headers.length).setBackground('#51217a').setFontColor('#fff').setFontWeight('bold');
  }
  if (!sh) return null;
  const atuais = sh.getRange(1,1,1,headers.length).getDisplayValues()[0].map(String);
  if (headers.some((v,i) => atuais[i].trim() !== v)) {
    throw new Error('Cabeçalhos incompatíveis na aba ' + nome + '. Nada foi modificado.');
  }
  return sh;
}
function mart164_telefone_(v) { return Telefones.numero(typeof v==='string'?v:''); }

function mart164_nome_(v) {
  const n = String(v == null ? '' : v).replace(/[\x00-\x1f\x7f]+/g,' ').trim().slice(0,180);
  if (!n || /^[=+@-]/.test(n)) throw new Error('Nome inválido ou semelhante a uma fórmula. Revise a lista importada.');
  return n;
}
function mart164_lerGrupo_() {
  const sh = mart164_aba_(obterPlanilhaVendedoresV153_(),MART164_GRUPO_ABA,MART164_GRUPO_HEADERS,false);
  if (!sh || sh.getLastRow()<2) return [];
  const dados=sh.getRange(2,1,Math.min(sh.getLastRow()-1,1500),5).getDisplayValues();
  const vistos = new Set();
  return dados.filter(r => {
    const telefone = mart164_telefone_(r[0]);
    if (!telefone) return false;
    vistos.add(telefone); return true;
  }).map(r => ({telefone:mart164_telefone_(r[0]),nome:r[1],telefoneOriginal:r[2]||r[0],importadoEm:r[3]}));
}
function mart164_lerIdentificacoes_() {
  const sh = mart164_aba_(obterPlanilhaVendedoresV153_(),MART164_MANUAL_ABA,MART164_MANUAL_HEADERS,false);
  if (!sh || sh.getLastRow()<2) return [];
  const dados=sh.getRange(2,1,Math.min(sh.getLastRow()-1,3000),8).getDisplayValues();
  const vistos = new Set();
  return dados.filter(r => {
    const telefone = mart164_telefone_(r[0]);
    if (!telefone) return false;
    vistos.add(telefone); return true;
  }).map(r=>({telefone:mart164_telefone_(r[0]),nome:r[1],tipo:r[2],matricula:r[3],observacao:r[4],atualizadoEm:r[7]}));
}
function mart164_listar_() {
  const sh=obterPlanilhaVendedoresV153_().getSheetByName(MART164_GRUPO_ABA);
  return {disponivel:!!sh&&sh.getLastRow()>1,participantes:mart164_lerGrupo_(),identificacoes:mart164_lerIdentificacoes_()};
}
function mart164_importar_(payload) {
  if (!payload || payload.confirmado!==true) throw new Error('Confirme a substituição da lista antes de importar.');
  // v1.6.16: a única origem suportada é a importação revisada no painel.
  // Nunca lê uma planilha legado ou altera telefones oficiais sem confirmação.
  const origem=String(payload.origem||'colar');
  if (origem!=='colar') throw new Error('Importe a lista pelo administrador usando arquivo ou texto.');
  const entrada=Array.isArray(payload.registros)?payload.registros:[];
  if (!entrada.length || entrada.length>1500) throw new Error('Informe de 1 a 1.500 participantes com nome e telefone válidos.');
  const mapa=new Map();
  entrada.forEach((r,i)=>{
    const fone=mart164_telefone_(r.telefone);
    if (!fone) throw new Error('Telefone inválido no participante '+(i+1)+'. Inclua DDD e número.');
    const nome=mart164_nome_(r.nome);
    if (!mapa.has(fone)) mapa.set(fone,[fone,nome,String(r.telefoneOriginal||r.telefone||'').replace(/[\x00-\x1f\x7f]/g,'').slice(0,35)]);
  });
  const lock=LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const ss=obterPlanilhaVendedoresV153_();
    const sh=mart164_aba_(ss,MART164_GRUPO_ABA,MART164_GRUPO_HEADERS,true);
    const anteriores=Math.max(0,sh.getLastRow()-1);
    if (anteriores>=20 && mapa.size<anteriores*0.7 && payload.aceitarReducao!==true) {
      throw new Error('A nova lista é 30% menor que a anterior. Confirme explicitamente a redução antes de substituir.');
    }
    const agora=new Date().toISOString(); const lote=String(Date.now());
    const linhas=[...mapa.values()].map(r=>[...r,agora,lote]);
    const maior=Math.max(anteriores,linhas.length);
    // Uma escrita única: substitui linhas antigas e limpa a sobra sem apagar tudo antes.
    const matriz = linhas.concat(Array.from({length:maior-linhas.length},()=>['','','','','']));
    sh.getRange(2,1,maior,5).setNumberFormat('@').setValues(matriz);
    return {total:linhas.length,anteriores,duplicados:entrada.length-mapa.size,origem,importadoEm:agora};
  } finally {lock.releaseLock();}
}
// A padronização é uma migração NÃO destrutiva: preserva o número original da exportação
// e todos os registros de identificação. Em colisões conflitantes, recusa gravar.
function mart165_prepararTelefones_(sh, tipo) {
  if (!sh || sh.getLastRow()<2) return {anteriores:0,novas:[],alteracoes:0,duplicados:0,invalidos:[],conflitos:[]};
  const largura = tipo==='grupo' ? 5 : 8;
  const linhas=sh.getRange(2,1,sh.getLastRow()-1,largura).getDisplayValues();
  const unicos = new Map();
  const invalidos=[],conflitos=[];
  let alteracoes=0, duplicados=0;
  linhas.forEach((r,i)=>{
    if (!r.some(x=>String(x||'').trim())) return;
    const original=String(r[0]||'').trim();
    const numero=mart164_telefone_(original);
    if (!numero) {invalidos.push(i+2);return;}
    if (original!==numero) alteracoes++;
    const nova=r.slice(); nova[0]=numero;
    if (tipo==='grupo' && !String(nova[2]||'').trim()) nova[2]=original;
    if (unicos.has(numero)) {
      duplicados++;
      const anterior=unicos.get(numero);
      // Identificações manuais distintas NUNCA podem ser associadas silenciosamente.
      if (tipo==='manual' && (String(anterior[2])!==String(nova[2]) || String(anterior[3])!==String(nova[3]))) {
        conflitos.push(`Linhas com final ${numero.slice(-4)}: classificação/matrícula diferentes`);
      }
      return;
    }
    unicos.set(numero,nova);
  });
  return {anteriores:linhas.length,novas:[...unicos.values()],alteracoes,duplicados,invalidos,conflitos};
}
function mart165_normalizarExistentes_(p) {
  const executar=p && p.confirmado===true && p.simular!==true;
  const lock=LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const ss=obterPlanilhaVendedoresV153_();
    const grupo=mart164_aba_(ss,MART164_GRUPO_ABA,MART164_GRUPO_HEADERS,false);
    const manuais=mart164_aba_(ss,MART164_MANUAL_ABA,MART164_MANUAL_HEADERS,false);
    const g=mart165_prepararTelefones_(grupo,'grupo');
    const m=mart165_prepararTelefones_(manuais,'manual');
    const resumo={participantes:g.novas.length,identificacoes:m.novas.length,
      alteracoesGrupo:g.alteracoes,alteracoesManuais:m.alteracoes,duplicadosGrupo:g.duplicados,
      invalidos:g.invalidos.concat(m.invalidos.map(x=>'Identificacoes_Manuais:'+x)),
      conflitos:m.conflitos};
    if (!executar) return resumo;
    if (resumo.invalidos.length || resumo.conflitos.length) throw new Error('Existem números inválidos ou associações conflitantes. Nenhuma alteração foi aplicada.');
    [[grupo,g,5],[manuais,m,8]].forEach(([sh,plano,largura])=>{
      if (!sh || !plano.anteriores) return;
      const vazias=Array.from({length:plano.anteriores-plano.novas.length},()=>Array(largura).fill(''));
      sh.getRange(2,1,plano.anteriores,largura).setNumberFormat('@').setValues(plano.novas.concat(vazias));
    });
    return {...resumo,concluido:true};
  } finally {lock.releaseLock();}
}

const MART165_AUDITORIA_TELEFONE_ABA='Auditoria_Telefones';
const MART165_AUDITORIA_TELEFONE_HEADERS=['data_hora','administrador','matricula','telefone_anterior','telefone_novo','status_anterior','status_novo','origem'];
function mart164_salvarIdentificacao_(p,ator) {
  const telefone=mart164_telefone_(p.telefone);
  if (!telefone) throw new Error('Telefone inválido. Use DDD e número de celular.');
  const tipo=String(p.tipo||'').toUpperCase();
  if (!['VENDEDOR','GERENTE','FUNCIONARIO','OUTRO','REMOVER'].includes(tipo)) throw new Error('Classificação inválida.');
  if(p.atualizarTelefone===true)throw new Error('Associe a pessoa e use os campos pessoal/profissional no cadastro. O histórico não será substituído.');
  const atualizarTelefone=false;
  if (atualizarTelefone && (tipo!=='VENDEDOR' || p.confirmarSubstituicao!==true)) {
    throw new Error('A alteração oficial precisa ser confirmada para um vendedor.');
  }
  const matricula=String(p.matricula||'').replace(/\D/g,'');
  if (tipo==='VENDEDOR' && !/^\d{2,8}$/.test(matricula)) throw new Error('Informe uma matrícula válida.');
  const observacao=String(p.observacao||'').replace(/[\x00-\x1f\x7f]+/g,' ').trim().slice(0,220);
  if (/^[=+@-]/.test(observacao)) throw new Error('Observação inválida.');
  const lock=LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const ss=obterPlanilhaVendedoresV153_();
    const revisaoAtual=mart19_hash_(mart164_lerIdentificacoes_().filter(i=>i.telefone===telefone));
    if(p.revision!==revisaoAtual)throw new Error('CONFLITO: a identificação mudou. Reabra para revisar.');
    const participante=mart164_lerGrupo_().find(r=>r.telefone===telefone);
    if (!participante && tipo!=='REMOVER') throw new Error('Número não existe na lista atual do WhatsApp. Atualize a lista.');
    const nome=participante?.nome || 'Identificação manual';
    const vendedores=obterAbaVendedoresV153_(ss);
    let destinoVendedor=0, linhaVendedor=null;
    if (tipo==='VENDEDOR') {
      const n=Math.max(0,vendedores.getLastRow()-1);
      const linhas=n?vendedores.getRange(2,1,n,13).getDisplayValues():[];
      const encontrados=[];
      linhas.forEach((r,i)=>{if (somenteDigitosV153_(r[0])===matricula) encontrados.push(i);});
      if (encontrados.length!==1) throw new Error(encontrados.length?'Matrícula duplicada na base oficial.':'Matrícula não encontrada na base oficial.');
      destinoVendedor=encontrados[0]+2;
      linhaVendedor=linhas[encontrados[0]];
      if (atualizarTelefone) {
        const situacao=String(linhaVendedor[7]||'').toUpperCase();
        if (situacao==='INATIVO' || /INATIV|DESLIG|DEMIT|REMOVID/.test(String(linhaVendedor[6]||'').toUpperCase())) {
          throw new Error('Este cadastro está inativo. Confirme a situação antes de alterar o telefone.');
        }
        const colisao=linhas.some((r,i)=>i!==encontrados[0] && mart164_telefone_(r[4]||r[5])===telefone);
        if (colisao) throw new Error('Este telefone já consta em outra matrícula. Revise os dois cadastros antes de associar.');
      }
    }
    const sh=mart164_aba_(ss,MART164_MANUAL_ABA,MART164_MANUAL_HEADERS,true);
    const n=Math.max(0,sh.getLastRow()-1);
    const fones=n?sh.getRange(2,1,n,1).getDisplayValues().map(r=>mart164_telefone_(r[0])):[];
    const idx=fones.indexOf(telefone);
    if (tipo==='REMOVER') {
      if (idx>=0) sh.deleteRow(idx+2);
      return {telefone,removido:true};
    }
    const agora=new Date().toISOString();
    const anterior=idx>=0?sh.getRange(idx+2,1,1,8).getDisplayValues()[0]:null;
    const linha=[telefone,nome,tipo,tipo==='VENDEDOR'?matricula:'',observacao,ator,anterior?.[6]||agora,agora];
    const destino=idx>=0?idx+2:sh.getLastRow()+1;
    if (atualizarTelefone) {
      // Pré-configura a auditoria antes de alterar o cadastro oficial.
      const auditoria=mart164_aba_(ss,MART165_AUDITORIA_TELEFONE_ABA,MART165_AUDITORIA_TELEFONE_HEADERS,true);
      const antesNumero=String(linhaVendedor[4]||'');
      const antesStatus=String(linhaVendedor[12]||'PENDENTE');
      const completa=vendedores.getRange(destinoVendedor,1,1,13).getValues()[0];
      completa[4]=telefone; // DDD + 9 + 8, sem 55
      completa[5]=telefone;
      completa[10]=agora;
      completa[12]='VALIDADO'; // confirmação explícita do administrador
      gravarLinhaTextoV153_(vendedores,destinoVendedor,completa);
      sh.getRange(destino,1,1,8).setNumberFormat('@').setValues([linha]);
      auditoria.getRange(auditoria.getLastRow()+1,1,1,8).setNumberFormat('@').setValues([
        [agora,ator,matricula,antesNumero,telefone,antesStatus,'VALIDADO','WHATSAPP_CONFIRMACAO_MANUAL']
      ]);
      return {telefone,tipo,matricula,telefoneAtualizado:true,telefoneAnterior:antesNumero,atualizadoEm:agora};
    }
    sh.getRange(destino,1,1,8).setNumberFormat('@').setValues([linha]);
    return {telefone,tipo,matricula:tipo==='VENDEDOR'?matricula:'',atualizadoEm:agora,telefoneAtualizado:false};
  } finally {lock.releaseLock();}
}


// ========================================================
// 1.6.7 — Links e histórico de contatos exclusivamente no Google Sheets.
// Ambos são acessíveis apenas após a autorização Firebase + Google na API.
// ========================================================
const MART167_LINK_HEADERS = ['matricula','url_consultada','status','codigo_http','destino','verificado_em','detalhe'];
const MART167_CONTATO_HEADERS = ['contato_id','matricula','telefone','oferta_id','status_contato','data_preparacao','data_whatsapp_aberto','confirmado_em','observacao','usuario'];

function mart167_aba_(nome, cabecalhos) {
  const ss = obterPlanilhaVendedoresV153_();
  let aba = ss.getSheetByName(nome);
  if (!aba) aba = ss.insertSheet(nome);
  if (!aba.getLastRow()) {
    aba.getRange(1, 1, 1, cabecalhos.length).setValues([cabecalhos]);
    aba.setFrozenRows(1);
  } else {
    const primeira = aba.getRange(1, 1, 1, cabecalhos.length).getDisplayValues()[0];
    if (primeira.join('|') !== cabecalhos.join('|')) throw new Error('Cabeçalhos inesperados na aba ' + nome + '. Revise antes de continuar.');
  }
  return aba;
}

function mart167_listarLinks_() {
  const aba = mart167_aba_('Verificacao_Links', MART167_LINK_HEADERS);
  if (aba.getLastRow() < 2) return [];
  const linhas = aba.getRange(2, 1, aba.getLastRow() - 1, 7).getDisplayValues();
  return linhas.filter(l => /^\d{2,8}$/.test(l[0])).map(l => ({
    matricula:l[0], status:l[2], httpCode:l[3], destino:l[4], url:l[1], verificadoEm:l[5]
  })).slice(0, 2500);
}

function mart167_salvarLinks_(resultados, ator) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const aba = mart167_aba_('Verificacao_Links', MART167_LINK_HEADERS);
    const total = aba.getLastRow() - 1;
    const linhas = total ? aba.getRange(2, 1, total, 7).getDisplayValues() : [];
    const mapa = new Map(linhas.map((linha, i) => [String(linha[0]), i]));
    const agora = new Date().toISOString();
    resultados.forEach(r => {
      const rubi = somenteDigitosV153_(r.matricula);
      if (!/^\d{2,8}$/.test(rubi)) return;
      const dados = [rubi, 'https://www.martinello.com.br/parceiros/' + rubi,
        String(r.status || 'inconclusivo').slice(0, 30), String(r.httpCode || ''),
        String(r.destino || '').slice(0, 500), agora, 'Operador: ' + ator];
      r.verificadoEm = agora;
      if (mapa.has(rubi)) linhas[mapa.get(rubi)] = dados;
      else { mapa.set(rubi, linhas.length); linhas.push(dados); }
    });
    if (linhas.length) aba.getRange(2, 1, linhas.length, 7).setValues(linhas);
  } finally { lock.releaseLock(); }
}

function mart167_listarContatos_() {
  const aba = mart167_aba_('Historico_Contatos', MART167_CONTATO_HEADERS);
  const last = aba.getLastRow();
  if (last < 2) return [];
  const quantidade = Math.min(500, last - 1);
  const dados = aba.getRange(last - quantidade + 1, 1, quantidade, 10).getValues();
  return dados.filter(r => /^\d{2,8}$/.test(r[1])).map(r => ({
    matricula:String(r[1]), ofertaId:String(r[3]), status:String(r[4]),
    confirmadoEm: r[7] instanceof Date ? r[7].toISOString() : String(r[7] || '')
  }));
}

function mart167_registrarContato_(payload, ator) {
  const rubi = somenteDigitosV153_(payload.matricula);
  const ofertaId = String(payload.ofertaId || '').trim();
  if (!/^\d{2,8}$/.test(rubi)) throw new Error('Matrícula inválida.');
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(ofertaId)) throw new Error('ID da oferta inválido.');
  const shVendedores = obterAbaVendedoresV153_(obterPlanilhaVendedoresV153_());
  const linhas = shVendedores.getLastRow() > 1
    ? shVendedores.getRange(2, 1, shVendedores.getLastRow()-1, MART_V153_HEADERS.length).getDisplayValues() : [];
  const linha = linhas.find(l => somenteDigitosV153_(l[0]) === rubi);
  if (!linha) throw new Error('Vendedor não encontrado no cadastro oficial.');
  const ctx=mart19_contexto_(obterPlanilhaVendedoresV153_());
  const vendedor=ctx.registros.find(v=>v.matricula===rubi);
  if(!vendedor?.ativo)throw new Error('Cadastro inativo.');
  if(!ctx.grupo.disponivel)throw new Error('Lista do grupo indisponível.');
  const fones=Telefones.avaliar(vendedor,ctx.registros,ctx.grupo.participantes,ctx.grupo.identificacoes);
  const fone=Telefones.preferido(fones);
  if(!fone||fones.some(f=>f.conflito||f.noGrupo))throw new Error('Contato inelegível ou alterado. Atualize a fila.');
  const tel=fone.numero;
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const aba = mart167_aba_('Historico_Contatos', MART167_CONTATO_HEADERS);
    // Evitar dupla marcação no mesmo dia para a mesma matrícula/oferta.
    const hoje = Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'yyyy-MM-dd');
    const last = aba.getLastRow();
    if (last > 1) {
      const qtd = Math.min(500, last - 1);
      const recentes = aba.getRange(last - qtd + 1, 1, qtd, 10).getValues();
      const duplicado = recentes.some(l => {
        if (String(l[1]) !== rubi || String(l[3]) !== ofertaId || String(l[4]) !== 'MARCADO_PELO_OPERADOR' || !l[7]) return false;
        const data = l[7] instanceof Date ? l[7] : new Date(l[7]);
        return !isNaN(data.getTime()) && Utilities.formatDate(data, 'America/Sao_Paulo', 'yyyy-MM-dd') === hoje;
      });
      if (duplicado) return { registrado:false, duplicado:true, matricula:rubi };
    }
    // O status é uma marcação manual do operador, não confirmação de envio WhatsApp.
    const agora = new Date().toISOString();
    aba.appendRow([Utilities.getUuid(), rubi, tel, ofertaId, 'MARCADO_PELO_OPERADOR',
      '', '', agora, 'Confirmacao manual. Envio no WhatsApp nao verificado pelo sistema.', ator]);
    return { registrado:true, matricula:rubi, status:'MARCADO_PELO_OPERADOR' };
  } finally { lock.releaseLock(); }
}


// v1.6.9 — Configuração única de convite em Google Sheets.
// Não replica o cadastro de vendedores nem salva dados pessoais no navegador.
const MART169_CONFIG_CONTACTS_SHEET = 'Config_Contatos';
const MART169_DEFAULT_INVITE = 'Olá, [NOME]! Temos um grupo para compartilhar ofertas e novidades da Martinello. Gostaríamos de convidar você a participar: [LINK_GRUPO]';
function mart169_listarConfigContatos_() {
  const ss = obterPlanilhaVendedoresV153_();
  const sheet = ss.getSheetByName(MART169_CONFIG_CONTACTS_SHEET);
  const result = { linkGrupo:'', mensagemConvite: MART169_DEFAULT_INVITE };
  if (!sheet || sheet.getLastRow() < 2) return {...result,revision:mart19_hash_([result.linkGrupo,result.mensagemConvite])};
  const values = sheet.getRange(2,1,sheet.getLastRow()-1,2).getDisplayValues();
  values.forEach(row => {
    if (row[0] === 'link_grupo') result.linkGrupo = String(row[1] || '').trim();
    if (row[0] === 'mensagem_convite' && row[1]) result.mensagemConvite = String(row[1]);
  });
  return {...result,revision:mart19_hash_([result.linkGrupo,result.mensagemConvite])};
}
function mart169_salvarConfigContatos_(dados, email) {
  const linkGrupo = String(dados.linkGrupo || '').trim();
  const mensagemConvite = String(dados.mensagemConvite || '').trim();
  if (!/^https:\/\/chat\.whatsapp\.com\/[a-zA-Z0-9]+(?:\?[a-zA-Z0-9_=&%-]+)?$/.test(linkGrupo) || linkGrupo.length > 250) {
    throw new Error('Informe o link válido do grupo (https://chat.whatsapp.com/...).');
  }
  if (mensagemConvite.length < 10 || mensagemConvite.length > 1000 || !mensagemConvite.includes('[LINK_GRUPO]')) {
    throw new Error('A mensagem deve ter de 10 a 1.000 caracteres e conter [LINK_GRUPO].');
  }
  if (/^\s*=/.test(mensagemConvite)) throw new Error('A mensagem não pode começar com =.');
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const atual=mart169_listarConfigContatos_();
    if(dados.revision!==mart19_hash_([atual.linkGrupo,atual.mensagemConvite]))throw new Error('CONFLITO: o convite foi alterado. Reabra após revisar.');
    const ss = obterPlanilhaVendedoresV153_();
    let sheet = ss.getSheetByName(MART169_CONFIG_CONTACTS_SHEET);
    if (!sheet) sheet = ss.insertSheet(MART169_CONFIG_CONTACTS_SHEET);
    sheet.getRange(1,1,1,4).setValues([['chave','valor','atualizado_em','administrador']]);
    sheet.getRange(2,1,2,4).setNumberFormat('@');
    const agora = new Date().toISOString();
    sheet.getRange(2,1,2,4).setValues([
      ['link_grupo',linkGrupo,agora,email],
      ['mensagem_convite',mensagemConvite,agora,email]
    ]);
    sheet.setFrozenRows(1);
    return {linkGrupo, mensagemConvite, revision:mart19_hash_([linkGrupo,mensagemConvite])};
  } finally {lock.releaseLock();}
}

// v1.6.13 — leitura ADMINISTRATIVA de pedidos que vieram do coletor público.
// O Coletor não atualiza a base; a edição é feita pelo painel, com confirmação humana.
function mart1613_listarSolicitacoesTelefone_() {
  const ss=obterPlanilhaVendedoresV153_();
  const aba=ss.getSheetByName('Solicitacoes_Telefone');
  if(!aba||aba.getLastRow()<2)return {pedidos:[]};
  const tamanho=Math.min(200,aba.getLastRow()-1);
  const cols=aba.getLastColumn()>=8?8:6;  // antigas solicitações têm somente seis colunas
  const linhas=aba.getRange(aba.getLastRow()-tamanho+1,1,tamanho,cols).getDisplayValues();
  const vend=obterAbaVendedoresV153_(ss);
  const base=vend.getLastRow()>=2?vend.getRange(2,1,vend.getLastRow()-1,13).getDisplayValues():[];
  const status=new Map();
  for(const row of base){
    const m=String(row[0]||'').replace(/\D/g,'');
    let telefone=String(row[5]||row[4]||'').replace(/\D/g,'');
    if(telefone.length===13&&telefone.startsWith('55'))telefone=telefone.slice(2);
    if(m)status.set(m,{fone:telefone,validado:String(row[12]||'').toUpperCase()==='VALIDADO'});
  }
  const extras=new Map();
  const shF=mart1618_abaFones_(false);
  if(shF && shF.getLastRow()>1) {
    for(const r of shF.getRange(2,1,shF.getLastRow()-1,8).getDisplayValues())
      extras.set(String(r[0]),r);
  }
  return {pedidos:linhas.reverse().map(row=>{
    const rubi=String(row[2]||'').replace(/\D/g,'');
    const fone=String(row[3]||'').replace(/\D/g,'');
    const oficial=status.get(rubi),extra=extras.get(rubi);
    const tipo=String(row[6]||'').toLowerCase();
    const extraValidado=extra&&((String(extra[2])==='VALIDADO'&&String(extra[1]).replace(/\D/g,'')===fone)
      ||(String(extra[5])==='VALIDADO'&&String(extra[4]).replace(/\D/g,'')===fone));
    return {id:String(row[0]||''),criadoEm:String(row[1]||''),matricula:rubi,telefone:fone,
      tipoTelefone:['pessoal','profissional'].includes(tipo)?tipo:'legado',
      declaradoNoGrupo:String(row[7]||'').toUpperCase()==='SIM',
      resolvido:!!(extraValidado||(oficial?.validado&&oficial.fone===fone))};
  })};
}


// ================================================================
// v1.6.14 — configuração de campanha e link curto, protegida pela
// autenticação da API admin. Sem UTMs automáticas nesta etapa.
// ================================================================
const MART1614_CAMP_ABA = 'Config_Campanhas';
const MART1614_CAMP_HEADERS = ['chave','valor','atualizado_em','administrador'];
const MART1614_LINK_PADRAO = 'https://www.martinello.com.br/ofertasvendedor';
const MART1614_UTM_SOURCE_PADRAO = 'grupo_zap';
const MART1614_UTM_ID_PADRAO = 'vendedores_zap';
function mart1614_slug_(valor) {
  const v=String(valor||'').trim().toLowerCase();
  return /^[a-z0-9][a-z0-9_-]{0,59}$/.test(v) ? v : '';
}
function mart1614_linkGrupo_(valor) {
  const v=String(valor||'').trim();
  if (v.length>240 || !/^https:\/\/(?:www\.)?martinello\.com\.br\/ofertasvendedor\/?(?:\?[^#]*)?$/i.test(v))
    throw new Error('Use o link HTTPS de ofertasvendedor no domínio martinello.com.br.');
  return v;
}
function mart1614_listarCampanhas_() {
  const ss=obterPlanilhaVendedoresV153_(),sh=ss.getSheetByName(MART1614_CAMP_ABA);
  const dados={campanhaGeral:'',linkGrupo:MART1614_LINK_PADRAO,
    utmSource:MART1614_UTM_SOURCE_PADRAO,utmId:MART1614_UTM_ID_PADRAO};
  if(sh && sh.getLastRow()>=2){
    if(sh.getLastRow()>1000)throw new Error('Configuração de campanhas excedeu o limite seguro.');
    const linhas=sh.getRange(2,1,sh.getLastRow()-1,2).getDisplayValues();
    // Leitura por chave: migracoes e reordenação de linhas não apagam a campanha geral.
    for(const r of linhas){
      const chave=String(r[0]||'').trim(), valor=String(r[1]||'').trim();
      if(chave==='campanha_geral') dados.campanhaGeral=mart1614_slug_(valor);
      if(chave==='link_grupo'){try{dados.linkGrupo=mart1614_linkGrupo_(valor);}catch(_){}}
      if(chave==='utm_source')dados.utmSource=mart1614_slug_(valor)||MART1614_UTM_SOURCE_PADRAO;
      if(chave==='utm_id')dados.utmId=mart1614_slug_(valor)||MART1614_UTM_ID_PADRAO;
    }
  }
  return {...dados,revision:mart19_hash_([dados.campanhaGeral,dados.linkGrupo,dados.utmSource,dados.utmId])};
}
function mart1614_salvarCampanhas_(payload,email) {
  const geral=mart1614_slug_(payload.campanhaGeral);
  if(String(payload.campanhaGeral||'').trim() && !geral)
    throw new Error('Campanha: use até 60 letras minúsculas, números, _ ou -, sem espaços.');
  const utmSource=mart1614_slug_(payload.utmSource==null?MART1614_UTM_SOURCE_PADRAO:payload.utmSource);
  const utmId=mart1614_slug_(payload.utmId==null?MART1614_UTM_ID_PADRAO:payload.utmId);
  if(!utmSource||!utmId)throw new Error('UTM source e UTM id são obrigatórios (até 60 caracteres, letras minúsculas, números, _ ou -).');
  const link=mart1614_linkGrupo_(payload.linkGrupo||MART1614_LINK_PADRAO);
  const lock=LockService.getScriptLock();lock.waitLock(15000);
  try {
    const atual=mart1614_listarCampanhas_();
    if(String(payload.revision||'')!==atual.revision)
      throw new Error('A configuração de campanhas foi alterada em outra sessão. Atualize e revise os dados antes de salvar.');
    const ss=obterPlanilhaVendedoresV153_();
    let sh=ss.getSheetByName(MART1614_CAMP_ABA);
    if(!sh)sh=ss.insertSheet(MART1614_CAMP_ABA);
    if(sh.getLastRow()>1000)throw new Error('Configuração de campanhas excedeu o limite seguro.');
    // Confere chaves duplicadas sem sobrescrever outras configurações da planilha.
    const n=Math.max(0,sh.getLastRow()-1);
    const existing=n?sh.getRange(2,1,n,4).getDisplayValues():[];
    const keys=['campanha_geral','link_grupo','utm_source','utm_id'];
    for(const key of keys)if(existing.filter(r=>r[0]===key).length>1)
      throw new Error('Chave duplicada em Config_Campanhas: '+key+'. Corrija antes de salvar.');
    const agora=new Date().toISOString();
    const novos={campanha_geral:geral,link_grupo:link,utm_source:utmSource,utm_id:utmId};
    const changes=[];
    const proximaLinhaInicial=Math.max(1,sh.getLastRow())+1;
    for(const key of keys){
      const pos=existing.findIndex(r=>r[0]===key);
      changes.push({row:pos>=0?pos+2:proximaLinhaInicial+changes.filter(x=>x.newRow).length,
        newRow:pos<0,values:[key,novos[key],agora,email]});
    }
    // Grava somente as chaves conhecidas, sem apagar outras linhas.
    sh.getRange(1,1,1,4).setValues([MART1614_CAMP_HEADERS]);
    for(const change of changes)
      sh.getRange(change.row,1,1,4).setNumberFormat('@').setValues([change.values]);
    sh.setFrozenRows(1);
    return {...novos,campanhaGeral:geral,linkGrupo:link,utmSource,utmId,
      revision:mart19_hash_([geral,link,utmSource,utmId])};
  }finally{lock.releaseLock();}
}

// ============================================
// v1.6.15 — Auditoria administrativa / Backup
// Isolado do coletor público de eventos e da API Cloudflare.
// ============================================
const MART_1615_AUDITORIA_ABA = 'Auditoria_Admin';
const MART_1615_AUDITORIA_CABECALHOS = ['data_utc','administrador','origem','operacao','referencia','resumo','request_id'];
const MART_1615_BACKUP_FOLDER_PROP = 'MART1615_BACKUP_FOLDER_'+(PropertiesService.getScriptProperties().getProperty('MART_AMBIENTE')==='OFICIAL'?'OFICIAL':'TESTE');

function mart1615_celulaSegura_(texto, max) {
  // Previne injeção de fórmulas quando dados externos acabam no Sheets.
  let valor=String(texto == null ? '' : texto).replace(/[\r\n\t]/g,' ').trim().slice(0,max || 160);
  return /^[=+\-@]/.test(valor) ? "'" + valor : valor;
}
function mart1615_eventoAuditavel_(acao,payload,resultado) {
  payload=payload || {};
  const matriz={
    salvarCadastroCompleto:'cadastro_e_telefones_editados',
    salvarCadastroGerente:'cadastro_gerente_atualizado',
    criarSolicitacaoGerente:'solicitacao_gerente_criada',
    atualizarSolicitacaoGerente:'solicitacao_gerente_processada',
    salvarVendedor:'vendedor_editado', criarVendedor:'vendedor_criado',
    importarFuncionarios:'vendedores_importados', importarWhatsApp:'grupo_importado',
    normalizarWhatsApp:'whatsapp_normalizado',salvarIdentificacaoWhatsApp:'identificacao_whatsapp',
    salvarCampanhas:'campanha_alterada', salvarConfigContatos:'convite_alterado',
    adicionarAdministrador:'administrador_adicionado',removerAdministrador:'administrador_removido',
    registrarAuditoriaFirebase:'evento_firebase_declarado',criarBackupPlanilha:'backup_planilha_criado'
  };
  if (!Object.prototype.hasOwnProperty.call(matriz,acao)) return null;
  let alvo='',resumo='Alteração administrativa';
  if(acao==='salvarCadastroGerente') {
    alvo=String(payload.matricula||'').replace(/\D/g,'').slice(0,10);
    resumo='Cadastro de gerente atualizado';
  } else if(acao==='criarSolicitacaoGerente') {
    alvo=String(payload.matriculaVendedor||'').replace(/\D/g,'').slice(0,10);
    resumo=payload.contratoTemporario===true?'Solicitação CT Temporário':'Solicitação de cadastro/telefone';
  } else if(acao==='atualizarSolicitacaoGerente') {
    alvo=String(payload.id||'').slice(0,50);resumo='Solicitação de gerente processada';
  } else if (acao==='salvarCadastroCompleto'||acao==='salvarVendedor'||acao==='criarVendedor') {
    alvo=String(payload.matricula||'').replace(/\D/g,'').slice(0,10);
    const campos=Array.isArray(resultado&&resultado.camposAlterados)?resultado.camposAlterados:[];
    resumo=campos.length?'Campos: '+campos.join(', '):'Cadastro de vendedor atualizado';
  } else if (acao==='importarFuncionarios') {
    resumo='Importação de vendedores'; alvo=String(Array.isArray(payload.registros)?payload.registros.length:0) + ' registros';
  } else if (acao==='importarWhatsApp') {
    resumo='Importação da base de participantes'; alvo='grupo';
  } else if (acao==='normalizarWhatsApp'||acao==='salvarIdentificacaoWhatsApp') {
    alvo='grupo';resumo='Revisão de participantes';
  } else if (acao==='salvarCampanhas') {alvo='campanha_geral';resumo='Campanha atualizada';}
  else if (acao==='salvarConfigContatos') {alvo='convite_grupo';resumo='Modelo de convite atualizado';}
  else if (acao==='adicionarAdministrador'||acao==='removerAdministrador') {
    alvo=String(payload.email||'').trim().slice(0,200);resumo='Permissão administrativa alterada';
  } else if (acao==='registrarAuditoriaFirebase') {
    alvo=String(resultado.alvo||'').slice(0,100);
    resumo=(String(resultado.tipo||'')+' '+(resultado.campos&&resultado.campos.length?'Campos: '+resultado.campos.join(', '):'')).slice(0,200); // Relato do cliente, não prova transacional
  } else if (acao==='criarBackupPlanilha') {alvo='planilha';resumo='Cópia de segurança no Drive';}
  return {origem:acao==='registrarAuditoriaFirebase'?'cliente_declarado':'servidor',acao:matriz[acao],alvo,resumo};
}
function mart1615_validarRelatoFirebase_(p) {
  const tipos=['oferta_criada','oferta_editada','oferta_excluida','aparencia_alterada'];
  const tipo=String((p||{}).tipo||'');
  const alvo=String((p||{}).alvo||'');
  if (!tipos.includes(tipo)|| !/^[a-zA-Z0-9_\-]{1,100}$/.test(alvo)) throw new Error('Registro de auditoria inválido.');
  const campos=Array.isArray(p.campos)?p.campos:[];
  const permitidos=['dataInicio','dataFim','linkProduto','textoOferta','tituloPagina','campanha','urlImagem',
    'sku','rascunho','destaqueDia','destaqueInicio','destaqueFim'];
  if(campos.length>12 || campos.some(x=>!permitidos.includes(x)))throw new Error('Campos de auditoria inválidos.');
  return {tipo,alvo,campos:[...new Set(campos)]};
}
function mart1615_abaAuditoria_() {
  const ss=obterPlanilhaVendedoresV153_();
  let sh=ss.getSheetByName(MART_1615_AUDITORIA_ABA);
  if (!sh) {
    sh=ss.insertSheet(MART_1615_AUDITORIA_ABA);
    sh.getRange(1,1,1,MART_1615_AUDITORIA_CABECALHOS.length).setValues([MART_1615_AUDITORIA_CABECALHOS]);
    sh.setFrozenRows(1);
  }
  return sh;
}
function mart1615_gravarAuditoria_(email,origem,acao,alvo,resumo,requestId) {
  const lock=LockService.getScriptLock();lock.waitLock(15000);
  try {
    const sh=mart1615_abaAuditoria_();
    sh.appendRow([
      new Date().toISOString(),
      mart1615_celulaSegura_(email,254),
      mart1615_celulaSegura_(origem,35),
      mart1615_celulaSegura_(acao,80),
      mart1615_celulaSegura_(alvo,200),
      mart1615_celulaSegura_(resumo,200),
      mart1615_celulaSegura_(requestId,100)
    ]);
  } finally {lock.releaseLock();}
}
function mart1615_listarAuditoria_() {
  const sh=obterPlanilhaVendedoresV153_().getSheetByName(MART_1615_AUDITORIA_ABA);
  if(!sh||sh.getLastRow()<2) return {eventos:[], total:0};
  const total=sh.getLastRow()-1;
  const maximo=150;
  const inicio=Math.max(2,sh.getLastRow()-maximo+1);
  const rows=sh.getRange(inicio,1,sh.getLastRow()-inicio+1,MART_1615_AUDITORIA_CABECALHOS.length).getDisplayValues();
  return {eventos:rows.reverse().map(r=>({data:r[0],ator:r[1],origem:r[2],acao:r[3],alvo:r[4],resumo:r[5]})),total};
}
function mart1615_criarBackupPlanilha_(email) {
  // Backup privado e manual: cópia integral da planilha no Drive do proprietário.
  // Não expõe conteúdo ao navegador/Cloudflare, apenas o link do arquivo criado.
  const lock=LockService.getScriptLock();lock.waitLock(20000);
  try {
    const props=PropertiesService.getScriptProperties();
    const ss=obterPlanilhaVendedoresV153_();
    let folder;
    const salvo=props.getProperty(MART_1615_BACKUP_FOLDER_PROP);
    if (salvo) folder=DriveApp.getFolderById(salvo);
    else {
      folder=DriveApp.createFolder('Martinello_BACKUPS_'+(PropertiesService.getScriptProperties().getProperty('MART_AMBIENTE')==='OFICIAL'?'OFICIAL':'TESTE')+'_PRIVADOS');
      props.setProperty(MART_1615_BACKUP_FOLDER_PROP,folder.getId());
    }
    // O destino é uma pasta criada no Drive do proprietário, não uma pasta pública.
    const nome='Backup_Martinello_'+(PropertiesService.getScriptProperties().getProperty('MART_AMBIENTE')==='OFICIAL'?'OFICIAL':'TESTE')+'_'+Utilities.formatDate(new Date(),'GMT','yyyyMMdd_HHmmss');
    const copia=DriveApp.getFileById(ss.getId()).makeCopy(nome,folder);
    try {
      if (copia.getSharingAccess() !== DriveApp.Access.PRIVATE) {
        copia.setSharing(DriveApp.Access.PRIVATE,DriveApp.Permission.NONE);
      }
      if(copia.getSharingAccess() !== DriveApp.Access.PRIVATE)throw new Error('O backup não ficou privado.');
    }catch(erroPermissao) {
      // Não deixar cópia com compartilhamento amplo em caso de falha.
      copia.setTrashed(true);
      throw new Error('Não foi possível garantir privacidade do backup no Drive.');
    }
    return {nome:copia.getName(),url:copia.getUrl(),criadoEm:new Date().toISOString(),escopo:'planilha_completa'};
  } finally {lock.releaseLock();}
}

/** Execute uma única vez no editor do Apps Script administrativo para autorizar o Drive. */
function autorizarBackupDriveV1615() {
  const ss=obterPlanilhaVendedoresV153_();
  return DriveApp.getFileById(ss.getId()).getName();
}


// v1.6.18 — segunda linha de contato POR MATRICULA, sem modificar as 13 colunas da base.
// O telefone antigo permanece intacto até revisão manual. O cadastro de telefone extra
// não altera status de validação antiga nem deduz presença no grupo por declaração.
const MART1618_FONES_ABA='Telefones_Vendedores';
const MART1618_FONES_CAB=['matricula','telefone_pessoal','status_pessoal','declarado_grupo_pessoal',
  'telefone_profissional','status_profissional','declarado_grupo_profissional','atualizado_em'];
function mart1618_abaFones_(criar) {
  const ss=obterPlanilhaVendedoresV153_();
  let sh=ss.getSheetByName(MART1618_FONES_ABA);
  if(!sh && criar) {
    sh=ss.insertSheet(MART1618_FONES_ABA);
    sh.getRange(1,1,1,MART1618_FONES_CAB.length).setValues([MART1618_FONES_CAB]);
    sh.getRange('A:G').setNumberFormat('@');sh.setFrozenRows(1);
  }
  if(!sh)return null;
  const h=sh.getRange(1,1,1,8).getDisplayValues()[0];
  if(h.join('|')!==MART1618_FONES_CAB.join('|'))throw new Error('Cabeçalho de Telefones_Vendedores inesperado. Nada foi modificado.');
  return sh;
}
function mart1618_listarTelefones_() {
  const sh=mart1618_abaFones_(false);
  if(!sh||sh.getLastRow()<2)return {registros:[]};
  return {registros:sh.getRange(2,1,sh.getLastRow()-1,8).getDisplayValues()
    .filter(r=>/^\d{3,5}$/.test(String(r[0]||'')))};
}
function mart1618_foneValido_(s) { return Telefones.valido(s); }
