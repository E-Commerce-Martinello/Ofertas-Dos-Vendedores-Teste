// ============================================
// horario.js - GERENCIAMENTO DE HORÁRIO BRASÍLIA
// CORREÇÃO: Brasília é UTC-3 (subtrair 3 horas do UTC)
// ============================================

const BRASILIA_OFFSET = -3; // -3 horas (UTC-3)

// ============================================
// FUNÇÃO 1: Obter horário atual de Brasília
// ============================================
function getHorarioBrasilia() {
    const agora = new Date();
    
    // Pegar o UTC atual
    const utcAtual = Date.UTC(
        agora.getUTCFullYear(),
        agora.getUTCMonth(),
        agora.getUTCDate(),
        agora.getUTCHours(),
        agora.getUTCMinutes(),
        agora.getUTCSeconds(),
        agora.getUTCMilliseconds()
    );
    
    // Converter para Brasília (UTC - 3 horas)
    // IMPORTANTE: subtrair 3 * 60 * 60 * 1000 milissegundos
    const brasiliaTime = new Date(utcAtual + (BRASILIA_OFFSET * 60 * 60 * 1000));
    
    return brasiliaTime;
}

// ============================================
// FUNÇÃO 2: Converter data do INPUT (Brasília) para UTC para salvar
// ============================================
function brasiliaParaUTC(dataBrasiliaStr) {
    if (!dataBrasiliaStr) return null;
    
    // Extrair partes da data
    const [dataParte, horaParte] = dataBrasiliaStr.split('T');
    const [ano, mes, dia] = dataParte.split('-').map(Number);
    const [hora, minuto] = horaParte.split(':').map(Number);
    
    // IMPORTANTE: Brasília para UTC = ADICIONAR 3 horas
    // Ex: 08:00 Brasília = 11:00 UTC
    return new Date(Date.UTC(ano, mes-1, dia, hora + 3, minuto, 0)).toISOString();
}

// ============================================
// FUNÇÃO 3: Converter UTC para formato do INPUT (Brasília)
// ============================================
function utcParaBrasiliaInput(utcStr) {
    if (!utcStr) return '';
    
    const data = new Date(utcStr);
    
    // IMPORTANTE: UTC para Brasília = SUBTRAIR 3 horas
    // Ex: 11:00 UTC = 08:00 Brasília
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
    
    // IMPORTANTE: UTC para Brasília = SUBTRAIR 3 horas
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
    
    // COMPARAÇÃO DIRETA: agoraBrasilia já está em UTC (porque veio de Date.UTC)
    // dataInicio e dataFim também estão em UTC
    return (agoraBrasilia >= dataInicio && agoraBrasilia <= dataFim);
}

// ============================================
// FUNÇÃO 6: DEBUG - Mostrar informações completas
// ============================================
function debugOferta(oferta) {
    console.log('=== DEBUG HORÁRIO ===');
    console.log('🕒 Agora (UTC puro):', new Date().toISOString());
    console.log('🕒 Agora (Brasília UTC):', getHorarioBrasilia().toISOString());
    console.log('🕒 Agora (Brasília formatado):', formatarBrasilia(getHorarioBrasilia().toISOString()));
    
    if (oferta) {
        console.log('📅 Início (UTC salvo):', oferta.dataInicio);
        console.log('📅 Início (Brasília):', formatarBrasilia(oferta.dataInicio));
        console.log('📅 Fim (UTC salvo):', oferta.dataFim);
        console.log('📅 Fim (Brasília):', formatarBrasilia(oferta.dataFim));
        console.log('✅ Ativa?', isOfertaAtiva(oferta) ? 'SIM' : 'NÃO');
    }
}
