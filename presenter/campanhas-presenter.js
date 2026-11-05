// Campanhas gerais editadas no Sheets pela API autenticada.
const CampanhasPresenter = {
    config:{campanhaGeral:'',linkGrupo:'https://www.martinello.com.br/ofertasvendedor',revision:''},
    carregando:false,
    _msg(m,erro=false){const e=document.getElementById('statusCampanhaGeral');if(e){e.textContent=m;e.style.color=erro?'#bb2832':'';}},
    async carregar() {
        if(this.carregando)return;
        this.carregando=true;this._msg('Carregando configuração compartilhada…');
        try{
            this.config=await GoogleSheetsService.listarCampanhas();
            CampanhasPortal.geral=CampanhasPortal.slug(this.config.campanhaGeral);
            const geral=document.getElementById('campanhaGeral');
            const link=document.getElementById('linkGrupoCompacto');
            if(geral)geral.value=this.config.campanhaGeral||'';
            if(link)link.value=this.config.linkGrupo||'https://www.martinello.com.br/ofertasvendedor';
            this._msg('Configuração compartilhada carregada. Campanha geral atual: '+(this.config.campanhaGeral||'sem campanha'));
        }catch(e){this._msg('Não foi possível carregar a campanha: '+e.message,true);}
        finally{this.carregando=false;}
    },
    async salvar() {
        const geral=String(document.getElementById('campanhaGeral')?.value||'').trim().toLowerCase();
        const link=String(document.getElementById('linkGrupoCompacto')?.value||'').trim();
        if(geral&&!/^[a-z0-9][a-z0-9_-]{0,59}$/.test(geral)){
            this._msg('Use letras minúsculas, números, traços ou _. Até 60 caracteres.',true);return;
        }
        const btn=document.getElementById('btnSalvarCampanhas');if(btn)btn.disabled=true;
        this._msg('Salvando a campanha geral…');
        try{
            const config=await GoogleSheetsService.salvarCampanhas(geral,link,this.config.revision||'');
            this.config=config;
            CampanhasPortal.geral=CampanhasPortal.slug(config.campanhaGeral);
            this._msg('Campanha geral salva: '+(config.campanhaGeral||'sem campanha')+'. Pode haver até um minuto de atraso no portal.');
            UI.ok('Campanha geral atualizada no Google Sheets.');
            DashboardPresenter?.atualizarFiltroCampanhas?.();
        }catch(e){this._msg('Não foi possível salvar: '+e.message,true);}
        finally{if(btn)btn.disabled=false;}
    }
};
