// ============================================
// horario.js - GERENCIAMENTO DE HORÁRIO BRASÍLIA
// ============================================

// Configuração: Brasília é UTC-3
const BRASILIA_OFFSET = -3; // -3 horas

// ============================================
// FUNÇÃO 1: Obter horário atual de Brasília (como objeto Date)
// ============================================
function getHorarioBrasilia() {
    const agora = new Date();
    
    // Converter para UTC puro (sem fusos)
    const utc = Date.UTC(
        agora.getUTCFullYear(),
        agora.getUTCMonth(),
        agora.getUTCDate(),
        agora.getUTCHours(),
        agora.getUTCMinutes(),
        agora.getUTCSeconds(),
        agora.getUTCMilliseconds()
    );
    
    // Aplicar offset de Brasília (UTC-3)
    return new Date(utc + (BRASILIA_OFFSET * 60 * 60 * 1000));
}

// ============================================
// FUNÇÃO 2: Converter data do INPUT (Brasília) para UTC para salvar
// ============================================
function brasiliaParaUTC(dataBrasiliaStr) {
    // dataBrasiliaStr formato: "2026-03-05T10:00"
    if (!dataBrasiliaStr) return null;
    
    // Extrair partes da data
    const [dataParte, horaParte] = dataBrasiliaStr.split('T');
    const [ano, mes, dia] = dataParte.split('-').map(Number);
    const [hora, minuto] = horaParte.split(':').map(Number);
    
    // Criar data em UTC (Brasília + 3 horas = UTC)
    return new Date(Date.UTC(ano, mes-1, dia, hora + 3, minuto, 0)).toISOString();
}

// ============================================
// FUNÇÃO 3: Converter UTC para formato do INPUT (Brasília)
// ============================================
function utcParaBrasiliaInput(utcStr) {
    if (!utcStr) return '';
    
    const data = new Date(utcStr);
    
    // UTC - 3 horas = Brasília
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
    
    // COMPARAÇÃO DIRETA (ambas em UTC)
    return (agoraBrasilia >= dataInicio && agoraBrasilia <= dataFim);
}

// ============================================
// FUNÇÃO 6: DEBUG - Mostrar informações completas
// ============================================
function debugOferta(oferta) {
    console.log('=== DEBUG HORÁRIO ===');
    console.log('🕒 Agora (Brasília):', formatarBrasilia(getHorarioBrasilia().toISOString()));
    console.log('📅 Agora (UTC raw):', getHorarioBrasilia().toISOString());
    
    if (oferta) {
        console.log('📅 Início (UTC salvo):', oferta.dataInicio);
        console.log('📅 Início (Brasília):', formatarBrasilia(oferta.dataInicio));
        console.log('📅 Fim (UTC salvo):', oferta.dataFim);
        console.log('📅 Fim (Brasília):', formatarBrasilia(oferta.dataFim));
        console.log('✅ Ativa?', isOfertaAtiva(oferta) ? 'SIM' : 'NÃO');
    }
}
