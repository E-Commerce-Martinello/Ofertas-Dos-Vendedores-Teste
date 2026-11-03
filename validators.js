// ============================================
// model/validators.js — REGRAS DE NEGÓCIO
// ============================================

const Validators = {

    matricula(valor) {
        return /^\d{3,5}$/.test(valor);
    },

    imagem(file) {
        if (!file) return { valido: false, erro: 'Nenhum arquivo' };
        if (file.size > CONFIG.maxImageSize)              return { valido: false, erro: 'Imagem muito grande (máx 5MB)' };
        if (!CONFIG.imagensPermitidas.includes(file.type)) return { valido: false, erro: 'Formato inválido (PNG, JPG ou GIF)' };
        return { valido: true };
    },

    oferta(dados, ofertasExistentes = [], ignorarIndex = null) {
        const erros = [];
        if (!dados.dataInicio)  erros.push('Data de início obrigatória');
        if (!dados.dataFim)     erros.push('Data de fim obrigatória');
        if (!dados.linkProduto) erros.push('Link obrigatório');
        if (!dados.textoOferta) erros.push('Texto obrigatório');
        if (dados.linkProduto && !dados.linkProduto.startsWith('https://'))
            erros.push('Link deve começar com https://');
        if (dados.dataInicio && dados.dataFim) {
            const ini = new Date(dados.dataInicio), fim = new Date(dados.dataFim);
            if (fim <= ini) erros.push('Data fim deve ser posterior à data início');
        }

        // BUG FIX: ignorarIndex pode chegar como string ("0","1"…) vindo do value de input HTML
        // Converter para número antes de comparar com o índice do loop (que é sempre número)
        const ignorar = (ignorarIndex !== null && ignorarIndex !== '') ? parseInt(ignorarIndex) : null;

        const ini = new Date(dados.dataInicio), fim = new Date(dados.dataFim);
        for (let i = 0; i < ofertasExistentes.length; i++) {
            if (ignorar !== null && i === ignorar) continue; // pula a própria oferta sendo editada
            const oi = new Date(ofertasExistentes[i].dataInicio);
            const of = new Date(ofertasExistentes[i].dataFim);
            if (ini <= of && fim >= oi) {
                erros.push('Conflito com outra oferta no mesmo período');
                break;
            }
        }

        return { valido: erros.length === 0, erros };
    },
};
