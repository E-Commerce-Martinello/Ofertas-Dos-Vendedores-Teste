// Configuração pública do rastreio no Sheets, sem informações pessoais.
const CampanhasPortal = {
    geral:'',
    utmSource:'grupo_zap',
    utmId:'vendedores_zap',
    carregada:false,
    disponivel:false,
    consultadaEm:0,
    _pendente:null,
    slug(texto) {
        const t=String(texto||'').trim().toLowerCase();
        return /^[a-z0-9][a-z0-9_-]{0,59}$/.test(t)?t:'';
    },
    efetiva(oferta) {
        const individualBruto=this.slug(oferta?.campanha);
        // Ofertas legadas podem ter gravado o marcador antigo como se fosse nome.
        const individual=individualBruto==='sem_campanha'?'':individualBruto;
        const geralBruto=this.slug(this.geral);
        const geral=geralBruto==='sem_campanha'?'':geralBruto;
        if(!individual&&!geral)
            throw new Error('Nenhuma campanha configurada. Defina a campanha geral no admin ou uma campanha individual nesta oferta.');
        return individual||geral;
    },
    // Refaz a consulta antes de compartilhar se o cache venceu. Nunca marca
    // carregamento como concluído diante de falha na rede ou do coletor.
    carregar(forcar=false) {
        if(this._pendente)return this._pendente;
        if(!forcar&&this.carregada&&Date.now()-this.consultadaEm<30000)
            return Promise.resolve(this.geral);
        const endpoint=String(CONFIG.portalEventsApiUrl||'');
        if(!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(endpoint))
            return Promise.reject(new Error('A API pública de campanhas não está configurada.'));
        this._pendente=new Promise((resolve,reject)=>{
            let finalizado=false,script,timer;
            const req='cp_'+Date.now()+'_'+Math.random().toString(36).slice(2,13);
            const limpar=(dados,erro)=>{
                if(finalizado)return;
                finalizado=true;
                clearTimeout(timer);script?.remove();
                if(window.MartinelloCampanhaReceber===receber)delete window.MartinelloCampanhaReceber;
                if(erro||!dados||dados.disponivel===false){
                    this.disponivel=false;this.carregada=false;
                    reject(new Error('Não foi possível atualizar a campanha geral. Verifique a conexão e o Apps Script coletor.'));
                    return;
                }
                this.geral=this.slug(dados.campanha);
                this.utmSource=this.slug(dados.utmSource)||'grupo_zap';
                this.utmId=this.slug(dados.utmId)||'vendedores_zap';
                this.carregada=true;this.disponivel=true;this.consultadaEm=Date.now();
                resolve(this.geral);
            };
            const receber=d=>{if(d?.requestId===req)limpar(d,false);};
            window.MartinelloCampanhaReceber=receber;
            const url=new URL(endpoint);
            url.searchParams.set('action','consultarCampanha');
            url.searchParams.set('requestId',req);
            script=document.createElement('script');script.src=url.href;
            script.onerror=()=>limpar(null,true);
            timer=setTimeout(()=>limpar(null,true),5000);
            document.head.appendChild(script);
        }).finally(()=>{this._pendente=null;});
        return this._pendente;
    }
};
