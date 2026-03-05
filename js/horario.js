// ============================================
// horario.js - GERENCIAMENTO DE HORÁRIO BRASÍLIA
// VERSÃO FINAL - CORRETA!
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
        
        // A data que chega aqui JÁ É BRASÍLIA em UTC
        // Exemplo: "2026-03-05T10:00:00.000Z" = 10:00 Brasília
        
        // Extrair componentes diretamente do UTC
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

// ============================================
// FUNÇÃO 3: Converter data do INPUT (Brasília) para UTC
// ============================================
function brasiliaParaUTC(dataBrasiliaStr) {
    if (!dataBrasiliaStr) return null;
    
    try {
        const [dataParte, horaParte] = dataBrasiliaStr.split('T');
        const [ano, mes, dia] = dataParte.split('-').map(Number);
        const [hora, minuto] = horaParte.split(':').map(Number);
        
        // IMPORTANTE: O que você digitou É BRASÍLIA
        // Para converter para UTC: BRASÍLIA + 3 HORAS
        // Exemplo: 10:00 Brasília = 13:00 UTC
        return new Date(Date.UTC(ano, mes-1, dia, hora + 3, minuto, 0)).toISOString();
    } catch (e) {
        return null;
    }
}

// ============================================
// FUNÇÃO 4: Converter UTC para formato do INPUT (Brasília)
// ============================================
function utcParaBrasiliaInput(utcStr) {
    if (!utcStr) return '';
    
    try {
        const data = new Date(utcStr);
        if (isNaN(data.getTime())) return '';
        
        // UTC para Brasília: UTC - 3 HORAS
        // Exemplo: 13:00 UTC = 10:00 Brasília
        const ano = data.getUTCFullYear();
        const mes = String(data.getUTCMonth() + 1).padStart(2, '0');
        const dia = String(data.getUTCDate()).padStart(2, '0');
        const hora = String(data.getUTCHours() - 3).padStart(2, '0');
        const minuto = String(data.getUTCMinutes()).padStart(2, '0');
        
        return `${ano}-${mes}-${dia}T${hora}:${minuto}`;
    } catch (e) {
        return '';
    }
}

// ============================================
// FUNÇÃO 5: Verificar se oferta está ativa
// ============================================
function isOfertaAtiva(oferta) {
    if (!oferta || !oferta.dataInicio || !oferta.dataFim) return false;
    
    try {
        const agora = getHorarioBrasilia();
        const inicio = new Date(oferta.dataInicio);
        const fim = new Date(oferta.dataFim);
        
        console.log('🔍 Verificando oferta:');
        console.log('   - Agora (UTC):', agora.toISOString());
        console.log('   - Início (UTC):', inicio.toISOString());
        console.log('   - Fim (UTC):', fim.toISOString());
        console.log('   - Agora >= Início?', agora >= inicio);
        console.log('   - Agora <= Fim?', agora <= fim);
        console.log('   - RESULTADO:', (agora >= inicio && agora <= fim) ? '✅ ATIVA' : '❌ INATIVA');
        
        return (agora >= inicio && agora <= fim);
    } catch (e) {
        return false;
    }
}

// ============================================
// FUNÇÃO 6: DEBUG COMPLETO
// ============================================
function debugHorario() {
    console.log('\n=== DEBUG HORARIO.JS ===');
    
    const agora = new Date();
    console.log('1️⃣ Hora do computador:', agora.toString());
    console.log('2️⃣ Timezone offset:', agora.getTimezoneOffset(), 'minutos');
    console.log('3️⃣ UTC do computador:', agora.toISOString());
    
    const brasilia = getHorarioBrasilia();
    console.log('4️⃣ Brasília (UTC):', brasilia.toISOString());
    console.log('5️⃣ Brasília (formatado):', formatarBrasilia(brasilia.toISOString()));
    
    // Teste com data fixa
    console.log('\n6️⃣ Teste com data fixa 10:00 Brasília:');
    const testeUTC = brasiliaParaUTC('2026-03-05T10:00');
    console.log('   - UTC salvo:', testeUTC);
    console.log('   - Lendo de volta:', formatarBrasilia(testeUTC));
    console.log('   - Input de volta:', utcParaBrasiliaInput(testeUTC));
    
    console.log('=== FIM DEBUG ===\n');
}

// Executar debug
setTimeout(debugHorario, 500);
