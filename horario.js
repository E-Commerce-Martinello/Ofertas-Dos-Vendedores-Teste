// ============================================
// horario.js - GERENCIAMENTO DE HORÁRIO BRASÍLIA
// VERSÃO FINAL - SEM ERROS!
// ============================================

// ============================================
// FUNÇÃO 1: Obter horário atual de Brasília
// ============================================
function getHorarioBrasilia() {
    const agora = new Date();
    
    // Pegar UTC e subtrair 3 horas (Brasília = UTC-3)
    const utc = Date.UTC(
        agora.getUTCFullYear(),
        agora.getUTCMonth(),
        agora.getUTCDate(),
        agora.getUTCHours(),
        agora.getUTCMinutes(),
        agora.getUTCSeconds()
    );
    
    return new Date(utc - (3 * 60 * 60 * 1000));
}

// ============================================
// FUNÇÃO 2: Formatar data UTC para exibição (Brasília)
// ============================================
function formatarBrasilia(utcStr) {
    if (!utcStr) return 'Data inválida';
    
    try {
        const data = new Date(utcStr);
        if (isNaN(data.getTime())) return 'Data inválida';
        
        // Converter UTC para Brasília (subtrair 3 horas)
        const dataBrasilia = new Date(data.getTime() - (3 * 60 * 60 * 1000));
        
        const dia = String(dataBrasilia.getUTCDate()).padStart(2, '0');
        const mes = String(dataBrasilia.getUTCMonth() + 1).padStart(2, '0');
        const ano = dataBrasilia.getUTCFullYear();
        const hora = String(dataBrasilia.getUTCHours()).padStart(2, '0');
        const minuto = String(dataBrasilia.getUTCMinutes()).padStart(2, '0');
        const segundo = String(dataBrasilia.getUTCSeconds()).padStart(2, '0');
        
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
        
        // Brasília para UTC = adicionar 3 horas
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
        const agoraBrasilia = getHorarioBrasilia();
        const dataInicio = new Date(oferta.dataInicio);
        const dataFim = new Date(oferta.dataFim);
        
        if (isNaN(dataInicio.getTime()) || isNaN(dataFim.getTime())) return false;
        
        return (agoraBrasilia >= dataInicio && agoraBrasilia <= dataFim);
    } catch (e) {
        return false;
    }
}

// ============================================
// FUNÇÃO 6: Debug silencioso (opcional)
// ============================================
function debugHorario() {
    // Comentado para não poluir o console
    // const agora = getHorarioBrasilia();
    // console.log('Horário Brasília:', formatarBrasilia(agora.toISOString()));
}
