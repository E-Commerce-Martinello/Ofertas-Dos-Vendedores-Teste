// ============================================
// horario-base.js - FUNÇÕES BASE DE HORÁRIO
// (usado tanto pelo admin quanto pelo index)
// ============================================

// Converter data do INPUT (Brasília) para UTC (para salvar)
function brasiliaParaUTC(dataBrasiliaStr) {
    if (!dataBrasiliaStr) return null;
    
    try {
        const [dataParte, horaParte] = dataBrasiliaStr.split('T');
        const [ano, mes, dia] = dataParte.split('-').map(Number);
        const [hora, minuto] = horaParte.split(':').map(Number);
        
        // Brasília → UTC: +3 horas
        return new Date(Date.UTC(ano, mes-1, dia, hora + 3, minuto, 0)).toISOString();
    } catch (e) {
        return null;
    }
}

// Converter UTC para formato do INPUT (Brasília) (para editar)
function utcParaBrasiliaInput(utcStr) {
    if (!utcStr) return '';
    
    try {
        const data = new Date(utcStr);
        if (isNaN(data.getTime())) return '';
        
        // UTC → Brasília: -3 horas
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

// Verificar se oferta está ativa (usado pelos dois)
function isOfertaAtiva(oferta, agoraBrasilia) {
    if (!oferta || !oferta.dataInicio || !oferta.dataFim) return false;
    
    try {
        const inicio = new Date(oferta.dataInicio);
        const fim = new Date(oferta.dataFim);
        
        return (agoraBrasilia >= inicio && agoraBrasilia <= fim);
    } catch (e) {
        return false;
    }
}
