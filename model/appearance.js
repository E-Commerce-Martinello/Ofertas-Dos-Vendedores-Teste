// Martinello 1.6.10 — identidade visual do portal, sem dados pessoais.
// Conteúdo público de leitura, edição restrita pelas regras do Firebase.
const AparenciaPortal = {
    dados: null,
    referencia: database.ref('aparenciaPortal' + sufixoAmbiente),
    padrao: Object.freeze({
        logo: 'img/logo.png',
        imagem: 'img/produto.png',
        titulo: 'EM BREVE',
        mensagem: 'Estamos preparando novidades especiais para você! Fique ligado.'
    }),

    _imagem(valor, padrao, maximo) {
        if (valor === padrao) return valor;
        if (typeof valor === 'string' && valor.length <= maximo &&
            /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(valor)) return valor;
        return padrao;
    },
    _normalizar(dados = {}) {
        if (!dados || typeof dados !== 'object') dados = {};
        return {
            logo: this._imagem(dados.logo, this.padrao.logo, 180000),
            imagem: this._imagem(dados.imagem, this.padrao.imagem, 280000),
            titulo: String(dados.titulo || this.padrao.titulo).trim().slice(0, 100),
            mensagem: String(dados.mensagem ?? this.padrao.mensagem).trim().slice(0, 500)
        };
    },
    async carregar() {
        const snap = await this.referencia.once('value');
        // Dado ausente é normal na primeira implantação: manter a aparência atual.
        this.dados = snap.exists() ? this._normalizar(snap.val()) : null;
        return this.dados || { ...this.padrao };
    },
    async salvar(dados) {
        const cfg = this._normalizar(dados);
        if (!cfg.titulo.trim()) throw new Error('Informe o título da tela Em breve.');
        await this.referencia.set(cfg); // só confirma após gravação real
        this.dados = cfg;
        return cfg;
    },
    async compactarImagem(arquivo, ladoMaximo = 900, limite = 180000) {
        if (!arquivo || !['image/png', 'image/jpeg', 'image/webp'].includes(arquivo.type)) {
            throw new Error('Selecione uma imagem PNG, JPG ou WebP.');
        }
        if (arquivo.size > 6 * 1024 * 1024) throw new Error('A imagem original deve ter até 6 MB.');
        const endereco = URL.createObjectURL(arquivo);
        try {
            const img = await new Promise((resolve,reject) => {
                const im = new Image();
                im.onload = () => resolve(im);
                im.onerror = () => reject(new Error('Não foi possível abrir a imagem.'));
                im.src = endereco;
            });
            const ratio = Math.min(1, ladoMaximo/Math.max(img.naturalWidth, img.naturalHeight));
            let w = Math.max(1,Math.round(img.naturalWidth * ratio));
            let h = Math.max(1,Math.round(img.naturalHeight * ratio));
            for (let passo=0;passo<6;passo++) {
                const canvas = document.createElement('canvas');
                canvas.width = w; canvas.height = h;
                canvas.getContext('2d').drawImage(img,0,0,w,h);
                const tipos = arquivo.type==='image/png' ? ['image/png','image/webp'] : ['image/webp','image/jpeg'];
                for (const tipo of tipos) {
                    const data = canvas.toDataURL(tipo, Math.max(.55,.87-passo*.06));
                    if (data.length <= limite && /^data:image\/(?:png|jpeg|webp);base64,/.test(data)) return data;
                }
                w = Math.max(1,Math.round(w*.8)); h=Math.max(1,Math.round(h*.8));
            }
            throw new Error('A imagem continua grande. Utilize uma imagem mais simples ou menor.');
        } finally { URL.revokeObjectURL(endereco); }
    }
};
