// ============================================
// shared/utils.js — UTILITÁRIOS PUROS
// ============================================

function formatarTexto(texto, link, codigo) {
    return texto.replace('[LINK]', link).replace('[CODIGO]', codigo);
}

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

function debounce(fn, wait) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
}

// SHA-256 via Web Crypto API (nativo, sem dependências)
async function sha256(texto) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
