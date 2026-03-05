// ============================================
// horario-admin.js - FUNÇÕES PARA O ADMIN
// Tudo em horário de Brasília
// ============================================

// ============================================
// FUNÇÃO: Obter horário atual de Brasília (para status na lista)
// ============================================
function getHorarioBrasilia() {
    const agora = new Date();
    
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
        
        // MESMA LÓGICA DO INDEX!
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
// FUNÇÃO: Formatar para input (formato yyyy-mm-ddThh:mm)
// ============================================
function formatarParaInput(data) {
    if (!data) return '';
    
    try {
        const dataObj = typeof data === 'string' ? new Date(data) : data;
        
        if (isNaN(dataObj.getTime())) return '';
        
        const ano = dataObj.getFullYear();
        const mes = String(dataObj.getMonth() + 1).padStart(2, '0');
        const dia = String(dataObj.getDate()).padStart(2, '0');
        const hora = String(dataObj.getHours()).padStart(2, '0');
        const minuto = String(dataObj.getMinutes()).padStart(2, '0');
        
        return `${ano}-${mes}-${dia}T${hora}:${minuto}`;
    } catch (e) {
        return '';
    }
}

// ============================================
// FUNÇÃO: DEBUG (opcional)
// ============================================
function debugHorarioAdmin() {
    console.log('\n=== DEBUG HORARIO ADMIN ===');
    const agora = getHorarioBrasilia();
    console.log('🕒 Agora (objeto):', agora);
    console.log('🕒 Agora (formatado):', formatarBrasilia(agora));
    console.log('🕒 Agora (input):', formatarParaInput(agora));
    console.log('=== FIM DEBUG ===\n');
}
