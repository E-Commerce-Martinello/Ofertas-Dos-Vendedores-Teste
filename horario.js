// ============================================
// model/horario.js — DATA/HORA (BRASÍLIA)
// ============================================

function getHorarioBrasilia() {
    const agora = new Date();
    const partes = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric', month: 'numeric', day: 'numeric',
        hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false
    }).formatToParts(agora);

    let ano, mes, dia, hora, minuto, segundo;
    partes.forEach(p => {
        if (p.type === 'year')   ano     = parseInt(p.value);
        if (p.type === 'month')  mes     = parseInt(p.value);
        if (p.type === 'day')    dia     = parseInt(p.value);
        if (p.type === 'hour')   hora    = parseInt(p.value);
        if (p.type === 'minute') minuto  = parseInt(p.value);
        if (p.type === 'second') segundo = parseInt(p.value);
    });
    return new Date(ano, mes - 1, dia, hora, minuto, segundo);
}

function formatarBrasilia(data) {
    if (!data) return 'Data inválida';
    try {
        const d = typeof data === 'string' ? new Date(data) : data;
        if (isNaN(d)) return 'Data inválida';
        const dd  = String(d.getDate()).padStart(2, '0');
        const mm  = String(d.getMonth() + 1).padStart(2, '0');
        const hh  = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        const ss  = String(d.getSeconds()).padStart(2, '0');
        return `${dd}/${mm}/${d.getFullYear()} ${hh}:${min}:${ss}`;
    } catch { return 'Data inválida'; }
}

function formatarParaInput(data) {
    if (!data) return '';
    try {
        const d = typeof data === 'string' ? new Date(data) : data;
        if (isNaN(d)) return '';
        const mm  = String(d.getMonth() + 1).padStart(2, '0');
        const dd  = String(d.getDate()).padStart(2, '0');
        const hh  = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        return `${d.getFullYear()}-${mm}-${dd}T${hh}:${min}`;
    } catch { return ''; }
}

function isOfertaAtiva(oferta, agora) {
    if (!oferta?.dataInicio || !oferta?.dataFim) return false;
    const ini = new Date(oferta.dataInicio);
    const fim = new Date(oferta.dataFim);
    return !isNaN(ini) && !isNaN(fim) && agora >= ini && agora <= fim;
}

function countdownTexto(dataFim) {
    const diff = new Date(dataFim) - getHorarioBrasilia();
    if (diff <= 0) return null;
    const h  = Math.floor(diff / 3600000);
    const m  = Math.floor((diff % 3600000) / 60000);
    if (h > 0) return `${h}h ${m}min`;
    return `${m}min`;
}
