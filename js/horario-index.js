// ============================================
// horario-index.js - FUNÇÕES PARA O INDEX
// Tudo em horário de Brasília
// ============================================

// ============================================
// FUNÇÃO: Obter horário atual de Brasília
// ============================================
function getHorarioBrasilia() {
    const agora = new Date();
    
    // Usar Intl para pegar a hora exata de Brasília
    const options = {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false
    };
    
    const partes = new Intl.DateTimeFormat('pt-BR', options).formatToParts(agora);
    
    let ano, mes, dia, hora, minuto, segundo;
    
    partes.forEach(part => {
        if (part.type === 'year') ano = parseInt(part.value);
        if (part.type === 'month') mes = parseInt(part.value);
        if (part.type === 'day') dia = parseInt(part.value);
        if (part.type === 'hour') hora = parseInt(part.value);
        if (part.type === 'minute') minuto = parseInt(part.value);
        if (part.type === 'second') segundo = parseInt(part.value);
    });
    
    // Criar data no horário LOCAL (já interpreta como Brasília)
    return new Date(ano, mes-1, dia, hora, minuto, segundo);
}

// ============================================
// FUNÇÃO: Formatar data para exibição (já em Brasília)
// ============================================
function formatarBrasilia(data) {
    if (!data) return 'Data inválida';
    
    try {
        const dataObj = typeof data === 'string' ? new Date(data) : data;
        
        if (isNaN(dataObj.getTime())) return 'Data inválida';
        
        // Extrair componentes locais (já estão em Brasília)
        const dia = String(dataObj.getDate()).padStart(2, '0');
        const mes = String(dataObj.getMonth() + 1).padStart(2, '0');
        const ano = dataObj.getFullYear();
        const hora = String(dataObj.getHours()).padStart(2, '0');
        const minuto = String(dataObj.getMinutes()).padStart(2, '0');
        const segundo = String(dataObj.getSeconds()).padStart(2, '0');
        
        return `${dia}/${mes}/${ano} ${hora}:${minuto}:${segundo}`;
    } catch (e) {
        return 'Data inválida';
    }
}

// ============================================
// FUNÇÃO: DEBUG (opcional)
// ============================================
function debugHorarioIndex() {
    console.log('\n=== DEBUG HORARIO INDEX ===');
    const agora = getHorarioBrasilia();
    console.log('🕒 Agora (objeto):', agora);
    console.log('🕒 Agora (ISO):', agora.toISOString());
    console.log('🕒 Agora (formatado):', formatarBrasilia(agora));
    console.log('🕒 Timezone offset:', agora.getTimezoneOffset());
    console.log('=== FIM DEBUG ===\n');
}
