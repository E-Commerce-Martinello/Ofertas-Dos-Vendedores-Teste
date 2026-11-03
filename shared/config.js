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
    CACHE_VERSION:    '1.6',

    // Admin
    SESSION_KEY:      'adminSessao',
    MAX_TENTATIVAS:   5,
    BLOQUEIO_MS:      5 * 60 * 1000,   // 5 min
    SESSAO_EXPIRA_MS: 4 * 60 * 60 * 1000, // 4h
});
