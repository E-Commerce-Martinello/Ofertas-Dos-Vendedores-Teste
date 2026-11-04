// Portal Martinello — seleção de várias ofertas simultâneas (1.6.2)
const IndexPresenter = {
    ofertas: [],
    ofertaAtual: null,
    buscando: false,
    enviando: false,
    intervalo: null,
    _assinatura: '',

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
        const cache = Storage.ofertasDoCache();
        if (cache.length) this._aplicarOfertas(cache);
        this.intervalo = setInterval(() => this._tick(), 1000);
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) { clearInterval(this.intervalo); this.intervalo = null; }
            else { this._syncFirebase(); if (!this.intervalo) this.intervalo = setInterval(() => this._tick(), 1000); }
        });
        await this._syncFirebase();
        setInterval(() => { if (!document.hidden) this._syncFirebase(); }, 30000);
    },

    _configEmBreve() {
        return Storage.carregarConfigEmBreve() || {
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
        this.ofertaAtual = atual || ativas[0] || null;
        this._renderCatalogo(ativas);
        this._renderOferta(this.ofertaAtual);
    },

    _renderCatalogo(ativas) {
        const secao = document.getElementById('secaoCatalogo');
        const grid = document.getElementById('catalogoOfertas');
        const total = document.getElementById('totalCatalogo');
        if (!secao || !grid) return;
        secao.hidden = ativas.length < 2;
        total.textContent = `${ativas.length} oferta${ativas.length === 1 ? '' : 's'} disponível${ativas.length === 1 ? '' : 'is'}`;
        grid.replaceChildren();
        for (const oferta of ativas) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'catalogo-item';
            const selecionado = String(oferta.id) === String(this.ofertaAtual?.id);
            btn.setAttribute('aria-pressed', String(selecionado));
            if (selecionado) btn.classList.add('selecionada');
            const img = document.createElement('img');
            img.src = oferta.urlImagem || 'img/produto.png';
            img.alt = '';
            img.loading = 'lazy';
            img.onerror = () => { img.onerror = null; img.src = 'img/produto.png'; };
            const texto = document.createElement('span');
            texto.textContent = oferta.tituloPagina || 'Oferta';
            btn.append(img, texto);
            btn.addEventListener('click', () => this.selecionarOferta(oferta.id));
            grid.appendChild(btn);
        }
    },

    selecionarOferta(id) {
        const oferta = this._ativas().find(o => String(o.id) === String(id));
        if (!oferta) return;
        this.ofertaAtual = oferta;
        this._renderCatalogo(this._ativas());
        this._renderOferta(oferta);
        document.getElementById('btnEnviar')?.focus({ preventScroll: true });
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
        if (ids !== this._assinatura || (this.ofertaAtual && !isOfertaAtiva(this.ofertaAtual, agora))) {
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
            Storage.salvarUltimaMatricula(cod);
            const link = `${CONFIG.urlBase}${cod}?redir=${encodeURIComponent(oferta.linkProduto)}`;
            const msg = formatarTexto(oferta.textoOferta, link, cod);
            // A telemetria é indicativa e não pode bloquear o compartilhamento.
            // Uma tentativa por oferta, matrícula e janela de dez minutos/navegador.
            const registro = AnalyticsService.registrarInicio(oferta, cod)
                .catch(e => { console.warn('Telemetria: erro inesperado:', e); return false; });
            await API.rastrear(cod, getBrowserName());
            // Aguarda no máximo um instante pelo despacho, sem bloquear o WhatsApp.
            await Promise.race([registro, new Promise(resolve => setTimeout(resolve, 1200))]);
            await API.compartilhar(msg, oferta.urlImagem || 'img/produto.png');
        } catch (e) {
            console.error('Falha na preparação do compartilhamento:', e);
            UI.erro('Não foi possível preparar a mensagem. Tente novamente.');
        } finally {
            this.enviando = false;
            this._renderOferta(this.ofertaAtual);
        }
    }
};
document.addEventListener('DOMContentLoaded', () => IndexPresenter.init());
function enviar() { return IndexPresenter.enviar(); }
function validarMatricula(input) { IndexPresenter.validarMatriculaInput(input); }
