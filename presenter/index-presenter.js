// Portal Martinello — seleção de várias ofertas simultâneas (1.6.2)
const IndexPresenter = {
    ofertas: [],
    ofertaAtual: null,
    buscando: false,
    enviando: false,
    intervalo: null,
    _assinatura: '',
    pararSyncOfertas: null,
    _rankingSolicitado: '',
    _aparenciaOuvindo: false,
    _selecaoManual: false,
    _destaqueAnterior: undefined,
    _avisosHoje: new Set(),

    async init() {
        Storage.verificarQuota();
        UI.tema.aplicar(Storage.carregarTema());
        UI.imagemFallback(document.getElementById('fotoProduto'), this._configEmBreve().imagem);
        const cod = Storage.carregarUltimaMatricula();
        if (cod) {
            const input = document.getElementById('cod');
            input.value = cod;
            this._atualizarBordaMatricula(input);
        }
        // O registro agora usa um coletor público limitado (Google Sheets).
        // Não requer login Firebase dos vendedores.
        this._renderCarregando();
        // Identificação de campanha não bloqueia a vitrine; registrar assim que for resolvida.
        CampanhasPortal.carregar().catch(()=> '').then(()=>AnalyticsService.registrarVisita())
            .catch(e=>console.warn('Visita não registrada:',e));
        const cache = Storage.ofertasDoCache();
        if (cache.length) this._aplicarOfertas(cache);
        this.intervalo = setInterval(() => this._tick(), 1000);
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) { clearInterval(this.intervalo); this.intervalo = null; }
            else { this._syncFirebase(); if (!this.intervalo) this.intervalo = setInterval(() => this._tick(), 1000); }
        });
        await this._syncFirebase();
        this.pararSyncOfertas=Storage.escutarOfertas(ofertas => {
            this._aplicarOfertas(ofertas);
            this._assinatura=this._ativas().map(o=>String(o.id)).join(',');
        }, e=>console.warn('Sincronização de ofertas temporariamente indisponível:',e));
        // Identidade visual pública: atualizada em todos os celulares e computadores.
        this._carregarAparencia();
        // A assinatura do Firebase já notifica a cada alteração; evita consultas repetidas.
    },

    async _carregarAparencia() {
        try {
            const dados = await AparenciaPortal.carregar();
            this._aplicarAparencia(dados);
            // Atualizar identidade visual em tempo real nos dois portais.
            if (!this._aparenciaOuvindo) {
                this._aparenciaOuvindo=true;
                AparenciaPortal.referencia.on('value', snap => {
                    const dados = snap.exists() ? AparenciaPortal._normalizar(snap.val()) : {...AparenciaPortal.padrao};
                    AparenciaPortal.dados=dados;
                    this._aplicarAparencia(dados);
                },erro=>console.warn('Aparência: sincronização indisponível:',erro));
            }
        } catch (erro) {
            console.warn('Aparência pública indisponível, mantendo padrão:', erro.message);
        }
    },
    _aplicarAparencia(dados) {
        const logo=document.getElementById('logoPortal');
        if(logo)logo.src=dados?.logo||'img/logo.png';
        this._renderCatalogo(this._ativas());
        this._renderOferta(this.ofertaAtual);
    },

    _configEmBreve() {
        return AparenciaPortal.dados || Storage.carregarConfigEmBreve() || {
            imagem: 'img/produto.png', titulo: 'EM BREVE',
            mensagem: 'Estamos preparando novidades especiais! Fique ligado.'
        };
    },

    _ativas(agora = getHorarioBrasilia()) {
        return this.ofertas.filter(o => isOfertaAtiva(o, agora))
            .sort((a,b) => (a.tituloPagina || '').localeCompare(b.tituloPagina || '', 'pt-BR'));
    },

    _renderCarregando() {
        document.getElementById('tituloPagina').textContent = 'CARREGANDO...';
        document.getElementById('infoOferta').textContent = 'Verificando...';
        document.getElementById('infoStatus').textContent = 'CARREGANDO...';
        document.getElementById('infoStatus').className = 'status-text status-carregando';
        document.getElementById('cod').disabled = true;
        document.getElementById('btnEnviar').disabled = true;
        document.querySelector('#btnEnviar .btn-text').textContent = 'CARREGANDO...';
    },

    _aplicarOfertas(ofertas) {
        this.ofertas = Array.isArray(ofertas) ? ofertas : [];
        const ativas = this._ativas();
        const atual = ativas.find(o => String(o.id) === String(this.ofertaAtual?.id));
        if(!atual)this._selecaoManual=false;
        // A escolha manual só é interrompida pela entrada de um NOVO destaque.
        // Atualizações normais do Firebase/ranking não mudam a escolha do vendedor.
        const destaqueVigente=PortalPreferencias.destaque(ativas,getHorarioBrasilia());
        const destaqueId=destaqueVigente?String(destaqueVigente.id):'';
        if(this._destaqueAnterior!==undefined && destaqueId && destaqueId!==this._destaqueAnterior)
            this._selecaoManual=false;
        this._destaqueAnterior=destaqueId;
        this.ofertaAtual = PortalPreferencias.inicial(ativas,RankingOfertas.liderAtivas(ativas),atual,this._selecaoManual,getHorarioBrasilia());
        this._renderCatalogo(ativas);
        this._renderOferta(this.ofertaAtual);
        this._atualizarRanking(ativas);
    },

    _atualizarRanking(ativas) {
        const ids = ativas.map(o=>String(o.id)).sort().join(',');
        if (ids === this._rankingSolicitado) return;
        this._rankingSolicitado = ids;
        if (!ids) return;
        RankingOfertas.carregar(ativas).then(() => {
            // Nunca aplicar resultado de um conjunto desatualizado.
            if (this._rankingSolicitado !== ids) return;
            const atuais=this._ativas();
            this.ofertaAtual=PortalPreferencias.inicial(atuais,RankingOfertas.liderAtivas(atuais),this.ofertaAtual,this._selecaoManual||this.enviando,getHorarioBrasilia());
            this._renderCatalogo(atuais);
            this._renderOferta(this.ofertaAtual);
        }).catch(() => {});
    },

    _renderCatalogo(ativas) {
        const secao=document.getElementById('secaoCatalogo');
        const grid=document.getElementById('catalogoOfertas');
        const total=document.getElementById('totalCatalogo');
        const painel=document.getElementById('destaquesOfertas');
        if(!secao||!grid||!painel)return;
        const lider=RankingOfertas.liderAtivas(ativas);
        const escolhida=PortalPreferencias.destaque(ativas,getHorarioBrasilia());
        const cards=[];
        const mais=ativas.find(o=>String(o.id)===lider);
        if(mais)cards.push({o:mais,selo:'★ MAIS ACIONADA'});
        if(escolhida && String(escolhida.id)!==String(mais?.id))cards.push({o:escolhida,selo:'✦ DESTAQUE DO DIA'});
        // Caso coincidam, exibir um único card com identificação combinada.
        if(escolhida && mais && String(escolhida.id)===String(mais.id))cards[0].selo='★ MAIS ACIONADA · DESTAQUE DO DIA';
        const ids=new Set(cards.map(c=>String(c.o.id)));
        secao.hidden=ativas.length<2 && !cards.length;
        total.textContent=`${ativas.length} oferta${ativas.length===1?'':'s'} ${ativas.length===1?'disponível':'disponíveis'}`;
        painel.replaceChildren();grid.replaceChildren();
        const montar=(oferta,selo,classe)=>{
            const btn=document.createElement('button');btn.type='button';btn.className=classe;
            const selecionado=String(oferta.id)===String(this.ofertaAtual?.id);
            btn.setAttribute('aria-pressed',String(selecionado));
            if(selecionado)btn.classList.add('selecionada');
            const img=document.createElement('img');img.src=oferta.urlImagem||'img/produto.png';img.alt='';
            img.loading='lazy';img.decoding='async';img.onerror=()=>{img.onerror=null;img.src='img/produto.png';};
            const texto=document.createElement('strong');texto.textContent=oferta.tituloPagina||'Oferta';
            btn.append(img,texto);
            if(selo){const tag=document.createElement('small');tag.textContent=selo;btn.prepend(tag);}
            btn.addEventListener('click',()=>this.selecionarOferta(oferta.id));return btn;
        };
        for(const c of cards)painel.appendChild(montar(c.o,c.selo,'oferta-destaque'));
        for(const oferta of ativas.filter(o=>!ids.has(String(o.id))))
            grid.appendChild(montar(oferta,'','catalogo-item'));
    },

    selecionarOferta(id) {
        const oferta = this._ativas().find(o => String(o.id) === String(id));
        if (!oferta) return;
        this._selecaoManual = true;
        this.ofertaAtual = oferta;
        this._renderCatalogo(this._ativas());
        this._renderOferta(oferta);
        const botao=document.getElementById('btnEnviar');
        botao?.focus({preventScroll:true});
        botao?.scrollIntoView({block:'center',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
    },

    _renderOferta(oferta) {
        const cfg = this._configEmBreve();
        const info = document.getElementById('infoOferta');
        const status = document.getElementById('infoStatus');
        const msg = document.getElementById('mensagemEmBreve');
        const countdown = document.getElementById('infoCountdown');
        const btn = document.getElementById('btnEnviar');
        const titulo = oferta?.tituloPagina || cfg.titulo;
        document.getElementById('tituloPagina').textContent = titulo;
        document.getElementById('fotoProduto').src = oferta?.urlImagem || cfg.imagem;
        document.getElementById('cod').disabled = !oferta;
        btn.disabled = !oferta || this.enviando;
        btn.querySelector('.btn-text').textContent = oferta ? 'GERAR E COMPARTILHAR ESTA OFERTA' : 'EM BREVE';
        info.textContent = oferta ? titulo : 'EM BREVE';
        status.textContent = oferta ? '✅ OFERTA DISPONÍVEL' : '⏸️ SEM OFERTAS';
        status.className = `status-text ${oferta ? 'status-ativo' : 'status-embreve'}`;
        msg.textContent = oferta ? '' : cfg.mensagem;
        msg.style.display = !oferta && cfg.mensagem ? 'block' : 'none';
        if (countdown) {
            countdown.style.display = oferta ? '' : 'none';
            const el = countdown.querySelector('span');
            if (el) el.textContent = oferta ? `Encerra em ${countdownTexto(oferta.dataFim) || 'instantes'}` : '';
        }
    },

    _tick() {
        const agora = getHorarioBrasilia();
        document.getElementById('infoHoraBrasilia').textContent = formatarBrasilia(agora);
        const atual = this._ativas(agora);
        const ids = atual.map(o => String(o.id)).join(',');
        // Detectar também destaques que iniciam por agendamento sem gravar no Firebase.
        const destaqueAgora=PortalPreferencias.destaque(atual,agora);
        const mudouDestaque=this._destaqueAnterior!==undefined
            && String(destaqueAgora?.id||'')!==this._destaqueAnterior;
        if (ids !== this._assinatura || mudouDestaque || (this.ofertaAtual && !isOfertaAtiva(this.ofertaAtual, agora))) {
            this._assinatura = ids;
            this._aplicarOfertas(this.ofertas);
            return;
        }
        if (this.ofertaAtual) {
            const el = document.querySelector('#infoCountdown span');
            if (el) el.textContent = `Encerra em ${countdownTexto(this.ofertaAtual.dataFim) || 'instantes'}`;
        }
    },

    async _syncFirebase() {
        if (this.buscando) return;
        this.buscando = true;
        try {
            const ofertas = await Storage.carregarOfertas();
            this._aplicarOfertas(ofertas);
            this._assinatura = this._ativas().map(o => String(o.id)).join(',');
        } catch (erro) {
            console.error('Não foi possível carregar ofertas:', erro);
            UI.erro('Não foi possível atualizar as ofertas.');
        } finally { this.buscando = false; }
    },

    validarMatriculaInput(input) {
        input.value = input.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 5);
        this._atualizarBordaMatricula(input);
    },
    _atualizarBordaMatricula(input) {
        const valido = Validators.matricula(input.value);
        input.style.borderColor = !input.value ? '' : valido ? 'var(--whatsapp-color)' : '#dc3545';
    },

    async _avisarNaoVendedor(cod) {
        const hoje=PortalPreferencias.dia();
        const chave='mart:nao-vendedor:'+location.pathname+':'+cod;
        const memoria=chave+':'+hoje;
        if(this._avisosHoje.has(memoria))return;
        let armazenamento;try{armazenamento=window.localStorage;}catch(_){armazenamento=null;}
        if(!PortalPreferencias.deveAvisar(armazenamento,chave,hoje))return;
        const card=document.getElementById('avisoNaoVendedor');
        if(!card)return;
        this._avisosHoje.add(memoria);
        card.hidden=false;
        const continuar=document.getElementById('avisoNaoVendedorContinuar');
        continuar?.focus({preventScroll:true});
        // O aviso é mostrado ANTES de tentar abrir a tela de compartilhamento.
        // Continua após confirmação/fechamento ou, automaticamente, após 20 segundos.
        return await new Promise(resolve=>{
            this._avisoResolucao=resolve;
            clearInterval(this._avisoTimer);
            let restante=20;
            const contador=document.getElementById('avisoNaoVendedorContador');
            const atualizar=()=>{if(contador)contador.textContent=String(restante);};
            atualizar();
            this._avisoTimer=setInterval(()=>{
                if(document.hidden)return;
                restante--;
                atualizar();
                if(restante<=0)this.fecharAvisoNaoVendedor('tempo');
            },1000);
        });
    },
    fecharAvisoNaoVendedor(motivo='continuar'){
        clearInterval(this._avisoTimer);
        this._avisoTimer=null;
        const card=document.getElementById('avisoNaoVendedor');
        if(card)card.hidden=true;
        const resolver=this._avisoResolucao;
        this._avisoResolucao=null;
        if(resolver)resolver(motivo);
    },

    async enviar() {
        if (this.enviando) return;
        const oferta = this.ofertaAtual;
        if (!oferta || !isOfertaAtiva(oferta, getHorarioBrasilia())) {
            UI.erro('Esta oferta não está mais disponível. Selecione outra.');
            this._aplicarOfertas(this.ofertas);
            return;
        }
        const cod = document.getElementById('cod').value.trim();
        if (!Validators.matricula(cod)) { UI.erro('Digite uma matrícula válida (3 a 5 números).'); return; }
        const btn = document.getElementById('btnEnviar');
        const texto = btn.querySelector('.btn-text');
        this.enviando = true;
        btn.disabled = true;
        texto.textContent = 'PREPARANDO...';
        try {
            // A classificação vem da planilha do ambiente, por consulta pública sem dados pessoais.
            // Em caso de falha de rede, NUNCA presumimos que uma matrícula esteja ativa.
            const vendedorAtivo = await TelefonePortal.consultarMatricula(cod);
            // O aviso será exibido depois de preparar a mensagem, imediatamente antes do compartilhamento.
            if(vendedorAtivo!==true&&vendedorAtivo!==false)UI.erro('Não foi possível verificar a matrícula. Por segurança, será usado o link padrão da Martinello.');
            if (vendedorAtivo === true) {
                const continuar = await TelefonePortal.garantir(cod);
                if (!continuar) return;
            }
            Storage.salvarUltimaMatricula(cod);
            // Não compartilhar com campanha indefinida ou configuração remota indisponível.
            await CampanhasPortal.carregar();
            const link = LinkTrack.urlCompartilhavel(oferta,cod,vendedorAtivo===true);
            const msg = formatarTexto(oferta.textoOferta, link, cod);
            // Não atribuir acesso de não vendedor aos rankings de vendedores ativos.
            if(vendedorAtivo===true){
                const registro = AnalyticsService.registrarInicio(oferta, cod)
                    .catch(e => { console.warn('Telemetria: erro inesperado:', e); return false; });
                await API.rastrear(cod, getBrowserName());
                await Promise.race([registro, new Promise(resolve => setTimeout(resolve, 1200))]);
            }
            if(vendedorAtivo===false) {
                const resultadoAviso=await this._avisarNaoVendedor(cod);
                if(resultadoAviso==='tempo') {
                    // O Web Share precisa de um gesto real do usuário. Não tente abrir
                    // automaticamente uma janela após 20 s de espera.
                    UI.ok('Aviso fechado. Toque novamente em GERAR E COMPARTILHAR para enviar a oferta.');
                    return;
                }
            }
            await API.compartilhar(msg, oferta.urlImagem || 'img/produto.png');
        } catch (e) {
            console.error('Falha na preparação do compartilhamento:', e);
            const mensagem=String(e?.message||'');
            if(/campanha|rastreio|URL HTTPS oficial|destino precisa|API pública/i.test(mensagem))
                UI.erro(mensagem);
            else UI.erro('Não foi possível preparar a mensagem. Tente novamente.');
        } finally {
            this.enviando = false;
            this._renderOferta(this.ofertaAtual);
        }
    }
};
document.addEventListener('DOMContentLoaded', () => IndexPresenter.init());
function enviar() { return IndexPresenter.enviar(); }
function validarMatricula(input) { IndexPresenter.validarMatriculaInput(input); }
