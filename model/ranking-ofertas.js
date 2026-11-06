// Ranking publico: a resposta do coletor contem apenas o ID da oferta lider.
// A contagem e as matriculas nunca sao enviadas ao navegador.
const RankingOfertas = {
    _chave:'', _lider:'', _consultadoEm:0, _pendente:null,
    liderAtivas(ativas) {
        const id=String(this._lider||'');
        return (ativas||[]).some(o=>String(o.id)===id) ? id : '';
    },
    carregar(ativas) {
        const ids=[...new Set((ativas||[]).map(o=>String(o.id))
          .filter(id=>/^[A-Za-z0-9_-]{1,40}$/.test(id)))].sort().slice(0,40);
        if (!ids.length) return Promise.resolve('');
        const chave=ids.join(',');
        const agora=Date.now();
        if (this._chave===chave && agora-this._consultadoEm < 15*60*1000)
            return Promise.resolve(this._lider);
        if (this._pendente?.chave===chave) return this._pendente.promessa;
        const endpoint=String(CONFIG.portalEventsApiUrl||'');
        if(!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(endpoint))
            return Promise.resolve('');
        const promessa=new Promise(resolve=>{
            let script,timeout,acabou=false;
            const requestId=`rk_${Date.now()}_${Math.random().toString(36).slice(2,14)}`;
            const callback=d=>{if(d?.requestId===requestId) finalizar(String(d?.ofertaId||''));};
            function finalizar(id) {
                if(acabou) return;
                acabou=true;
                clearTimeout(timeout);
                script?.remove();
                if(window.MartinelloRankingReceber===callback)delete window.MartinelloRankingReceber;
                resolve(id);
            }
            window.MartinelloRankingReceber=callback;
            const url=new URL(endpoint);
            url.searchParams.set('action','rankingOfertas');
            url.searchParams.set('requestId',requestId);
            url.searchParams.set('ids',chave);
            script=document.createElement('script');script.src=url.href;script.async=true;
            script.onerror=()=>finalizar('');
            timeout=setTimeout(()=>finalizar(''),9000);
            document.head.appendChild(script);
        }).then(id=>{
            if(this._pendente?.chave===chave) {
                this._chave=chave;
                this._lider=ids.includes(id)?id:'';
                this._consultadoEm=Date.now();
            }
            return this._lider;
        }).finally(()=>{if(this._pendente?.chave===chave)this._pendente=null;});
        this._pendente={chave,promessa};
        return promessa;
    }
};
