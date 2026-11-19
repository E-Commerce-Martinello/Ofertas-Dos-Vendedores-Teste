// Configuração administrativa compartilhada: campanha geral + UTMs avançadas.
const CampanhasPresenter = {
    config:{campanhaGeral:'',linkGrupo:'https://www.martinello.com.br/ofertasvendedor',
        utmSource:'grupo_zap',utmId:'vendedores_zap',revision:''},
    carregando:false,
    _msg(m,erro=false){
        const e=document.getElementById('statusCampanhaGeral');
        if(e){e.textContent=m;e.style.color=erro?'#bb2832':'';}
    },
    prever(){
        const geral=String(document.getElementById('campanhaGeral')?.value||'').trim().toLowerCase();
        const source=String(document.getElementById('campanhaUtmSource')?.value||'').trim().toLowerCase();
        const id=String(document.getElementById('campanhaUtmId')?.value||'').trim().toLowerCase();
        const valores={
            campanhaPreviewSource:'utm_source='+(source||'grupo_zap'),
            campanhaPreviewCampaign:'utm_campaign='+(geral||'NOME_DA_CAMPANHA'),
            campanhaPreviewId:'utm_id='+(id||'vendedores_zap')
        };
        for(const [campo,valor] of Object.entries(valores)){
            const el=document.getElementById(campo);
            if(el)el.textContent=valor;
        }
    },
    _sincronizarPortal(){
        CampanhasPortal.geral=CampanhasPortal.slug(this.config.campanhaGeral);
        CampanhasPortal.utmSource=CampanhasPortal.slug(this.config.utmSource)||'grupo_zap';
        CampanhasPortal.utmId=CampanhasPortal.slug(this.config.utmId)||'vendedores_zap';
        CampanhasPortal.carregada=true;
        CampanhasPortal.disponivel=true;
        CampanhasPortal.consultadaEm=Date.now();
    },
    async carregar(){
        if(this.carregando)return;
        this.carregando=true;
        this._msg('Carregando configuração compartilhada…');
        try{
            const recebido=await GoogleSheetsService.listarCampanhas();
            if(EdicaoSegura.sujo('campanha'))return;
            this.config={
                ...recebido,
                utmSource:CampanhasPortal.slug(recebido.utmSource)||'grupo_zap',
                utmId:CampanhasPortal.slug(recebido.utmId)||'vendedores_zap'
            };
            this._sincronizarPortal();
            const geral=document.getElementById('campanhaGeral');
            const source=document.getElementById('campanhaUtmSource');
            const id=document.getElementById('campanhaUtmId');
            if(geral)geral.value=this.config.campanhaGeral||'';
            if(source)source.value=this.config.utmSource;
            if(id)id.value=this.config.utmId;
            this.prever();
            this._msg('Campanha geral atual: '+(this.config.campanhaGeral||'não definida')
                +'. Todas as ofertas sem campanha individual seguem essa configuração.');
        }catch(e){this._msg('Não foi possível carregar a campanha: '+e.message,true);}
        finally{this.carregando=false;}
    },
    async salvar(){
        const geral=String(document.getElementById('campanhaGeral')?.value||'').trim().toLowerCase();
        const source=String(document.getElementById('campanhaUtmSource')?.value||'').trim().toLowerCase();
        const id=String(document.getElementById('campanhaUtmId')?.value||'').trim().toLowerCase();
        const valido=s=>/^[a-z0-9][a-z0-9_-]{0,59}$/.test(s);
        if(geral==='sem_campanha'){this._msg('Defina um nome de campanha real; sem_campanha é um marcador antigo.',true);return;}
        if(geral&&!valido(geral)){this._msg('Campanha: use até 60 letras minúsculas, números, _ ou -, sem espaços.',true);return;}
        if(!valido(source)||!valido(id)){
            this._msg('UTM source e UTM id: use até 60 letras minúsculas, números, _ ou -, sem espaços.',true);return;
        }
        const link=this.config.linkGrupo||'https://www.martinello.com.br/ofertasvendedor';
        const btn=document.getElementById('btnSalvarCampanhas');
        if(btn)btn.disabled=true;
        this._msg('Salvando configuração de rastreio…');
        try{
            const config=await GoogleSheetsService.salvarCampanhas(
                geral,link,this.config.revision||'',source,id
            );
            if(config.campanhaGeral!==geral || config.utmSource!==source || config.utmId!==id)
                throw new Error('O Apps Script não confirmou os campos UTM. Atualize Code.gs e publique uma nova versão antes de salvar.');
            this.config=config;
            if(
                document.getElementById('campanhaGeral')?.value.trim().toLowerCase()===geral &&
                document.getElementById('campanhaUtmSource')?.value.trim().toLowerCase()===source &&
                document.getElementById('campanhaUtmId')?.value.trim().toLowerCase()===id
            )EdicaoSegura.limpar('campanha');
            this._sincronizarPortal();
            this._msg('Configuração salva. Campanha geral: '+(config.campanhaGeral||'não definida')+
                '. O portal pode levar até um minuto para refletir a mudança.');
            UI.ok('Configuração de campanha e UTM salva no Google Sheets.');
            DashboardPresenter?.atualizarFiltroCampanhas?.();
        }catch(e){this._msg('Não foi possível salvar: '+e.message,true);}
        finally{if(btn)btn.disabled=false;}
    }
};
