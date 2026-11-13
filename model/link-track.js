// Martinello 1.6.14 — links para rastrear cliques por oferta / rubi.
// Não usa URL externa fornecida pelo visitante como destino de redirecionamento.
const LinkTrack = {
    codigoOferta(o) { return /^[A-Za-z0-9_-]{1,40}$/.test(String(o?.id||'')) ? String(o.id) : ''; },
    rubi(v) { const n=String(v||'').replace(/\D/g,''); return /^\d{3,5}$/.test(n)?n:''; },
    // Hotfix 1.6.14.1: retorna o link ORIGINAL da Martinello visível ao cliente.
    // Isso preserva o domínio de confiança, mas não contabiliza novos cliques
    // do cliente no Dashboard: o registro de compartilhamento continua ativo.
    urlCompartilhavel(oferta,matricula,ativo=true) {
        const id=this.codigoOferta(oferta), rubi=this.rubi(matricula);
        if(!id || !rubi)throw new Error('Identificador de oferta ou matrícula inválido.');
        return this.destino(oferta,rubi,ativo);
    },
    // Campanha GA4: a campanha propria da oferta prevalece sobre a campanha geral.
    // O identificador do produto e extraido da URL oficial; sem SKU, usa-se o ID da oferta.
    campanhaUtm(oferta, agora = new Date()) {
        const campos = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/Cuiaba', year: 'numeric', month: '2-digit'
        }).formatToParts(agora);
        const ano = campos.find(x=>x.type==='year')?.value || String(agora.getUTCFullYear());
        const mes = campos.find(x=>x.type==='month')?.value || String(agora.getUTCMonth()+1).padStart(2,'0');
        const slug = valor => String(valor ?? '').toLowerCase().normalize('NFD')
            .replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9_-]+/g,'_')
            .replace(/_+/g,'_').replace(/^_+|_+$/g,'').slice(0,60);
        const campanha = slug(oferta?.campanha) || slug(CampanhasPortal.geral) || 'sem_campanha';
        let codigo = slug(oferta?.sku || oferta?.codigoProduto || '');
        if (!codigo) {
            try {
                const caminho = new URL(String(oferta?.linkProduto||'')).pathname;
                codigo = (caminho.match(/-(\d{3,12})\/?$/) || [])[1] || '';
            } catch (_) {}
        }
        if (!codigo) codigo = slug(oferta?.id) || 'sem_id';
        return `ofertas_${ano}_${mes}_${campanha}_${codigo}`;
    },
    destino(oferta,matricula,ativo=true) {
        const padrao = 'https://www.martinello.com.br/';
        const rubi = this.rubi(matricula);
        if (!ativo || !rubi) {
            const destinoPadrao = new URL(padrao);
            destinoPadrao.searchParams.set('utm_campaign',this.campanhaUtm(oferta));
            return destinoPadrao.href;
        }
        const base='https://www.martinello.com.br/parceiros/'+encodeURIComponent(rubi);
        try {
            const produto=new URL(String(oferta?.linkProduto||''));
            if (produto.protocol==='https:' && ['www.martinello.com.br','martinello.com.br'].includes(produto.hostname)) {
                produto.searchParams.set('utm_campaign', this.campanhaUtm(oferta));
                return base+'?redirect='+encodeURIComponent(produto.href);
            }
        } catch(_) {}
        return base+'?utm_campaign='+encodeURIComponent(this.campanhaUtm(oferta));
    }
};
