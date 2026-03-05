// ============================================
// horario-index.js - FUNÇÕES PARA O INDEX
// ============================================

// Obter horário atual de Brasília (para COMPARAÇÃO)
function getHorarioBrasilia() {
    const agora = new Date();
    
    // Pegar UTC real
    const utcReal = Date.UTC(
        agora.getUTCFullYear(),
        agora.getUTCMonth(),
        agora.getUTCDate(),
        agora.getUTCHours(),
        agora.getUTCMinutes(),
        agora.getUTCSeconds()
    );
    
    // Brasília = UTC - 3
    return new Date(utcReal - (3 * 60 * 60 * 1000));
}

// FORMATAR para EXIBIÇÃO no index (usando o horário de Brasília)
function formatarBrasilia(utcStr) {
    if (!utcStr) return 'Data inválida';
    
    try {
        const data = new Date(utcStr);
        if (isNaN(data.getTime())) return 'Data inválida';
        
        // A data em UTC já representa Brasília (ex: 13:00 UTC = 10:00 Brasília)
        // Então usamos os valores UTC diretamente
        const ano = data.getUTCFullYear();
        const mes = String(data.getUTCMonth() + 1).padStart(2, '0');
        const dia = String(data.getUTCDate()).padStart(2, '0');
        const hora = String(data.getUTCHours()).padStart(2, '0');
        const minuto = String(data.getUTCMinutes()).padStart(2, '0');
        const segundo = String(data.getUTCSeconds()).padStart(2, '0');
        
        return `${dia}/${mes}/${ano} ${hora}:${minuto}:${segundo}`;
    } catch (e) {
        return 'Data inválida';
    }
}
