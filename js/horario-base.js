// ============================================
// horario-base.js - FUNÇÕES BASE (SEM CONVERSÕES!)
// Todas as datas são tratadas como Brasília
// ============================================

// ============================================
// FUNÇÃO: Salvar data (já está em Brasília, só validar)
// ============================================
function salvarDataBrasilia(dataStr) {
    if (!dataStr) return null;
    
    try {
        // Apenas validar se é uma data válida
        const data = new Date(dataStr);
        if (isNaN(data.getTime())) return null;
        
        // Retornar a string original (já em Brasília)
        return dataStr;
    } catch (e) {
        return null;
    }
}

// ============================================
// FUNÇÃO: Carregar data (já está em Brasília)
// ============================================
function carregarDataBrasilia(dataStr) {
    if (!dataStr) return null;
    
    try {
        // Se já for um objeto Date, retorna
        if (dataStr instanceof Date) return dataStr;
        
        // Converte string para Date (interpreta como horário local)
        return new Date(dataStr);
    } catch (e) {
        return null;
    }
}

// ============================================
// FUNÇÃO: Verificar se oferta está ativa
// ============================================
function isOfertaAtiva(oferta, agoraBrasilia) {
    if (!oferta || !oferta.dataInicio || !oferta.dataFim) return false;
    
    try {
        const inicio = new Date(oferta.dataInicio);
        const fim = new Date(oferta.dataFim);
        
        if (isNaN(inicio.getTime()) || isNaN(fim.getTime())) return false;
        
        return (agoraBrasilia >= inicio && agoraBrasilia <= fim);
    } catch (e) {
        return false;
    }
}
