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

        // Múltiplas campanhas podem acontecer simultaneamente.
        // Datas que se sobrepõem NÃO são um conflito: cada oferta é independente.
        if (dados.dataInicio && !Number.isFinite(new Date(dados.dataInicio).getTime()))
            erros.push('Data de início inválida');
        if (dados.dataFim && !Number.isFinite(new Date(dados.dataFim).getTime()))
            erros.push('Data de fim inválida');

        return { valido: erros.length === 0, erros };
    },
};
