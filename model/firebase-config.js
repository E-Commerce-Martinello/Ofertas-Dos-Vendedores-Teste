// Martinello 1.6.17 — Firebase selecionado por shared/config.js, identico nos dois repositorios.
if (typeof CONFIG === 'undefined' || !CONFIG.firebaseConfig) throw new Error('shared/config.js deve ser carregado antes do Firebase.');
const firebaseConfig = CONFIG.firebaseConfig;
for (const campo of ['apiKey','authDomain','projectId','appId','messagingSenderId']) {
    if (!firebaseConfig[campo] || String(firebaseConfig[campo]).startsWith('PREENCHER_'))
        throw new Error('Firebase '+CONFIG.environment+': configure '+campo+' em shared/config.js antes de publicar.');
}
if (firebaseConfig.databaseURL && String(firebaseConfig.databaseURL).startsWith('PREENCHER_'))
    throw new Error('Firebase '+CONFIG.environment+': configure databaseURL em shared/config.js.');
if (firebase.apps.length && firebase.app().options.projectId !== firebaseConfig.projectId)
    throw new Error('Projeto Firebase em uso nao corresponde ao ambiente configurado.');
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const database = firebase.database();
// Mantem compatibilidade dos dados ja existentes na homologacao, com projetos separados.
const MART_PORTAL_PRINCIPAL = CONFIG.environment === 'OFICIAL' && CONFIG.portalRole === 'PRINCIPAL';
const sufixoAmbiente = CONFIG.environment === 'TESTE' ? '_TESTE' : '';
const ofertasRef = database.ref('ofertasMartinello'+sufixoAmbiente);
