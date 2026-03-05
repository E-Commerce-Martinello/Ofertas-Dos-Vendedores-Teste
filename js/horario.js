// ============================================
// horario.js - GERENCIAMENTO DE HORÁRIO BRASÍLIA
// VERSÃO FINAL - CORRIGIDA!
// ============================================

// ============================================
// FUNÇÃO 1: Obter horário atual de Brasília (como UTC)
// ============================================
function getHorarioBrasilia() {
    const agora = new Date();
    
    // Pegar o UTC real do computador
    const utcReal = Date.UTC(
        agora.getUTCFullYear(),
        agora.getUTCMonth(),
        agora.getUTCDate(),
        agora.getUTCHours(),
        agora.getUTCMinutes(),
        agora.getUTCSeconds()
    );
    
    console.log('📌 UTC real do computador:', new Date(utcReal).toISOString());
    
    // Brasília = UTC - 3 horas
    const brasiliaUTC = new Date(utcReal - (3 * 60 * 60 * 1000));
    
    console.log('✅ Brasília (UTC):', brasiliaUTC.toISOString());
    
    return brasiliaUTC;
}

// ============================================
// FUNÇÃO 2: Formatar data UTC para exibição (Brasília)
// ============================================
function formatarBrasilia(utcStr) {
    if (!utcStr) return 'Data inválida';
    
    try {
        const data = new Date(utcStr);
        if (isNaN(data.getTime())) return 'Data inválida';
        
        // Formatar direto, sem conversões adicionais
        return data.toLocaleString('pt-BR', {
            timeZone: 'America/Sao_Paulo',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
    } catch (e) {
        return 'Data inválida';
    }
}

// ============================================
// FUNÇÃO 3: Converter data do INPUT (Brasília) para UTC
// ============================================
function brasiliaParaUTC(dataBrasiliaStr) {
    if (!dataBrasiliaStr) return null;
    
    try {
        const [dataParte, horaParte] = dataBrasiliaStr.split('T');
        const [ano, mes, dia] = dataParte.split('-').map(Number);
        const [hora, minuto] = horaParte.split(':').map(Number);
        
        // O que você digitou é Brasília
        // Para UTC: Brasília + 3 horas
        return new Date(Date.UTC(ano, mes-1, dia, hora + 3, minuto, 0)).toISOString();
    } catch (e) {
        return null;
    }
}

// ============================================
// FUNÇÃO 4: Verificar se oferta está ativa
// ============================================
function isOfertaAtiva(oferta) {
    if (!oferta || !oferta.dataInicio || !oferta.dataFim) return false;
    
    try {
        const agora = getHorarioBrasilia();
        const inicio = new Date(oferta.dataInicio);
        const fim = new Date(oferta.dataFim);
        
        console.log('🔍 Comparação:', {
            agora: agora.toISOString(),
            inicio: inicio.toISOString(),
            fim: fim.toISOString(),
            ativa: (agora >= inicio && agora <= fim)
        });
        
        return (agora >= inicio && agora <= fim);
    } catch (e) {
        return false;
    }
}

// ============================================
// FUNÇÃO 5: DEBUG
// ============================================
function debugHorario() {
    console.log('\n=== DEBUG HORARIO.JS ===');
    
    const agora = new Date();
    console.log('1️⃣ Hora do computador:', agora.toString());
    console.log('2️⃣ UTC do computador:', agora.toISOString());
    
    const brasilia = getHorarioBrasilia();
    console.log('3️⃣ Brasília (UTC):', brasilia.toISOString());
    console.log('4️⃣ Brasília (formatado):', formatarBrasilia(brasilia.toISOString()));
    
    console.log('=== FIM DEBUG ===\n');
}

// Executar debug
setTimeout(debugHorario, 500);
