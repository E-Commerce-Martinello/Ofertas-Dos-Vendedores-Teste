// Martinello 1.6.14 — links para rastrear cliques por oferta / rubi.
// Não usa URL externa fornecida pelo visitante como destino de redirecionamento.
const LinkTrack = {
    codigoOferta(o) { return /^[A-Za-z0-9_-]{1,40}$/.test(String(o?.id||'')) ? String(o.id) : ''; },
    rubi(v) { const n=String(v||'').replace(/\D/g,''); return /^\d{3,5}$/.test(n)?n:''; },
    // Hotfix 1.6.14.1: retorna o link ORIGINAL da Martinello visível ao cliente.
    // Isso preserva o domínio de confiança, mas não contabiliza novos cliques
    // do cliente no Dashboard: o registro de compartilhamento continua ativo.
    urlCompartilhavel(oferta,matricula) {
        const id=this.codigoOferta(oferta), rubi=this.rubi(matricula);
        if(!id || !rubi)throw new Error('Identificador de oferta ou matrícula inválido.');
        return this.destino(oferta,rubi);
    },
    destino(oferta,matricula) {
        const rubi=this.rubi(matricula);
        if(!rubi)return 'https://www.martinello.com.br/';
        const base='https://www.martinello.com.br/parceiros/'+encodeURIComponent(rubi);
        try {
            const produto=new URL(String(oferta?.linkProduto||''));
            if(produto.protocol==='https:' && ['www.martinello.com.br','martinello.com.br'].includes(produto.hostname))
                return base+'?redir='+encodeURIComponent(produto.href);
        } catch(_) {}
        return base;
    },
    async abrirClique() {
        const aviso=document.getElementById('cliqueStatus');
        const q=new URLSearchParams(window.location.search);
        const id=q.get('o')||'', rubi=this.rubi(q.get('m'));
        if(!/^[A-Za-z0-9_-]{1,40}$/.test(id)||!rubi){
            if(aviso)aviso.textContent='Link de oferta inválido.';
            return;
        }
        let destino='https://www.martinello.com.br/';
        try {
            const snap=await ofertasRef.once('value');
            const val=snap.val();
            const ofertas=Array.isArray(val)?val:Object.values(val||{});
            const oferta=ofertas.find(o=>o&&String(o.id)===id);
            if(!oferta){if(aviso)aviso.textContent='Oferta não disponível. Abrindo a Martinello...';}
            else {
                destino=this.destino(oferta,rubi);
                const slug=s=>/^[a-z0-9][a-z0-9_-]{0,59}$/.test(String(s||''))?String(s):'';
                const camp=slug(q.get('c'))||slug(oferta.campanha)||'';
                const url=String(CONFIG.portalEventsApiUrl||'');
                if(/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url)){
                    const param=new URLSearchParams({action:'registrarClique',origem:location.origin,
                        ofertaId:id,matricula:rubi,campanha:camp,
                        tituloOferta:String(oferta.tituloPagina||'').slice(0,100),
                        clickId:`clk_${Date.now()}_${Math.random().toString(36).slice(2,13)}`});
                    const conteudo=param.toString();
                    let enviado=false;
                    if(navigator.sendBeacon){
                        try{enviado=navigator.sendBeacon(url,new Blob([conteudo],{type:'application/x-www-form-urlencoded'}));}catch(_){}
                    }
                    if(!enviado){
                        // Falha na coleta não impede o redirecionamento.
                        await Promise.race([
                            fetch(url,{method:'POST',mode:'no-cors',keepalive:true,cache:'no-store',
                                headers:{'Content-Type':'application/x-www-form-urlencoded'},body:conteudo}).catch(()=>{}),
                            new Promise(resolve=>setTimeout(resolve,700))
                        ]);
                    }
                }
            }
        } catch(e){
            console.warn('Não foi possível localizar a oferta para o redirecionamento:',e);
            if(aviso)aviso.textContent='Oferta indisponível. Abrindo Martinello...';
        }
        location.replace(destino);
    }
};
