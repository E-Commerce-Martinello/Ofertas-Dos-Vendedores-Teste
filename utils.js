// ============================================
// utils.js - FUNÇÕES UTILITÁRIAS
// ============================================

// Formatação de texto
function formatarTexto(texto, link, codigo) {
    return texto
        .replace('[LINK]', link)
        .replace('[CODIGO]', codigo);
}

// Validações
function validarMatricula(input) {
    let valor = input.value.replace(/\D/g, '').replace(/^0+/, '');
    input.value = valor;
    return valor;
}

function validarImagem(file) {
    if (!file) return { valido: false, erro: 'Nenhum arquivo selecionado' };
    
    if (file.size > CONFIG.maxImageSize) {
        return { valido: false, erro: 'Imagem muito grande (máx 5MB)' };
    }
    
    if (!CONFIG.imagensPermitidas.includes(file.type)) {
        return { valido: false, erro: 'Formato não permitido (use PNG, JPG ou GIF)' };
    }
    
    return { valido: true };
}

// Identificação do navegador (mais leve)
function getBrowserName() {
    const ua = navigator.userAgent;
    
    if (ua.includes('SamsungBrowser')) return 'Samsung Internet';
    if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Chrome';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
    if (ua.includes('Edg')) return 'Edge';
    if (ua.includes('OPR') || ua.includes('Opera')) return 'Opera';
    
    return 'Outro';
}

// Debounce para evitar execuções repetidas
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Throttle para limitar execuções
function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}
