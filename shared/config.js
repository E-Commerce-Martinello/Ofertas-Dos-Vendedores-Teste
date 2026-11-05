// ============================================
// shared/config.js — CONFIGURAÇÕES GLOBAIS
// ============================================
const CONFIG = Object.freeze({
    googleFormUrl:    'https://docs.google.com/forms/d/e/1FAIpQLSfdheHBbGMCLIXXAeM0b8rTbpextHznj6BDS6lKGLN9ZMjd4g/formResponse',
    entryIdCodigo:    'entry.200360405',
    entryIdBrowser:   'entry.2003110990',
    suporteWhatsApp:  '556598115091',
    maxImageSize:     5 * 1024 * 1024,
    imagensPermitidas: ['image/png', 'image/jpeg', 'image/gif'],
    rastreioTimeout:  5000,
    urlBase:          'https://www.martinello.com.br/parceiros/',

    // Cache — mude o número a cada atualização para limpar cache dos vendedores
    CACHE_VERSION:    '1.6.3.2',
    // AMBIENTE DE TESTE: esta versão aponta somente para a cópia de desenvolvimento.
    environment: 'TESTE',
    environmentLabel: 'AMBIENTE DE TESTE',
    googleSpreadsheetId: '127G49HueMod1v-bHP66Ci4X1bpP4sIhRPZRO0JJKxdA',

    // URL da API de teste: endereço de serviço público (NÃO é uma senha).
    // Se a implantação /exec mudar, altere somente esta linha.
    adminApiUrl: 'https://script.google.com/macros/s/AKfycbwhjDIBES-sLK0ZVBkdqZkuMXuVw8YLjWKU08ahoN_Oy1_hrMEnyQeHnrLsuvasmNzr/exec',
    adminProxyUrl: 'https://martinello-admin.loan-martinello.workers.dev',

    // Registro público: cole aqui a URL /exec do Apps Script SEPARADO de eventos.
    // Não reutilize a API administrativa. A URL é pública, não é segredo.
    portalEventsApiUrl: 'https://script.google.com/macros/s/AKfycbw8oVDx9lR68YvX2avFb0zK7f1JyMp2RpB3C5T4RfCDP9s0VJsq-2tKgrzMV38PloxRWA/exec',

    // Admin
    SESSION_KEY:      'adminSessao',
    MAX_TENTATIVAS:   5,
    BLOQUEIO_MS:      5 * 60 * 1000,   // 5 min
    SESSAO_EXPIRA_MS: 4 * 60 * 60 * 1000, // 4h
});
