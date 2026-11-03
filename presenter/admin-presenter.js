// ============================================
// presenter/admin-presenter.js
// Toda a lógica do painel administrativo
// ============================================

const AdminPresenter = {

    ofertas: [],
    intervaloStatus: null,
    timerBloqueio: null,

    async init() {
        Storage.verificarQuota(); // Limpar localStorage se cheio (Safari/iPhone)
        console.log('🔐 Admin iniciando...');
        UI.tema.aplicar(Storage.carregarTema());

        if (Auth.sessaoValida()) {
            console.log('✅ Sessão válida — abrindo painel');
            await this._abrirPainel();
        } else {
            console.log('🔒 Sem sessão — exibindo login');
            this._mostrarLogin();
        }

        document.getElementById('senhaInput')
            ?.addEventListener('keydown', e => { if (e.key === 'Enter') this.login(); });
    },

    // ── LOGIN ────────────────────────────────

    _mostrarLogin() {
        document.getElementById('loginBox').style.display    = 'block';
        document.getElementById('painelAdmin').style.display = 'none';
        if (Auth.estaBloqueado()) this._iniciarTimerBloqueio();
    },

    async login() {
        if (Auth.estaBloqueado()) {
            UI.erro(`Bloqueado. Aguarde ${Auth.tempoRestanteBloqueio()}s.`);
            return;
        }

        const senha = document.getElementById('senhaInput').value;
        console.log('🔑 Tentativa de login...');
        const res = await Auth.verificarSenha(senha);

        if (res.ok) {
            console.log('✅ Login bem-sucedido');
            await this._abrirPainel();
        } else if (res.bloqueado) {
            console.warn('🚫 Conta bloqueada por excesso de tentativas');
            this._iniciarTimerBloqueio();
        } else {
            console.warn(`❌ Senha incorreta — ${res.restantes} tentativa(s) restante(s)`);
            const msg = res.restantes > 0
                ? `Senha incorreta. ${res.restantes} tentativa(s) restante(s).`
                : `Bloqueado por ${Math.ceil(CONFIG.BLOQUEIO_MS / 60000)} minutos.`;
            UI.erro(msg);
            document.getElementById('senhaInput').value = '';
        }
    },

    _iniciarTimerBloqueio() {
        clearInterval(this.timerBloqueio);
        const btn  = document.getElementById('btnEntrar');
        const info = document.getElementById('infoBloqueio');

        const atualizar = () => {
            const s = Auth.tempoRestanteBloqueio();
            if (s <= 0) {
                clearInterval(this.timerBloqueio);
                if (btn)  { btn.disabled = false; btn.textContent = 'ENTRAR'; }
                if (info) info.style.display = 'none';
                return;
            }
            const m = Math.floor(s / 60), ss = s % 60;
            if (btn)  { btn.disabled = true; btn.textContent = `BLOQUEADO (${m}:${String(ss).padStart(2,'0')})`; }
            if (info) { info.style.display = 'block'; info.textContent = `Muitas tentativas incorretas. Aguarde ${m}:${String(ss).padStart(2,'0')}.`; }
        };

        atualizar();
        this.timerBloqueio = setInterval(atualizar, 1000);
    },

    logout() {
        console.log('👋 Logout realizado');
        Auth.logout();
        clearInterval(this.intervaloStatus);
        this._mostrarLogin();
    },

    // ── PAINEL ───────────────────────────────

    async _abrirPainel() {
        document.getElementById('loginBox').style.display    = 'none';
        document.getElementById('painelAdmin').style.display = 'block';

        this.ofertas = await Storage.carregarOfertas();
        console.log(`📋 ${this.ofertas.length} oferta(s) carregada(s)`);
        this.renderLista();
        this._carregarConfigEmBreve();
        this._setupDragDrop();

        this.intervaloStatus = setInterval(() => this.renderLista(), 5000);
        console.log('✅ Painel admin pronto!');
    },

    // ── LISTA DE OFERTAS ─────────────────────

    renderLista() {
        const agora = getHorarioBrasilia();
        const con   = document.getElementById('listaOfertas');
        if (!con) return;

        const banner   = document.getElementById('bannerSemOferta');
        const temAtiva = this.ofertas.some(o => isOfertaAtiva(o, agora));
        if (banner) banner.style.display = temAtiva ? 'none' : 'block';

        if (!temAtiva) console.warn('⚠️ Nenhuma oferta ativa no momento!');

        if (this.ofertas.length === 0) {
            con.innerHTML = `<div class="empty-state">
                <i class="fas fa-calendar-plus" style="font-size:48px;color:#ccc;margin-bottom:15px;"></i>
                <p>Nenhuma oferta cadastrada</p>
                <p style="font-size:14px;">Clique em "NOVA" para começar</p>
            </div>`;
            return;
        }

        const sorted = [...this.ofertas].sort((a,b) => a.dataInicio.localeCompare(b.dataInicio));
        con.innerHTML = sorted.map((o, i) => {
            const ini   = new Date(o.dataInicio), fim = new Date(o.dataFim);
            const ativa = isOfertaAtiva(o, agora);
            const futura= agora < ini;
            const badge = ativa ? 'status-ativa' : futura ? 'status-agendada' : 'status-expirada';
            const label = ativa ? 'ATIVA'         : futura ? 'AGENDADA'        : 'EXPIRADA';
            const cd    = ativa ? countdownTexto(o.dataFim) : null;

            return `<div class="oferta-card ${ativa ? 'ativa' : ''}">
                <div class="status-badge ${badge}">${label}${cd ? ` · ${cd}` : ''}</div>
                <div class="oferta-content">
                    <img src="${o.urlImagem || 'img/produto.png'}" class="oferta-img" onerror="this.src='img/produto.png'">
                    <div class="oferta-info">
                        <strong>${o.tituloPagina || 'Sem título'}</strong><br>
                        📅 ${formatarBrasilia(ini)} → ${formatarBrasilia(fim)}<br>
                        🔗 ${(o.linkProduto||'').slice(0,45)}…
                    </div>
                    <div class="oferta-actions">
                        <button class="btn-warning" onclick="AdminPresenter.editarOferta(${i})" style="padding:10px 15px;width:auto;">✏️</button>
                        <button class="btn-danger"  onclick="AdminPresenter.excluirOferta(${i})" style="padding:10px 15px;width:auto;">🗑️</button>
                    </div>
                </div>
            </div>`;
        }).join('');
    },

    // ── FORMULÁRIO ───────────────────────────

    mostrarNovaOferta() {
        document.getElementById('formTitulo').innerHTML     = '➕ NOVA OFERTA';
        document.getElementById('editandoIdx').value        = '';
        document.getElementById('dataInicio').value         = '';
        document.getElementById('dataFim').value            = '';
        document.getElementById('linkProduto').value        = '';
        document.getElementById('textoOferta').value        = '';
        document.getElementById('tituloPagina').value       = 'DISPARO EM ANDAMENTO!';
        this._removerImagem();
        this._atualizarPreview();
        document.getElementById('formNovaOferta').style.display = 'block';
        document.getElementById('formNovaOferta').scrollIntoView({ behavior: 'smooth' });
    },

    editarOferta(idx) {
        const o = this.ofertas[idx];
        if (!o) { UI.erro('Oferta não encontrada'); return; }
        console.log(`✏️ Editando oferta [${idx}]:`, o.tituloPagina);

        document.getElementById('formTitulo').innerHTML     = '✏️ EDITAR OFERTA';
        document.getElementById('editandoIdx').value        = idx;
        document.getElementById('dataInicio').value         = o.dataInicio;
        document.getElementById('dataFim').value            = o.dataFim;
        document.getElementById('linkProduto').value        = o.linkProduto || '';
        document.getElementById('textoOferta').value        = o.textoOferta || '';
        document.getElementById('tituloPagina').value       = o.tituloPagina || 'DISPARO EM ANDAMENTO!';

        const prev = document.getElementById('preview');
        const btnR = document.getElementById('btnRemoverImagem');
        if (o.urlImagem) {
            prev.src = o.urlImagem; prev.style.display = 'block';
            btnR.style.display = 'inline-block';
        } else { this._removerImagem(); }

        this._atualizarPreview();
        document.getElementById('formNovaOferta').style.display = 'block';
        document.getElementById('formNovaOferta').scrollIntoView({ behavior: 'smooth' });
    },

    cancelarEdicao() {
        document.getElementById('formNovaOferta').style.display = 'none';
        document.getElementById('editandoIdx').value = '';
        this._removerImagem();
        console.log('↩️ Edição cancelada');
    },

    async salvarOferta() {
        const idx   = document.getElementById('editandoIdx').value;
        const dados = {
            dataInicio:   document.getElementById('dataInicio').value,
            dataFim:      document.getElementById('dataFim').value,
            linkProduto:  document.getElementById('linkProduto').value,
            textoOferta:  document.getElementById('textoOferta').value,
            tituloPagina: document.getElementById('tituloPagina').value || 'DISPARO EM ANDAMENTO!',
        };

        console.log(`💾 Salvando oferta${idx !== '' ? ` [edição idx ${idx}]` : ' [nova]'}...`);

        const val = Validators.oferta(dados, this.ofertas, idx !== '' ? parseInt(idx) : null);
        if (!val.valido) {
            console.warn('❌ Validação falhou:', val.erros);
            UI.erro(val.erros[0]);
            return;
        }

        const fi = document.getElementById('fileInput');
        let urlImagem = idx !== '' ? this.ofertas[parseInt(idx)].urlImagem : '';
        if (fi.files?.[0]) {
            const vImg = Validators.imagem(fi.files[0]);
            if (!vImg.valido) { UI.erro(vImg.erro); return; }
            console.log('🖼️ Convertendo imagem para base64...');
            urlImagem = await UI.paraBase64(fi.files[0]);
        }

        const oferta = {
            id:          idx !== '' ? this.ofertas[parseInt(idx)].id : Date.now(),
            ...dados,
            urlImagem,
            dataCriacao: new Date().toISOString(),
        };

        if (idx !== '') this.ofertas[parseInt(idx)] = oferta;
        else            this.ofertas.push(oferta);

        const ok = await Storage.salvarOfertas(this.ofertas);
        this.renderLista();
        this.cancelarEdicao();
        ok ? UI.ok('Oferta salva e sincronizada!') : UI.ok('Oferta salva localmente (Firebase offline)');
    },

    excluirOferta(idx) {
        if (!confirm('Excluir esta oferta?')) return;
        console.log(`🗑️ Excluindo oferta [${idx}]:`, this.ofertas[idx]?.tituloPagina);
        this.ofertas.splice(idx, 1);
        Storage.salvarOfertas(this.ofertas);
        this.renderLista();
        UI.ok('Oferta excluída!');
    },

    // ── PREVIEW EM TEMPO REAL ────────────────

    _atualizarPreview() {
        const titulo = document.getElementById('tituloPagina')?.value || 'EM BREVE';
        const img    = document.getElementById('preview');
        const cardT  = document.getElementById('previewCardTitulo');
        const cardI  = document.getElementById('previewCardImg');
        if (cardT) cardT.textContent = titulo;
        if (cardI) cardI.src = img?.src && img.style.display !== 'none' ? img.src : 'img/produto.png';
    },

    // ── CONFIG EM BREVE ──────────────────────

    async salvarConfigEmBreve() {
        const fp = document.getElementById('filePadrao');
        let imagem = 'img/produto.png';

        if (fp.files?.[0]) {
            const v = Validators.imagem(fp.files[0]);
            if (!v.valido) { UI.erro(v.erro); return; }
            imagem = await UI.paraBase64(fp.files[0]);
        } else {
            const p = document.getElementById('previewPadrao');
            if (p?.src) imagem = p.src;
        }

        Storage.salvarConfigEmBreve({
            imagem,
            titulo:   document.getElementById('tituloPadrao').value  || 'EM BREVE',
            mensagem: document.getElementById('mensagemPadrao').value || '',
        });
        UI.ok('Configurações salvas!');
    },

    _carregarConfigEmBreve() {
        const cfg = Storage.carregarConfigEmBreve();
        if (!cfg) return;
        console.log('⚙️ Config "Em Breve" carregada');
        if (cfg.imagem && cfg.imagem !== 'img/produto.png')
            document.getElementById('previewPadrao').src = cfg.imagem;
        if (cfg.titulo)   document.getElementById('tituloPadrao').value   = cfg.titulo;
        if (cfg.mensagem) document.getElementById('mensagemPadrao').value = cfg.mensagem;
    },

    // ── DRAG & DROP ──────────────────────────

    _setupDragDrop() {
        this._bindDrop('dropArea',       'fileInput',  'preview',       'btnRemoverImagem', false);
        this._bindDrop('dropAreaPadrao', 'filePadrao', 'previewPadrao', null,               true);
    },

    _bindDrop(areaId, inputId, previewId, btnRemId, isPadrao) {
        const area  = document.getElementById(areaId);
        const input = document.getElementById(inputId);
        if (!area || !input) return;

        ['dragenter','dragover','dragleave','drop'].forEach(e =>
            area.addEventListener(e, ev => { ev.preventDefault(); ev.stopPropagation(); }));
        ['dragenter','dragover'].forEach(e =>
            area.addEventListener(e, () => area.classList.add('dragover')));
        ['dragleave','drop'].forEach(e =>
            area.addEventListener(e, () => area.classList.remove('dragover')));

        area.addEventListener('drop', ev => {
            if (ev.dataTransfer.files[0]) {
                input.files = ev.dataTransfer.files;
                this._previewFile(input.files[0], previewId, btnRemId);
                if (!isPadrao) this._atualizarPreview();
            }
        });
        area.addEventListener('click', () => input.click());
        input.addEventListener('change', () => {
            if (input.files[0]) {
                this._previewFile(input.files[0], previewId, btnRemId);
                if (!isPadrao) this._atualizarPreview();
            }
        });
    },

    _previewFile(file, previewId, btnRemId) {
        const r = new FileReader();
        r.onload = e => {
            const prev = document.getElementById(previewId);
            if (prev) { prev.src = e.target.result; prev.style.display = 'block'; }
            if (btnRemId) {
                const btn = document.getElementById(btnRemId);
                if (btn) btn.style.display = 'inline-block';
            }
        };
        r.readAsDataURL(file);
    },

    _removerImagem() {
        const fi = document.getElementById('fileInput');
        if (fi) fi.value = '';
        const prev = document.getElementById('preview');
        if (prev) { prev.style.display = 'none'; prev.src = '#'; }
        const btn = document.getElementById('btnRemoverImagem');
        if (btn) btn.style.display = 'none';
    },
};

// ── BOOTSTRAP ────────────────────────────────
document.addEventListener('DOMContentLoaded', () => AdminPresenter.init());

function login()              { AdminPresenter.login(); }
function logout()             { AdminPresenter.logout(); }
function mostrarNovaOferta()  { AdminPresenter.mostrarNovaOferta(); }
function cancelarEdicao()     { AdminPresenter.cancelarEdicao(); }
function salvarOferta()       { AdminPresenter.salvarOferta(); }
function salvarConfigPadrao() { AdminPresenter.salvarConfigEmBreve(); }
function removerImagem()      { AdminPresenter._removerImagem(); }
