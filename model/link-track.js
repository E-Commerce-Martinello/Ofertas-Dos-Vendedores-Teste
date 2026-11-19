// Links oficiais Martinello: preservam matrícula de parceiro e UTMs no destino.
const LinkTrack = {
    codigoOferta(o) {return /^[A-Za-z0-9_-]{1,40}$/.test(String(o?.id||''))?String(o.id):'';},
    rubi(v) {const n=String(v||'').replace(/\D/g,'');return /^\d{3,5}$/.test(n)?n:'';},
    campanhaUtm(oferta) {
        return CampanhasPortal.efetiva(oferta);
    },
    configurarUtm(endereco,oferta) {
        const destino=new URL(String(endereco));
        if(destino.protocol!=='https:'||!['www.martinello.com.br','martinello.com.br'].includes(destino.hostname))
            throw new Error('O destino precisa ser uma URL HTTPS oficial da Martinello.');
        const campanha=this.campanhaUtm(oferta);
        const origem=CampanhasPortal.slug(CampanhasPortal.utmSource)||'grupo_zap';
        const identificador=CampanhasPortal.slug(CampanhasPortal.utmId)||'vendedores_zap';
        // Limpa parâmetros UTM antigos. Preserva parâmetros de produto não relacionados
        // ao rastreio (cor, variação, etc.) e garante uma única cópia de cada UTM.
        for(const chave of [...destino.searchParams.keys()])
            if(/^utm_/i.test(chave))destino.searchParams.delete(chave);
        destino.searchParams.set('utm_source',origem);
        destino.searchParams.set('utm_campaign',campanha);
        destino.searchParams.set('utm_id',identificador);
        return destino.href;
    },
    urlCompartilhavel(oferta,matricula,ativo=true) {
        const id=this.codigoOferta(oferta),rubi=this.rubi(matricula);
        if(!id||!rubi)throw new Error('Identificador da oferta ou matrícula inválido.');
        return this.destino(oferta,rubi,ativo);
    },
    destino(oferta,matricula,ativo=true) {
        const rubi=this.rubi(matricula);
        // Não vendedores recebem apenas o domínio padrão, ainda com rastreio UTM.
        if(!ativo||!rubi)
            return this.configurarUtm('https://www.martinello.com.br/',oferta);
        const produto=this.configurarUtm(String(oferta?.linkProduto||''),oferta);
        // O endereço final contém o padrão do Analytics; a rota parceiros mantém a
        // atribuição ao vendedor e o parâmetro redirect exigido pelo e-commerce.
        return 'https://www.martinello.com.br/parceiros/'+encodeURIComponent(rubi)
            +'?redirect='+encodeURIComponent(produto);
    }
};
