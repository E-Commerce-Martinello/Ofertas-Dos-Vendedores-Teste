// ============================================
// presenter/admin-presenter.js
// Toda a lógica do painel administrativo
// ============================================

const AdminPresenter = {

    ofertas: [],
    intervaloStatus: null,
    timerBloqueio: null,
    abaAtual: 'ofertas',

    async init() {
        Storage.verificarQuota();
        UI.tema.aplicar(Storage.carregarTema());
        const url = GoogleSheetsService.obterUrl();
        // Eliminar credenciais e sessões antigas da versão com senha fixa.
        localStorage.removeItem('martVendedoresApiToken_TESTE');
        sessionStorage.removeItem(CONFIG.SESSION_KEY);
        this._mostrarLogin();
        try {
            const usuario = await Auth.iniciar();
            if (usuario?.isAnonymous) {
                // Visitante do portal, não é um administrador: mantém tela de login limpa.
                await Auth.sair();
            } else if (usuario && url) {
                const acesso = await GoogleSheetsService.testarConexao(url);
                await this._abrirPainel(acesso);
            }
        } catch (erro) {
            // A sessão Firebase pode existir, mas a conta precisa ter permissão no Apps Script.
            this._mensagemLogin(erro.message || 'Não foi possível validar a conta.');
            await Auth.sair().catch(() => {});
        }
    },

    _mensagemLogin(mensagem) {
        const el = document.getElementById('loginStatus');
        if (el) { el.textContent = mensagem || ''; el.style.display = mensagem ? 'block' : 'none'; }
    },

    _mostrarLogin() {
        document.getElementById('loginBox').style.display = 'block';
        document.getElementById('painelAdmin').style.display = 'none';
    },

    async login() {
        const btn = document.getElementById('btnEntrar');
        const url = GoogleSheetsService.obterUrl();
        if (!url) { this._mensagemLogin('A conexão não foi configurada. Confira shared/config.js.'); return; }
        if (btn) { btn.disabled = true; btn.textContent = 'VERIFICANDO...'; }
        this._mensagemLogin('');
        try {
            const usuario = await Auth.entrarGoogle();
            if (!usuario) { this._mensagemLogin('Aguardando retorno da autenticação Google…'); return; }
            this._mensagemLogin('Conta Google autenticada. Verificando autorização da API…');
            // Exige permissão no servidor antes de mostrar dados internos no painel.
            const acesso = await GoogleSheetsService.testarConexao(url);
            localStorage.setItem('martVendedoresApiUrl_TESTE', url);
            await this._abrirPainel(acesso);
        } catch (erro) {
            // Não desfazer um login Google válido por timeout do Apps Script.
            // O painel permanece oculto até autorização real do servidor.
            const msg = erro.message || 'Acesso não autorizado.';
            this._mensagemLogin(Auth.usuarioAtual() ? 'Login Google concluído, mas a API não liberou o acesso: ' + msg : msg);
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fab fa-google"></i> ENTRAR COM GOOGLE'; }
        }
    },

    async logout() {
        clearInterval(this.intervaloStatus);
        this.intervaloStatus = null;
        if (typeof GoogleSheetsService !== 'undefined') GoogleSheetsService.limparSessao();
        if (typeof VendedoresPresenter !== 'undefined') VendedoresPresenter.limparDados();
        if (typeof DashboardPresenter !== 'undefined') DashboardPresenter.limpar();
        if (typeof ContatosPresenter !== 'undefined') ContatosPresenter.limpar();
        if (typeof WhatsAppPresenter !== 'undefined') { WhatsAppPresenter.participantes=[]; WhatsAppPresenter.identificacoes=[]; WhatsAppPresenter.previa=null; WhatsAppPresenter.grupoCarregado=false; }
        await Auth.sair();
        document.getElementById('tabAcessos').style.display = 'none';
        this.mostrarAba('ofertas');
        this.ofertas = [];
        this._mensagemLogin('');
        this._mostrarLogin();
    },

    // ── PAINEL ───────────────────────────────

    async _abrirPainel(acesso = {}) {
        if (this.intervaloStatus) clearInterval(this.intervaloStatus);
        document.getElementById('loginBox').style.display    = 'none';
        document.getElementById('painelAdmin').style.display = 'block';

        const gestor = acesso.proprietario === true;
        this.ehPrincipal = gestor;
        document.getElementById('tabAcessos').style.display = gestor ? '' : 'none';
        const avisoAdmin = document.getElementById('avisoPermissaoOfertas');
        if (avisoAdmin) {
            avisoAdmin.hidden = true;
            if (!gestor) {
                try {
                    const uid = Auth.usuarioAtual()?.uid;
                    const snap = uid ? await database.ref('adminUids_TESTE/' + uid).once('value') : null;
                    if (!snap?.val()) avisoAdmin.hidden = false;
                } catch (e) { avisoAdmin.hidden = false; }
            }
        }
        this.mostrarAba('ofertas');
        if (typeof VendedoresPresenter !== 'undefined') {
            VendedoresPresenter.init();
            // Uma consulta automaticamente, sem expor a URL ou exigir conexão manual.
            VendedoresPresenter.atualizar().catch(erro => console.warn('Falha na atualização automática:', erro));
        }
        this.ofertas = await Storage.carregarOfertas();
        console.log(`📋 ${this.ofertas.length} oferta(s) carregada(s)`);
        this.renderLista();
        this._carregarConfigEmBreve();
        this._setupDragDrop();

        this.intervaloStatus = setInterval(() => this.renderLista(), 5000);
        console.log('✅ Painel admin pronto!');
    },

    mostrarAba(aba) {
        const acessos = aba === 'acessos' && document.getElementById('tabAcessos').style.display !== 'none';
        if (aba === 'whatsapp' || aba === 'pendencias') aba = 'vendedores';
        const vendedores = aba === 'vendedores';
        const dashboard = aba === 'dashboard';
        const contatos = aba === 'contatos';
        const pendencias = false; // Pendências agora são um filtro da lista única.
        const whatsapp = false; // A gestão do grupo está integrada à aba Vendedores.
        this.abaAtual = acessos ? 'acessos' : contatos ? 'contatos' : vendedores ? 'vendedores' : dashboard ? 'dashboard' : pendencias ? 'pendencias' : whatsapp ? 'whatsapp' : 'ofertas';
        ['ofertas','vendedores','dashboard','contatos','pendencias','whatsapp','acessos'].forEach(nome => {
            const el = document.getElementById('aba'+nome[0].toUpperCase()+nome.slice(1));
            if (el) el.style.display = this.abaAtual === nome ? 'block' : 'none';
            const tab = document.getElementById('tab'+nome[0].toUpperCase()+nome.slice(1));
            if (tab) tab.classList.toggle('active',this.abaAtual === nome);
        });
        document.getElementById('btnNovaOfertaTopo').style.display = this.abaAtual === 'ofertas' ? 'inline-block' : 'none';
        const titulos={ofertas:'⚙️ AGENDADOR',dashboard:'📊 DASHBOARD',vendedores:'👥 VENDEDORES',contatos:'💬 CONTATOS',
                       pendencias:'📋 PENDÊNCIAS',whatsapp:'💬 WHATSAPP',acessos:'🔐 ACESSOS'};
        const descricoes={ofertas:'Várias ofertas podem ficar disponíveis ao mesmo tempo',
                          dashboard:'Acompanhamento de compartilhamentos iniciados',
                          vendedores:'Cadastros, participação no grupo e importações em uma lista única',
                          contatos:'Seleção de vendedores e preparação manual de mensagens',
                          pendencias:'Telefones ainda não validados',
                          whatsapp:'Participantes do grupo e identificações',
                          acessos:'Gestão de administradores autorizados'};
        document.getElementById('tituloAdmin').textContent = titulos[this.abaAtual];
        document.getElementById('subtituloAdmin').textContent = descricoes[this.abaAtual];
        if (vendedores) VendedoresPresenter.init();
        if (dashboard) DashboardPresenter.atualizar();
        if (contatos) ContatosPresenter.init();
        if (acessos) GerenciarAcessosPresenter.carregar();
        document.querySelector('.admin-container')?.classList.toggle('admin-container-contacts', contatos);
        if (pendencias) PendenciasPresenter.renderizar();
        if (vendedores && typeof WhatsAppPresenter !== 'undefined' && !WhatsAppPresenter.grupoCarregado && !WhatsAppPresenter.carregando) WhatsAppPresenter.carregar();
    },

    _esc(valor) {
        return String(valor ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    },

    // ── LISTA DE OFERTAS ─────────────────────

    renderLista() {
        const agora = getHorarioBrasilia();
        const con   = document.getElementById('listaOfertas');
        if (!con) return;

        const banner   = document.getElementById('bannerSemOferta');
        const temAtiva = this.ofertas.some(o => isOfertaAtiva(o, agora));
        if (banner) banner.style.display = temAtiva ? 'none' : 'block';

        const ativas = this.ofertas.filter(o => isOfertaAtiva(o, agora)).length;
        const agendadas = this.ofertas.filter(o => new Date(o.dataInicio) > agora).length;
        const resumo = document.getElementById('resumoCampanhas');
        if (resumo) {
            document.getElementById('totalOfertas').textContent = this.ofertas.length;
            document.getElementById('ofertasAtivas').textContent = ativas;
            document.getElementById('ofertasAgendadas').textContent = agendadas;
            document.getElementById('ofertasEncerradas').textContent = Math.max(0, this.ofertas.length - ativas - agendadas);
        }

        if (this.ofertas.length === 0) {
            con.innerHTML = `<div class="empty-state">
                <i class="fas fa-calendar-plus" style="font-size:48px;color:#ccc;margin-bottom:15px;"></i>
                <p>Nenhuma oferta cadastrada</p>
                <p style="font-size:14px;">Clique em "NOVA" para começar</p>
            </div>`;
            return;
        }

        const sorted = this.ofertas.map((o,i) => ({o,i})).sort((a,b) => a.o.dataInicio.localeCompare(b.o.dataInicio));
        con.innerHTML = sorted.map(({o,i}) => {
            const ini   = new Date(o.dataInicio), fim = new Date(o.dataFim);
            const ativa = isOfertaAtiva(o, agora);
            const futura= agora < ini;
            const badge = ativa ? 'status-ativa' : futura ? 'status-agendada' : 'status-expirada';
            const label = ativa ? 'ATIVA'         : futura ? 'AGENDADA'        : 'EXPIRADA';
            const cd    = ativa ? countdownTexto(o.dataFim) : null;

            return `<div class="oferta-card ${ativa ? 'ativa' : ''}">
                <div class="status-badge ${badge}">${label}${cd ? ` · ${cd}` : ''}</div>
                <div class="oferta-content">
                    <img src="${this._esc(o.urlImagem || 'img/produto.png')}" class="oferta-img" onerror="this.src='img/produto.png'">
                    <div class="oferta-info">
                        <strong>${this._esc(o.tituloPagina || 'Sem título')}</strong><br>
                        📅 ${formatarBrasilia(ini)} → ${formatarBrasilia(fim)}<br>
                        🔗 ${this._esc((o.linkProduto||'').slice(0,45))}…
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

        const novaLista = [...this.ofertas];
        if (idx !== '') novaLista[parseInt(idx)] = { ...oferta, dataCriacao: this.ofertas[parseInt(idx)].dataCriacao || oferta.dataCriacao };
        else novaLista.push(oferta);
        const ok = await Storage.salvarOfertas(novaLista);
        if (!ok) { UI.erro('Não foi possível gravar no Firebase. Nada foi alterado.'); return; }
        this.ofertas = novaLista;
        this.renderLista();
        this.cancelarEdicao();
        UI.ok('Oferta salva! Ela ficará visível junto às outras durante seu período.');
    },

    async excluirOferta(idx) {
        const oferta = this.ofertas[idx];
        if (!oferta || !confirm('Excluir esta oferta?')) return;
        const novaLista = this.ofertas.filter((_,i) => i !== idx);
        const ok = await Storage.salvarOfertas(novaLista);
        if (!ok) { UI.erro('Não foi possível excluir no Firebase.'); return; }
        this.ofertas = novaLista;
        this.renderLista();
        UI.ok('Oferta excluída.');
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
