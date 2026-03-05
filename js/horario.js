// ============================================
// horario.js - GERENCIAMENTO DE HORÁRIO BRASÍLIA
// VERSÃO FINAL - CORRIGIDA!
// ============================================

// ============================================
// FUNÇÃO 1: Obter horário atual de Brasília
// ============================================
function getHorarioBrasilia() {
    const agora = new Date();
    
    // Criar data no horário de Brasília usando o timezone do JavaScript
    // Este método é o MAIS CONFIÁVEL porque usa o próprio sistema
    const options = {
        timeZone: 'America/Sao_Paulo',
        hour12: false
    };
    
    // Pegar os componentes da data no fuso de Brasília
    const partes = new Intl.DateTimeFormat('pt-BR', {
        ...options,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric'
    }).formatToParts(agora);
    
    // Extrair valores
    let ano, mes, dia, hora, minuto, segundo;
    
    partes.forEach(part => {
        if (part.type === 'year') ano = parseInt(part.value);
        if (part.type === 'month') mes = parseInt(part.value);
        if (part.type === 'day') dia = parseInt(part.value);
        if (part.type === 'hour') hora = parseInt(part.value);
        if (part.type === 'minute') minuto = parseInt(part.value);
        if (part.type === 'second') segundo = parseInt(part.value);
    });
    
    // Criar data no UTC mas com os valores de Brasília
    // IMPORTANTE: Não subtrair nada! O Intl já deu a hora certa
    return new Date(Date.UTC(ano, mes-1, dia, hora, minuto, segundo || 0));
}

// ============================================
// FUNÇÃO 2: Formatar data UTC para exibição (Brasília)
// ============================================
function formatarBrasilia(utcStr) {
    if (!utcStr) return 'Data inválida';
    
    try {
        const data = new Date(utcStr);
        if (isNaN(data.getTime())) return 'Data inválida';
        
        // Usar o mesmo método confiável para formatar
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
// FUNÇÃO 3: Converter data do INPUT (Brasília) para UTC para salvar
// ============================================
function brasiliaParaUTC(dataBrasiliaStr) {
    if (!dataBrasiliaStr) return null;
    
    try {
        // dataBrasiliaStr = "2026-03-05T09:00"
        const [dataParte, horaParte] = dataBrasiliaStr.split('T');
        const [ano, mes, dia] = dataParte.split('-').map(Number);
        const [hora, minuto] = horaParte.split(':').map(Number);
        
        // IMPORTANTE: O que você digitou já é Brasília
        // Para UTC: só adicionar 3 horas
        // Ex: 09:00 Brasília = 12:00 UTC
        return new Date(Date.UTC(ano, mes-1, dia, hora + 3, minuto, 0)).toISOString();
    } catch (e) {
        console.error('Erro em brasiliaParaUTC:', e);
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
        
        // Usar toLocaleString para pegar a data em Brasília
        const dataBrasiliaStr = data.toLocaleString('pt-BR', {
            timeZone: 'America/Sao_Paulo',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
        
        // Converter "05/03/2026 09:00" para "2026-03-05T09:00"
        const [dataParte, horaParte] = dataBrasiliaStr.split(' ');
        const [dia, mes, ano] = dataParte.split('/');
        const [hora, minuto] = horaParte.split(':');
        
        return `${ano}-${mes}-${dia}T${hora}:${minuto}`;
    } catch (e) {
        console.error('Erro em utcParaBrasiliaInput:', e);
        return '';
    }
}

// ============================================
// FUNÇÃO 5: Verificar se uma oferta está ativa AGORA
// ============================================
function isOfertaAtiva(oferta) {
    if (!oferta || !oferta.dataInicio || !oferta.dataFim) return false;
    
    try {
        const agoraBrasilia = getHorarioBrasilia();
        const dataInicio = new Date(oferta.dataInicio);
        const dataFim = new Date(oferta.dataFim);
        
        if (isNaN(dataInicio.getTime()) || isNaN(dataFim.getTime())) return false;
        
        // COMPARAÇÃO DIRETA: ambos em UTC
        return (agoraBrasilia >= dataInicio && agoraBrasilia <= dataFim);
    } catch (e) {
        return false;
    }
}

// ============================================
// FUNÇÃO 6: DEBUG - Mostrar TODAS as informações
// ============================================
function debugHorario() {
    console.log('=== DEBUG HORARIO.JS ===');
    
    const agora = new Date();
    const agoraBrasilia = getHorarioBrasilia();
    
    console.log('1️⃣ Hora do computador:', agora.toString());
    console.log('2️⃣ Hora UTC:', agora.toISOString());
    console.log('3️⃣ Hora Brasília (calculada):', agoraBrasilia.toISOString());
    console.log('4️⃣ Hora Brasília (formatada):', formatarBrasilia(agoraBrasilia.toISOString()));
    
    // Teste com data fixa
    console.log('5️⃣ Teste com data fixa 09:00 Brasília:');
    const testeUTC = brasiliaParaUTC('2026-03-05T09:00');
    console.log('   - UTC salvo:', testeUTC);
    console.log('   - Lendo de volta:', formatarBrasilia(testeUTC));
}

// Executar debug
debugHorario();
