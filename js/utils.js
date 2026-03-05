// ============================================
// utils.js - FUNÇÕES UTILITÁRIAS
// ============================================

// Formatação de texto
function formatarTexto(texto, link, codigo) {
    return texto
        .replace('[LINK]', link)
        .replace('[CODIGO]', codigo);
}

// ============================================
// utils.js - FUNÇÕES UTILITÁRIAS
// ============================================

// Validar matrícula (apenas números, máximo 5 dígitos)
function validarMatricula(input) {
    // Remove qualquer caractere que não seja número
    let valor = input.value.replace(/\D/g, '');
    
    // Remove zeros à esquerda
    valor = valor.replace(/^0+/, '');
    
    // LIMITE DE 5 CARACTERES
    if (valor.length > 5) {
        valor = valor.slice(0, 5);
    }
    
    input.value = valor;
}

// Exportar para uso global
window.validarMatricula = validarMatricula;

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
