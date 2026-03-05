// ============================================
// validators.js - VALIDAÇÕES DE NEGÓCIO
// ============================================

const VALIDADOR = {
    oferta(oferta) {
        const erros = [];
        
        if (!oferta) return { valido: false, erros: ['Oferta não fornecida'] };
        
        if (!oferta.dataInicio) erros.push('Data de início obrigatória');
        if (!oferta.dataFim) erros.push('Data de fim obrigatória');
        if (!oferta.linkProduto) erros.push('Link do produto obrigatório');
        if (!oferta.textoOferta) erros.push('Texto da oferta obrigatório');
        
        if (oferta.dataInicio && oferta.dataFim) {
            const inicio = new Date(oferta.dataInicio);
            const fim = new Date(oferta.dataFim);
            
            if (fim <= inicio) {
                erros.push('Data fim deve ser posterior à data início');
            }
        }
        
        if (oferta.linkProduto && !oferta.linkProduto.startsWith('https://')) {
            erros.push('Link deve começar com https://');
        }
        
        return {
            valido: erros.length === 0,
            erros
        };
    },
    
    datas(dataInicio, dataFim) {
        if (!dataInicio || !dataFim) return false;
        
        const inicio = new Date(dataInicio);
        const fim = new Date(dataFim);
        
        return !isNaN(inicio) && !isNaN(fim) && fim > inicio;
    },
    
    conflito(novaInicio, novaFim, ofertasExistentes, ignorarId = null) {
        const inicio = new Date(novaInicio);
        const fim = new Date(novaFim);
        
        for (const oferta of ofertasExistentes) {
            if (ignorarId && oferta.id === ignorarId) continue;
            
            const ofertaInicio = new Date(oferta.dataInicio);
            const ofertaFim = new Date(oferta.dataFim);
            
            if (inicio >= ofertaInicio && inicio <= ofertaFim) return true;
            if (fim >= ofertaInicio && fim <= ofertaFim) return true;
            if (inicio <= ofertaInicio && fim >= ofertaFim) return true;
        }
        
        return false;
    }
};
