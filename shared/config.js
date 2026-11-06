/**
 * Martinello v1.6.17 — IDENTICO nos repositorios de homologacao e oficial.
 * Configuracao de dois ambientes — publicar o MESMO arquivo nos dois GitHub Pages:
 * este arquivo e publico: nao inclua segredos, service accounts ou tokens nele.
 * Identificacao estrita por hostname + nome do repositorio.
 */
const MART_SITES = Object.freeze({
  githubHost: 'e-commerce-martinello.github.io',
  repositorioTeste: 'Ofertas-Dos-Vendedores-Teste',
  repositorioOficial: 'Ofertas-Dos-Vendedores' // SOMENTE o nome, sem https://
});

const MART_SERVICOS = Object.freeze({
  TESTE: {
    firebase: {
      apiKey: 'AIzaSyAO82H7GdseiIDD4VQVzVUk1pE25uCPJZM',
      authDomain: 'ofertas-do-vendedor.firebaseapp.com',
      projectId: 'ofertas-do-vendedor',
      databaseURL: 'https://ofertas-do-vendedor-default-rtdb.firebaseio.com',
      storageBucket: 'ofertas-do-vendedor.firebasestorage.app',
      messagingSenderId: '139304759090',
      appId: '1:139304759090:web:8dbc12dce295ff3c55312b'
    },
    adminApiUrl: 'https://script.google.com/macros/s/AKfycbwhjDIBES-sLK0ZVBkdqZkuMXuVw8YLjWKU08ahoN_Oy1_hrMEnyQeHnrLsuvasmNzr/exec',
    adminProxyUrl: 'https://martinello-admin-teste.loan-martinello.workers.dev/',
    portalEventsApiUrl: 'https://script.google.com/macros/s/AKfycbzXPgbhDvQBhvj-VkiwOpvLyn6kPONPfBgeD0y16idC0nQW7rfYP4kHG5msxhv05uD-/exec'
  },
  OFICIAL: {
    firebase: {
      apiKey: 'AIzaSyDZtwRckqWbiRG3veOFZxnFZ-RYvnSjUO4',
      authDomain: 'portal-de-oferta.firebaseapp.com',
      databaseURL: 'https://portal-de-oferta-default-rtdb.firebaseio.com',
      projectId: 'portal-de-oferta',
      storageBucket: 'portal-de-oferta.firebasestorage.app',
      messagingSenderId: '812360973251',
      appId: '1:812360973251:web:44aae58487d875e05b5b76'
    },
    adminApiUrl: 'https://script.google.com/macros/s/AKfycbz1SB3U3gQ6HYOHTpcBjEz9AS3VAfoLtkxHKr9cD9N88Y6J7Gdvgjthwc58puphD5GE/exec',
    adminProxyUrl: 'https://martinello-admin.loan-martinello.workers.dev/',
    portalEventsApiUrl: 'https://script.google.com/macros/s/AKfycbw8oVDx9lR68YvX2avFb0zK7f1JyMp2RpB3C5T4RfCDP9s0VJsq-2tKgrzMV38PloxRWA/exec'
  }
});

function MART_escolherAmbiente(hostname,pathname){
  const host=String(hostname||'').toLowerCase();
  const repo=String(pathname||'').split('/')[1]||'';
  if(host!==MART_SITES.githubHost) throw new Error('Endereco nao cadastrado para o Portal Martinello.');
  if(repo===MART_SITES.repositorioTeste) return 'TESTE';
  if(repo===MART_SITES.repositorioOficial) return 'OFICIAL';
  throw new Error('Repositorio GitHub nao reconhecido. Configure o nome do repositorio oficial em shared/config.js.');
}

const MART_AMBIENTE = MART_escolherAmbiente(window.location.hostname,window.location.pathname);
const MART_SERVICO_ATUAL = MART_SERVICOS[MART_AMBIENTE];

// Impede que o projeto, Worker, API ou coletor acidentalmente apontem para o outro ambiente.
function MART_validarSeparacao(servicos) {
  const a=servicos.TESTE,b=servicos.OFICIAL;
  for(const chave of ['adminApiUrl','adminProxyUrl','portalEventsApiUrl']) {
    if(a[chave] && b[chave] && !a[chave].startsWith('PREENCHER_') && !b[chave].startsWith('PREENCHER_') && a[chave]===b[chave])
      throw new Error('ERRO DE CONFIGURACAO: o servico '+chave+' e compartilhado entre TESTE e OFICIAL.');
  }
  if(a.firebase.projectId && b.firebase.projectId && !b.firebase.projectId.startsWith('PREENCHER_') && a.firebase.projectId===b.firebase.projectId)
    throw new Error('ERRO DE CONFIGURACAO: Firebase de TESTE e OFICIAL nao podem ser o mesmo projeto.');
}
MART_validarSeparacao(MART_SERVICOS);

// Servicos obrigatorios: bloqueia uma publicacao incompleta, em vez de cair
// silenciosamente em outra API, outro Worker ou em dados locais desatualizados.
function MART_validarConfiguracaoAtiva(ambiente,servicos) {
  const erros=[];
  const validar=(campo,regex)=>{
    const valor=String(servicos[campo]||'');
    if(valor.startsWith('PREENCHER_') || !regex.test(valor)) erros.push(campo);
  };
  validar('adminApiUrl', /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/);
  validar('portalEventsApiUrl', /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/);
  validar('adminProxyUrl', /^https:\/\/[A-Za-z0-9.-]+\.workers\.dev\/?$/);
  if(erros.length) throw new Error('CONFIGURACAO '+ambiente+' INCOMPLETA: preencher '+erros.join(', ')+' em shared/config.js.');
}
MART_validarConfiguracaoAtiva(MART_AMBIENTE,MART_SERVICO_ATUAL);

const CONFIG = Object.freeze({
  environment: MART_AMBIENTE,
  environmentLabel: MART_AMBIENTE==='OFICIAL'?'PORTAL OFICIAL':'AMBIENTE DE HOMOLOGACAO',
  portalRole: MART_AMBIENTE==='OFICIAL'?'PRINCIPAL':'HOMOLOGACAO',
  firebaseConfig: Object.freeze({...MART_SERVICO_ATUAL.firebase}),
  adminApiUrl: MART_SERVICO_ATUAL.adminApiUrl,
  adminProxyUrl: MART_SERVICO_ATUAL.adminProxyUrl,
  portalEventsApiUrl: MART_SERVICO_ATUAL.portalEventsApiUrl,
  googleFormUrl:'https://docs.google.com/forms/d/e/1FAIpQLSfdheHBbGMCLIXXAeM0b8rTbpextHznj6BDS6lKGLN9ZMjd4g/formResponse',
  entryIdCodigo:'entry.200360405',
  entryIdBrowser:'entry.2003110990',
  suporteWhatsApp:'556598115091',
  maxImageSize:5*1024*1024,
  imagensPermitidas:['image/png','image/jpeg','image/gif'],
  rastreioTimeout:5000,
  rastreioFormularioLegado:false,
  urlBase:'https://www.martinello.com.br/parceiros/',
  CACHE_VERSION:'1.6.17',
  SESSION_KEY:'adminSessao_'+MART_AMBIENTE,
  MAX_TENTATIVAS:5,
  BLOQUEIO_MS:5*60*1000,
  SESSAO_EXPIRA_MS:4*60*60*1000
});
