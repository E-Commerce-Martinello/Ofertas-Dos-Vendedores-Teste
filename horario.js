// ============================================
// horario.js - GERENCIAMENTO DE HORÁRIO BRASÍLIA
// VERSÃO FINAL CORRIGIDA
// ============================================

// ============================================
// FUNÇÃO 1: Obter horário atual de Brasília
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
    if (!dataBrasiliaStr) return null;
    
    const [dataParte, horaParte] = dataBrasiliaStr.split('T');
    const [ano, mes, dia] = dataParte.split('-').map(Number);
    const [hora, minuto] = horaParte.split(':').map(Number);
    
    // Brasília para UTC = adicionar 3 horas
    return new Date(Date.UTC(ano, mes-1, dia, hora + 3, minuto, 0)).toISOString();
}

// ============================================
// FUNÇÃO 3: Converter UTC para formato do INPUT (Brasília)
// ============================================
function utcParaBrasiliaInput(utcStr) {
    if (!utcStr) return '';
    
    const data = new Date(utcStr);
    
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
    
    // COMPARAÇÃO CORRETA: todos em UTC
    return (agoraBrasilia >= dataInicio && agoraBrasilia <= dataFim);
}

// ============================================
// FUNÇÃO 6: DEBUG - Mostrar informações no console
// ============================================
function debugHorario() {
    console.log('=== DEBUG HORARIO.JS ===');
    console.log('getHorarioBrasilia():', getHorarioBrasilia().toISOString());
    console.log('formatarBrasilia(getHorarioBrasilia()):', formatarBrasilia(getHorarioBrasilia().toISOString()));
}

// Executar debug automático ao carregar
debugHorario();
