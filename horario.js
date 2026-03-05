// ============================================
// horario.js - GERENCIAMENTO DE HORÁRIO BRASÍLIA
// VERSÃO CORRIGIDA - SEM ERROS DE OFFSET
// ============================================

// ============================================
// FUNÇÃO 1: Obter horário atual de Brasília (como objeto Date)
// ============================================
function getHorarioBrasilia() {
    const agora = new Date();
    
    // Criar data no horário de Brasília usando o timezone correto
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
    
    // Pegar a string no formato brasileiro
    const strBrasilia = agora.toLocaleString('pt-BR', options);
    
    // Converter string para partes
    const [data, hora] = strBrasilia.split(' ');
    const [dia, mes, ano] = data.split('/').map(Number);
    const [h, m, s] = hora.split(':').map(Number);
    
    // Criar data no UTC mas com os valores de Brasília
    return new Date(Date.UTC(ano, mes-1, dia, h, m, s));
}

// ============================================
// FUNÇÃO 2: Converter data do INPUT (Brasília) para UTC para salvar
// ============================================
function brasiliaParaUTC(dataBrasiliaStr) {
    // dataBrasiliaStr formato: "2026-03-05T08:00"
    if (!dataBrasiliaStr) return null;
    
    // Extrair partes
    const [dataParte, horaParte] = dataBrasiliaStr.split('T');
    const [ano, mes, dia] = dataParte.split('-').map(Number);
    const [hora, minuto] = horaParte.split(':').map(Number);
    
    // IMPORTANTE: O que você digitou (8:00) já é Brasília
    // Para UTC: 8:00 Brasília = 11:00 UTC (somar 3)
    return new Date(Date.UTC(ano, mes-1, dia, hora + 3, minuto, 0)).toISOString();
}

// ============================================
// FUNÇÃO 3: Converter UTC para formato do INPUT (Brasília)
// ============================================
function utcParaBrasiliaInput(utcStr) {
    if (!utcStr) return '';
    
    const data = new Date(utcStr);
    
    // UTC para Brasília: subtrair 3 horas
    // Ex: 11:00 UTC = 8:00 Brasília
    const ano = data.getUTCFullYear();
    const mes = String(data.getUTCMonth() + 1).padStart(2, '0');
    const dia = String(data.getUTCDate()).padStart(2, '0');
    const hora = String(data.getUTCHours() - 3).padStart(2, '0');
    const minuto = String(data.getUTCMinutes()).padStart(2, '0');
    
    return `${ano}-${mes}-${dia}T${hora}:${minuto}`;
}

// ============================================
// FUNÇÃO 4: Formatar data UTC para exibição (Brasília)
// ============================================
function formatarBrasilia(utcStr) {
    if (!utcStr) return 'Data inválida';
    
    const data = new Date(utcStr);
    
    // Converter UTC para Brasília (subtrair 3)
    const ano = data.getUTCFullYear();
    const mes = String(data.getUTCMonth() + 1).padStart(2, '0');
    const dia = String(data.getUTCDate()).padStart(2, '0');
    const hora = String(data.getUTCHours() - 3).padStart(2, '0');
    const minuto = String(data.getUTCMinutes()).padStart(2, '0');
    const segundo = String(data.getUTCSeconds()).padStart(2, '0');
    
    return `${dia}/${mes}/${ano} ${hora}:${minuto}:${segundo}`;
}

// ============================================
// FUNÇÃO 5: Verificar se uma oferta está ativa AGORA
// ============================================
function isOfertaAtiva(oferta) {
    if (!oferta || !oferta.dataInicio || !oferta.dataFim) return false;
    
    const agoraBrasilia = getHorarioBrasilia();
    const dataInicio = new Date(oferta.dataInicio);
    const dataFim = new Date(oferta.dataFim);
    
    // COMPARAÇÃO CORRETA: ambos em UTC
    return (agoraBrasilia >= dataInicio && agoraBrasilia <= dataFim);
}

// ============================================
// FUNÇÃO 6: DEBUG - Mostrar TODAS as informações
// ============================================
function debugCompleto(oferta) {
    const agora = new Date();
    const agoraBrasilia = getHorarioBrasilia();
    
    console.log('=== DEBUG COMPLETO ===');
    console.log('1️⃣ Hora do computador:', agora.toString());
    console.log('2️⃣ Hora UTC pura:', agora.toISOString());
    console.log('3️⃣ Hora Brasília (calculada):', agoraBrasilia.toISOString());
    console.log('4️⃣ Hora Brasília (formatada):', formatarBrasilia(agoraBrasilia.toISOString()));
    
    if (oferta) {
        console.log('5️⃣ Oferta início (UTC):', oferta.dataInicio);
        console.log('6️⃣ Oferta fim (UTC):', oferta.dataFim);
        console.log('7️⃣ Início (Brasília):', formatarBrasilia(oferta.dataInicio));
        console.log('8️⃣ Fim (Brasília):', formatarBrasilia(oferta.dataFim));
        console.log('9️⃣ Ativa?', isOfertaAtiva(oferta));
    }
}
