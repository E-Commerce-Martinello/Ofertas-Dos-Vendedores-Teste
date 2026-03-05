// ============================================
// config.js - CONFIGURAÇÕES GLOBAIS
// ============================================
const CONFIG = {
    // URLs e endpoints
    googleFormUrl: "https://docs.google.com/forms/d/e/1FAIpQLSfdheHBbGMCLIXXAeM0b8rTbpextHznj6BDS6lKGLN9ZMjd4g/formResponse",
    entryIdCodigo: "entry.200360405",
    entryIdBrowser: "entry.2003110990",
    
    // Contatos
    suporteWhatsApp: "556598115091",
    mensagemSuporte: "Olá! Preciso de ajuda.",
    
    // Limites
    maxImageSize: 5 * 1024 * 1024, // 5MB
    imagensPermitidas: ['image/png', 'image/jpeg', 'image/gif'],
    
    // Timeouts
    rastreioTimeout: 5000, // 5 segundos
    autoRefreshInterval: 30000, // 30 segundos
    
    // URLs padrão
    urlBase: "https://www.martinello.com.br/parceiros/",
    
    // Fusos
    fusoBrasilia: -3 // UTC-3
};

// Congelar objeto para evitar alterações
Object.freeze(CONFIG);
