// ============================================
// presenter/index-presenter.js
// Toda a lógica do portal do vendedor
// ============================================

const IndexPresenter = {

    ofertaAtual: null,
    buscando:    false,
    enviando:    false,
    intervalo:   null,

    // ── INICIALIZAÇÃO ───────────────────────

    async init() {
        Storage.verificarQuota(); // Limpar localStorage se cheio (Safari/iPhone)
        console.log('🚀 Portal do Vendedor iniciando...');

        UI.tema.aplicar(Storage.carregarTema());

        UI.imagemFallback(
            document.getElementById('fotoProduto'),
            this._configEmBreve().imagem
        );

        // Pré-preencher última matrícula
        const ultima = Storage.carregarUltimaMatricula();
        if (ultima) {
            const inp = document.getElementById('cod');
            inp.value = ultima;
            this._atualizarBordaMatricula(inp);
            console.log('↩️ Última matrícula restaurada:', ultima);
        }

        this._renderCarregando();

        // Exibir cache IMEDIATAMENTE (< 100ms)
        const cacheImediato = Storage.ofertaAtivaDoCache();
        if (cacheImediato) {
            this.ofertaAtual = cacheImediato;
            this._renderOferta(cacheImediato);
        }

        // Ciclo de relógio + verificação de expiração (1s)
        this.intervalo = setInterval(() => this._tick(), 1000);

        // Pausar quando aba está em background
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                console.log('👁️ Aba em background — pausando ciclo');
                clearInterval(this.intervalo);
            } else {
                console.log('👁️ Aba ativa novamente — sincronizando');
                this._syncFirebase();
                this.intervalo = setInterval(() => this._tick(), 1000);
            }
        });

        // Sync Firebase inicial + ciclo de 30s
        await this._syncFirebase();
        setInterval(() => this._syncFirebase(), 30000);

        // Efeito glow
        setInterval(() => {
            const btn = document.getElementById('btnEnviar');
            if (btn && !btn.disabled) {
                btn.classList.add('glow');
                setTimeout(() => btn.classList.remove('glow'), 1000);
            }
        }, 3000);

        console.log('✅ Portal do Vendedor pronto!');
    },

    // ── CICLO DE 1S ─────────────────────────

    _tick() {
        const agora = getHorarioBrasilia();
        document.getElementById('infoHoraBrasilia').innerText = formatarBrasilia(agora);

        if (this.ofertaAtual) {
            if (!isOfertaAtiva(this.ofertaAtual, agora)) {
                console.log('⌛ Oferta expirou — voltando para EM BREVE');
                this.ofertaAtual = null;
                Storage.ofertaAtivaDoCache();
                this._renderOferta(null);
            } else {
                const cd = countdownTexto(this.ofertaAtual.dataFim);
                const el = document.getElementById('infoCountdown');
                if (el) el.innerText = cd ? `⏱ Encerra em ${cd}` : '';
            }
            return;
        }

        const cache = Storage.ofertaAtivaDoCache();
        if (cache) {
            this.ofertaAtual = cache;
            this._renderOferta(cache);
        }
    },

    // ── SYNC FIREBASE ───────────────────────

    async _syncFirebase() {
        if (this.buscando) return;
        this.buscando = true;
        console.log('🔄 Sincronizando com Firebase...');
        try {
            const ofertas = await Storage.carregarOfertas();
            const agora   = getHorarioBrasilia();
            const ativa   = ofertas.find(o => isOfertaAtiva(o, agora)) || null;

            if (ativa) {
                // Sempre atualizar — garante que imagem do Firebase substitui cache sem imagem
                const mesmaOferta = this.ofertaAtual && this.ofertaAtual.id === ativa.id;
                const semImagem   = mesmaOferta && !this.ofertaAtual.urlImagem && ativa.urlImagem;
                if (!mesmaOferta || semImagem) {
                    if (!mesmaOferta) console.log('🆕 Nova oferta:', ativa.tituloPagina);
                    if (semImagem)    console.log('🖼️ Atualizando imagem do Firebase...');
                    this.ofertaAtual = ativa;
                    this._renderOferta(ativa);
                }
            } else if (!this.ofertaAtual) {
                this._renderOferta(null);
            }
        } finally {
            this.buscando = false;
        }
    },

    // ── RENDER ──────────────────────────────

    _configEmBreve() {
        return Storage.carregarConfigEmBreve() || {
            imagem: 'img/produto.png',
            titulo: 'EM BREVE',
            mensagem: 'Estamos preparando novidades especiais! Fique ligado.',
        };
    },

    _renderCarregando() {
        document.getElementById('tituloPagina').innerText    = 'CARREGANDO...';
        document.getElementById('infoOferta').innerText      = 'Verificando...';
        document.getElementById('infoStatus').innerHTML      = 'CARREGANDO...';
        document.getElementById('infoStatus').className      = 'status-text status-carregando';
        document.getElementById('cod').disabled              = true;
        document.getElementById('btnEnviar').disabled        = true;
        document.querySelector('.btn-text').textContent      = 'CARREGANDO...';
    },

    _renderOferta(oferta) {
        const status = document.getElementById('infoStatus');
        const ofEl   = document.getElementById('infoOferta');
        const cdEl   = document.getElementById('infoCountdown');

        if (oferta) {
            console.log('🟢 Exibindo oferta:', oferta.tituloPagina);
            document.querySelector('h2').innerText              = oferta.tituloPagina;
            document.getElementById('fotoProduto').src          = oferta.urlImagem || 'img/produto.png';
            document.getElementById('cod').disabled             = false;
            document.getElementById('btnEnviar').disabled       = false;
            document.querySelector('.btn-text').textContent     = 'GERAR E ENVIAR NO WHATSAPP';
            document.getElementById('mensagemEmBreve').style.display = 'none';
            ofEl.innerText   = oferta.tituloPagina;
            status.innerHTML = '✅ OFERTA ATIVA';
            status.className = 'status-text status-ativo';
            if (cdEl) {
                const cd = countdownTexto(oferta.dataFim);
                cdEl.innerText = cd ? `⏱ Encerra em ${cd}` : '';
            }
        } else {
            console.log('⏸️ Exibindo tela EM BREVE');
            const cfg = this._configEmBreve();
            document.querySelector('h2').innerText              = cfg.titulo;
            document.getElementById('fotoProduto').src          = cfg.imagem;
            document.getElementById('cod').disabled             = true;
            document.getElementById('btnEnviar').disabled       = true;
            document.querySelector('.btn-text').textContent     = 'EM BREVE';
            const msg = document.getElementById('mensagemEmBreve');
            msg.innerText     = cfg.mensagem;
            msg.style.display = cfg.mensagem ? 'block' : 'none';
            ofEl.innerText    = 'EM BREVE';
            status.innerHTML  = '⏸️ SEM OFERTAS';
            status.className  = 'status-text status-embreve';
            if (cdEl) cdEl.innerText = '';
        }
    },

    // ── MATRÍCULA ───────────────────────────

    validarMatriculaInput(input) {
        let v = input.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 5);
        input.value = v;
        this._atualizarBordaMatricula(input);
    },

    _atualizarBordaMatricula(input) {
        const valido = Validators.matricula(input.value);
        input.style.borderColor = input.value.length === 0 ? '' :
                                  valido ? 'var(--whatsapp-color)' : '#dc3545';
    },

    // ── ENVIO ───────────────────────────────

    async enviar() {
        const oferta = this.ofertaAtual || Storage.ofertaAtivaDoCache();
        if (!oferta) { UI.erro('Nenhuma oferta ativa no momento'); return; }
        if (this.enviando) return;

        const codInput = document.getElementById('cod').value.trim();
        if (!Validators.matricula(codInput)) {
            UI.erro('Digite uma matrícula válida (3 ou 5 números)');
            return;
        }

        const btn     = document.getElementById('btnEnviar');
        const btnText = btn.querySelector('.btn-text');
        const orig    = btnText.textContent;

        this.enviando     = true;
        btn.disabled      = true;
        btnText.innerHTML = '<span class="spinner"></span>PROCESSANDO...';

        try {
            Storage.salvarUltimaMatricula(codInput);
            const link  = `${CONFIG.urlBase}${codInput}?redir=${encodeURIComponent(oferta.linkProduto)}`;
            const texto = formatarTexto(oferta.textoOferta, link, codInput);
            const nav   = getBrowserName();

            console.log('📤 Enviando oferta — matrícula:', codInput, '| navegador:', nav);

            await API.rastrear(codInput, nav);
            await API.compartilhar(texto, document.getElementById('fotoProduto').src);

            console.log('✅ Oferta compartilhada com sucesso!');
        } catch (e) {
            console.error('❌ Erro ao compartilhar:', e);
            UI.erro('Erro ao compartilhar. Tente novamente.');
        } finally {
            btn.disabled        = false;
            btnText.textContent = orig;
            this.enviando       = false;
        }
    },
};

// ── BOOTSTRAP ────────────────────────────────
document.addEventListener('DOMContentLoaded', () => IndexPresenter.init());

function enviar()                { IndexPresenter.enviar(); }
function validarMatricula(input) { IndexPresenter.validarMatriculaInput(input); }
