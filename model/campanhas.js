// Martinello — campanhas públicas. NENHUM dado pessoal é consultado.
const CampanhasPortal = {
    geral: '',
    carregada: false,
    _pendente: null,
    slug(texto) {
        const t = String(texto || '').trim().toLowerCase();
        return /^[a-z0-9][a-z0-9_-]{0,59}$/.test(t) ? t : '';
    },
    efetiva(oferta) { return this.slug(oferta?.campanha) || this.geral || ''; },
    carregar() {
        if (this._pendente) return this._pendente;
        if (this.carregada) return Promise.resolve(this.geral);
        const endpoint=String(CONFIG.portalEventsApiUrl||'');
        if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(endpoint))
            return Promise.resolve('');
        this._pendente=new Promise(resolve => {
            let finalizado=false,script,timer;
            const req=`cp_${Date.now()}_${Math.random().toString(36).slice(2,13)}`;
            const limpar=(valor)=>{
                if(finalizado)return;
                finalizado=true;
                clearTimeout(timer);
                script?.remove();
                if (window.MartinelloCampanhaReceber===receber) delete window.MartinelloCampanhaReceber;
                this.carregada=true;
                this.geral=this.slug(valor);
                resolve(this.geral);
            };
            const receber=d=>{if(d?.requestId===req) limpar(d.campanha);};
            window.MartinelloCampanhaReceber=receber;
            const url=new URL(endpoint);url.searchParams.set('action','consultarCampanha');url.searchParams.set('requestId',req);
            script=document.createElement('script');script.src=url.href;
            script.onerror=()=>limpar('');
            timer=setTimeout(()=>limpar(''),3500);
            document.head.appendChild(script);
        }).finally(()=>{this._pendente=null;});
        return this._pendente;
    }
};
