// ============================================
// presenter/admin-presenter.js
// Toda a lógica do painel administrativo
// ============================================

const AdminPresenter = {

    ofertas: [],
    intervaloStatus: null,
    timerBloqueio: null,
    abaAtual: 'ofertas',
    pararSyncOfertas: null,
    editandoBase: null,
    editandoId: null,
    _versaoOfertas: null,
    _chaveAba: 'martAdminUltimaAba_TESTE',
    _autorizado: false,

    async init() {
        Storage.verificarQuota();
        UI.tema.aplicar(Storage.carregarTema());
        const url = GoogleSheetsService.obterUrl();
        // Eliminar credenciais e sessões antigas da versão com senha fixa.
        localStorage.removeItem('martVendedoresApiToken_TESTE');
        sessionStorage.removeItem(CONFIG.SESSION_KEY);
        this._restaurandoSessao(true);
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
            // Sem autorização do Apps Script, não mostrar dados internos nem usar cache.
            this._mostrarLogin();
            this._mensagemLogin(erro.message || 'Não foi possível validar a conta.');
            if (!Auth.usuarioAtual()) await Auth.sair().catch(() => {});
        } finally {
            this._restaurandoSessao(false);
        }
    },

    _restaurandoSessao(ativo) {
        const box=document.getElementById('loginBox');
        const aviso=document.getElementById('loginRestaurando');
        if (box) {if (ativo) box.style.display='block'; box.dataset.restaurando=ativo?'true':'false';}
        if (aviso) aviso.hidden=!ativo;
        const titulo=document.getElementById('tituloLogin');
        if (titulo) titulo.textContent=ativo?'Preparando painel...':'Acesso Restrito';
        const instrucao=document.getElementById('instrucaoLogin');
        if (instrucao) instrucao.hidden=ativo;
    },

    _lembrarAba(aba) {
        try { sessionStorage.setItem(this._chaveAba, aba); } catch (_) {}
    },
    _abaSalva() {
        try {return sessionStorage.getItem(this._chaveAba)||'ofertas';} catch (_) {return 'ofertas';}
    },

    _mensagemLogin(mensagem) {
        const el = document.getElementById('loginStatus');
        if (el) { el.textContent = mensagem || ''; el.style.display = mensagem ? 'block' : 'none'; }
    },

    _mostrarLogin() {
        this._autorizado = false;
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
            const usuario = Auth.usuarioAtual() || await Auth.entrarGoogle();
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
        this._pararSincronizacao();
        clearInterval(this.intervaloStatus);
        this.intervaloStatus = null;
        this._autorizado = false;
        try { sessionStorage.removeItem(this._chaveAba); } catch (_) {}
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
        this._pararSincronizacao();
        if (this.intervaloStatus) clearInterval(this.intervaloStatus);
        document.getElementById('loginBox').style.display    = 'none';
        document.getElementById('painelAdmin').style.display = 'block';

        const gestor = acesso.proprietario === true;
        this.ehPrincipal = gestor;
        this._autorizado = true;
        document.getElementById('tabAcessos').style.display = gestor ? '' : 'none';
        const avisoAdmin = document.getElementById('avisoPermissaoOfertas');
        if (avisoAdmin) {
            avisoAdmin.hidden = true;
            if (!gestor) {
                const uid = Auth.usuarioAtual()?.uid;
                if (!uid) avisoAdmin.hidden = false;
                else database.ref('adminUids_TESTE/' + uid).once('value').then(snap => {
                    // A verificação visual não deve atrasar a abertura do painel;
                    // as regras Firebase seguem impondo as permissões reais.
                    if (this._autorizado && Auth.usuarioAtual()?.uid === uid) avisoAdmin.hidden = !!snap.val();
                }).catch(() => {
                    if (this._autorizado && Auth.usuarioAtual()?.uid === uid) avisoAdmin.hidden = false;
                });
            }
        }
        const restaurada = this._abaSalva();
        this.mostrarAba(['ofertas','dashboard','vendedores','contatos','aparencia','configuracoes','acessos','links'].includes(restaurada) ? restaurada : 'ofertas');
        if (typeof VendedoresPresenter !== 'undefined') {
            VendedoresPresenter.init();
            // Uma consulta automaticamente, sem expor a URL ou exigir conexão manual.
            VendedoresPresenter.atualizar().catch(erro => console.warn('Falha na atualização automática:', erro));
        }
        // A assinatura em tempo real inclui o primeiro snapshot. Evita duas leituras
        // pesadas dos mesmos banners e mantém a proteção de conflitos da v1.6.11.
        this.ofertas = [];
        this._sincronizarOfertas();
        this._carregarConfigEmBreve();
        this._setupDragDrop();
        if (typeof CampanhasPresenter !== 'undefined') CampanhasPresenter.carregar();

        // Datas agendadas continuam mudando mesmo sem nova gravação no Firebase.
        // Intervalo mais leve para a página administrativa.
        this.intervaloStatus = setInterval(() => this.renderLista(), 30000);
        console.log('✅ Painel admin pronto!');
    },

    _pararSincronizacao() {
        if (this.pararSyncOfertas) { this.pararSyncOfertas(); this.pararSyncOfertas=null; }
        this._versaoOfertas=null;
        this.editandoBase=null;
        this.editandoId=null;
    },

    _statusSync(texto, erro=false) {
        const el=document.getElementById('estadoSyncOfertas');
        if (!el) return;
        el.textContent=texto;
        el.style.color=erro?'#bf2835':'';
    },

    _sincronizarOfertas() {
        const assinatura = lista => JSON.stringify(lista.map(o => [o.id, Storage.assinaturaOferta(o)]));
        this._versaoOfertas=assinatura(this.ofertas);
        this._statusSync('● Sincronização em tempo real ativada');
        this.pararSyncOfertas=Storage.escutarOfertas(ofertas => {
            const agora=assinatura(ofertas);
            const mudou=agora!==this._versaoOfertas;
            this._versaoOfertas=agora;
            this.ofertas=ofertas;
            if (mudou) {
                this.renderLista();
                if (typeof ContatosPresenter!=='undefined' && this.abaAtual==='contatos') {
                    ContatosPresenter._atualizarOfertas();
                    ContatosPresenter.renderizarFila();
                }
                if (this.editandoId != null && this.editandoBase != null) {
                    const alvo=ofertas.find(o=>String(o.id)===String(this.editandoId));
                    if (!alvo || Storage.assinaturaOferta(alvo)!==this.editandoBase) {
                        this._avisoConflito('⚠️ Esta oferta foi alterada ou excluída por outra conta. Suas alterações no formulário foram mantidas, mas não serão gravadas sobre a versão nova. Copie o texto e reabra a oferta para editar.');
                    }
                }
            }
            this._statusSync('● Ofertas sincronizadas em tempo real');
        }, erro => {
            console.warn('Falha ao receber atualizações das ofertas:',erro);
            this._statusSync('⚠️ Sem sincronização ao vivo. Não edite até reconectar.',true);
        });
    },

    _avisoConflito(texto='') {
        const el=document.getElementById('avisoConflitoOferta');
        if (el) { el.textContent=texto; el.style.display=texto?'block':'none'; }
    },

    mostrarAba(aba) {
        const acessos = aba === 'acessos' && document.getElementById('tabAcessos').style.display !== 'none';
        if (aba === 'whatsapp' || aba === 'pendencias') aba = 'vendedores';
        const vendedores = aba === 'vendedores';
        const links = aba === 'links';
        const dashboard = aba === 'dashboard';
        const contatos = aba === 'contatos';
        const aparencia = aba === 'aparencia';
        const configuracoes = aba === 'configuracoes';
        const pendencias = false; // Pendências agora são um filtro da lista única.
        const whatsapp = false; // A gestão do grupo está integrada à aba Vendedores.
        this.abaAtual = acessos ? 'acessos' : configuracoes ? 'configuracoes' : aparencia ? 'aparencia' : contatos ? 'contatos' : links ? 'links' : vendedores ? 'vendedores' : dashboard ? 'dashboard' : 'ofertas';
        if (this._autorizado) this._lembrarAba(this.abaAtual);
        ['ofertas','vendedores','dashboard','links','contatos','aparencia','configuracoes','pendencias','whatsapp','acessos'].forEach(nome => {
            const el = document.getElementById('aba'+nome[0].toUpperCase()+nome.slice(1));
            if (el) el.style.display = this.abaAtual === nome ? 'block' : 'none';
            const tab = document.getElementById('tab'+nome[0].toUpperCase()+nome.slice(1));
            if (tab) tab.classList.toggle('active',this.abaAtual === nome);
        });
        document.getElementById('btnNovaOfertaTopo').style.display = this.abaAtual === 'ofertas' ? 'inline-block' : 'none';
        const titulos={ofertas:'⚙️ AGENDADOR',dashboard:'📊 DASHBOARD',links:'🔗 LINKS MARTINELLO',vendedores:'👥 VENDEDORES',contatos:'💬 CONTATOS',aparencia:'🎨 APARÊNCIA',configuracoes:'⚙️ CONFIGURAÇÕES',
                       pendencias:'📋 PENDÊNCIAS',whatsapp:'💬 WHATSAPP',acessos:'🔐 ACESSOS'};
        const descricoes={ofertas:'Várias ofertas podem ficar disponíveis ao mesmo tempo',
                          dashboard:'Acompanhamento de acessos e compartilhamentos iniciados',
                          links:'Situação dos links de vendedores por filial',
                          vendedores:'Cadastros, participação no grupo e importações em uma lista única',
                          contatos:'Seleção de vendedores e preparação manual de mensagens',
                          aparencia:'Logo, imagem e textos do portal — sincronizados entre dispositivos',
                          configuracoes:'Central de preferências e atalhos para configurações compartilhadas',
                          pendencias:'Telefones ainda não validados',
                          whatsapp:'Participantes do grupo e identificações',
                          acessos:'Gestão de administradores autorizados'};
        document.getElementById('tituloAdmin').textContent = titulos[this.abaAtual];
        document.getElementById('subtituloAdmin').textContent = descricoes[this.abaAtual];
        if (vendedores || links) VendedoresPresenter.init();
        if (links) VendedoresPresenter.renderizarPainelLinks();
        if (dashboard) DashboardPresenter.atualizar();
        if (contatos) ContatosPresenter.init();
        if (acessos) GerenciarAcessosPresenter.carregar();
        if (configuracoes) this._renderPreferencias();
        document.querySelector('.admin-container')?.classList.toggle('admin-container-contacts', contatos);
        if (pendencias) PendenciasPresenter.renderizar();
        if (vendedores && typeof WhatsAppPresenter !== 'undefined' && !WhatsAppPresenter.grupoCarregado && !WhatsAppPresenter.carregando) WhatsAppPresenter.carregar();
    },

    abrirConfiguracao(area) {
        if (area === 'acessos' && !this.ehPrincipal) { UI.erro('Somente a conta principal gerencia acessos.'); return; }
        this.mostrarAba(area);
        if (area === 'contatos') {
            const painel = document.getElementById('contatosConfigPainel');
            if (painel) {painel.open = true; painel.scrollIntoView({block:'start',behavior:'smooth'});}
        }
    },

    _renderPreferencias() {
        const campo = document.getElementById('centralQtdVendedores');
        if (campo) campo.value = String(VendedoresPresenter.porPagina);
        const btn = document.getElementById('centralAcessos');
        if (btn) btn.disabled = !this.ehPrincipal;
    },
    salvarPreferenciaLista(valor) {
        const itens = Number(valor);
        if (![15,25,50].includes(itens)) return;
        VendedoresPresenter.porPagina = itens;
        VendedoresPresenter.pagina = 1;
        try { localStorage.setItem('martItensVendedores_TESTE', String(itens)); } catch (_) {}
        if (VendedoresPresenter.registros.length) VendedoresPresenter.filtrar();
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
                        🔗 ${this._esc((o.linkProduto||'').slice(0,45))}…<br>
                        🏷️ Campanha: ${this._esc(o.campanha || 'Geral')}
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
        this.editandoId=null;
        this.editandoBase=null;
        this._avisoConflito();
        document.getElementById('formTitulo').innerHTML     = '➕ NOVA OFERTA';
        document.getElementById('editandoIdx').value        = '';
        document.getElementById('dataInicio').value         = '';
        document.getElementById('dataFim').value            = '';
        document.getElementById('linkProduto').value        = '';
        document.getElementById('textoOferta').value        = '';
        document.getElementById('tituloPagina').value       = 'DISPARO EM ANDAMENTO!';
        document.getElementById('campanhaOferta').value     = '';
        this._removerImagem();
        this._atualizarPreview();
        document.getElementById('formNovaOferta').style.display = 'block';
        document.getElementById('formNovaOferta').scrollIntoView({ behavior: 'smooth' });
    },

    editarOferta(idx) {
        const o = this.ofertas[idx];
        if (!o) { UI.erro('Oferta não encontrada'); return; }
        this.editandoId=o.id;
        this.editandoBase=Storage.assinaturaOferta(o);
        this._avisoConflito();
        console.log(`✏️ Editando oferta [${idx}]:`, o.tituloPagina);

        document.getElementById('formTitulo').innerHTML     = '✏️ EDITAR OFERTA';
        document.getElementById('editandoIdx').value        = idx;
        document.getElementById('dataInicio').value         = o.dataInicio;
        document.getElementById('dataFim').value            = o.dataFim;
        document.getElementById('linkProduto').value        = o.linkProduto || '';
        document.getElementById('textoOferta').value        = o.textoOferta || '';
        document.getElementById('tituloPagina').value       = o.tituloPagina || 'DISPARO EM ANDAMENTO!';
        document.getElementById('campanhaOferta').value     = o.campanha || '';

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
        this.editandoId=null;
        this.editandoBase=null;
        this._avisoConflito();
        document.getElementById('formNovaOferta').style.display = 'none';
        document.getElementById('editandoIdx').value = '';
        this._removerImagem();
        console.log('↩️ Edição cancelada');
    },

    async salvarOferta() {
        const emEdicao = this.editandoId != null;
        const idAlvo = this.editandoId;
        const original = emEdicao ? this.ofertas.find(o => String(o.id)===String(idAlvo)) : null;
        if (emEdicao && !original) {
            this._avisoConflito('⚠️ Esta oferta foi excluída em outra sessão. Copie os dados e cancele a edição.');
            UI.erro('Oferta excluída por outro administrador. Nada foi alterado.');
            return;
        }
        const dados = {
            dataInicio:document.getElementById('dataInicio').value,
            dataFim:document.getElementById('dataFim').value,
            linkProduto:document.getElementById('linkProduto').value,
            textoOferta:document.getElementById('textoOferta').value,
            tituloPagina:document.getElementById('tituloPagina').value || 'DISPARO EM ANDAMENTO!',
            campanha:String(document.getElementById('campanhaOferta').value||'').trim().toLowerCase(),
        };
        if(dados.campanha && !/^[a-z0-9][a-z0-9_-]{0,59}$/.test(dados.campanha)){
            UI.erro('Campanha individual inválida: até 60 letras minúsculas, números, _ ou -.');return;
        }
        const idxAtual = emEdicao ? this.ofertas.findIndex(o=>String(o.id)===String(idAlvo)) : null;
        const val=Validators.oferta(dados,this.ofertas,idxAtual);
        if (!val.valido) { UI.erro(val.erros[0]); return; }
        const fi=document.getElementById('fileInput');
        let urlImagem=emEdicao ? original.urlImagem : '';
        if (fi.files?.[0]) {
            const vImg=Validators.imagem(fi.files[0]);
            if (!vImg.valido) { UI.erro(vImg.erro); return; }
            urlImagem=await UI.paraBase64(fi.files[0]);
        }
        const oferta={
            id:emEdicao?idAlvo:`of_${Date.now()}_${Math.random().toString(36).slice(2,9)}`,
            ...dados, urlImagem,
            dataCriacao:emEdicao?(original.dataCriacao || new Date().toISOString()):new Date().toISOString(),
        };
        const resultado=await Storage.modificarOferta({
            tipo:emEdicao?'editar':'criar',id:oferta.id,oferta,
            base:emEdicao?this.editandoBase:null
        });
        if (!resultado.ok) {
            if (['conflito','excluida'].includes(resultado.motivo)) {
                this._avisoConflito('⚠️ Alteração simultânea detectada. A oferta foi modificada por outra conta. Seu formulário foi preservado; copie os dados e reabra a oferta antes de salvar novamente.');
                UI.erro('Conflito: a outra alteração foi preservada. Não sobrescrevemos a oferta.');
            } else UI.erro('Não foi possível salvar a oferta no Firebase. Nada foi sobrescrito.');
            return;
        }
        this.ofertas=resultado.ofertas;
        this.renderLista();
        this.cancelarEdicao();
        UI.ok('Oferta salva com segurança e sincronizada com os demais administradores.');
    },

    async excluirOferta(idx) {
        const oferta=this.ofertas[idx];
        if (!oferta || !confirm('Excluir esta oferta?')) return;
        const resultado=await Storage.modificarOferta({
            tipo:'excluir',id:oferta.id,base:Storage.assinaturaOferta(oferta)
        });
        if (!resultado.ok) {
            UI.erro(['conflito','excluida'].includes(resultado.motivo)
                ? 'Esta oferta foi alterada ou excluída por outra conta. A exclusão foi cancelada.'
                : 'Não foi possível excluir no Firebase.');
            return;
        }
        this.ofertas=resultado.ofertas;
        this.renderLista();
        UI.ok('Oferta excluída e sincronizada.');
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

    _statusAparencia(texto, erro=false) {
        const el = document.getElementById('aparenciaStatus');
        if (el) { el.textContent = texto; el.style.color = erro ? '#c0222b' : '#368355'; }
    },
    _logoOriginalPendente: false,
    _imagemOriginalPendente: false,
    previewLogoPortal() {
        const f = document.getElementById('fileLogoPortal')?.files?.[0];
        if (!f) return;
        if (!['image/png','image/jpeg','image/webp'].includes(f.type) || f.size > 6*1024*1024) {
            this._statusAparencia('Use PNG, JPG ou WebP de até 6 MB.', true); return;
        }
        this._logoOriginalPendente = false;
        const r = new FileReader();
        r.onload = () => { const p=document.getElementById('previewLogoPortal'); if (p) p.src=r.result; };
        r.readAsDataURL(f);
    },
    restaurarLogoPortal() {
        this._logoOriginalPendente = true;
        const file=document.getElementById('fileLogoPortal'); if(file) file.value='';
        const p=document.getElementById('previewLogoPortal'); if(p) p.src='img/logo.png';
        this._statusAparencia('Logo original selecionada. Clique em Salvar aparência para publicar.');
    },
    restaurarImagemPadrao() {
        this._imagemOriginalPendente = true;
        const file=document.getElementById('filePadrao'); if(file) file.value='';
        const p=document.getElementById('previewPadrao'); if(p) p.src='img/produto.png';
        this._statusAparencia('Imagem original selecionada. Clique em Salvar aparência para publicar.');
    },
    async salvarConfigEmBreve() {
        const btn=document.getElementById('btnSalvarAparencia');
        if(btn) btn.disabled = true;
        this._statusAparencia('Otimizando as imagens e salvando no Firebase…');
        try {
            const anterior = AparenciaPortal.dados || AparenciaPortal.padrao;
            const legado = AparenciaPortal.dados ? null : Storage.carregarConfigEmBreve();
            const imagemAnterior = legado
                ? AparenciaPortal._imagem(legado.imagem, AparenciaPortal.padrao.imagem, 280000)
                : anterior.imagem;
            const arquivoLogo = document.getElementById('fileLogoPortal')?.files?.[0];
            const arquivoPadrao = document.getElementById('filePadrao')?.files?.[0];
            const logo = this._logoOriginalPendente ? 'img/logo.png' : arquivoLogo
                ? await AparenciaPortal.compactarImagem(arquivoLogo, 650, 180000) : anterior.logo;
            const imagem = this._imagemOriginalPendente ? 'img/produto.png' : arquivoPadrao
                ? await AparenciaPortal.compactarImagem(arquivoPadrao, 1100, 280000) : imagemAnterior;
            const cfg = {
                logo, imagem,
                titulo: document.getElementById('tituloPadrao').value.trim() || 'EM BREVE',
                mensagem: document.getElementById('mensagemPadrao').value.trim()
            };
            if(cfg.titulo.length>100 || cfg.mensagem.length>500) throw new Error('Título: até 100 caracteres; mensagem: até 500.');
            await AparenciaPortal.salvar(cfg);
            Storage.salvarConfigEmBreve({imagem:cfg.imagem,titulo:cfg.titulo,mensagem:cfg.mensagem});
            document.getElementById('previewLogoPortal').src = cfg.logo;
            document.getElementById('previewPadrao').src = cfg.imagem;
            const lp=document.getElementById('fileLogoPortal'); if(lp) lp.value='';
            const fp=document.getElementById('filePadrao'); if(fp) fp.value='';
            this._logoOriginalPendente=false; this._imagemOriginalPendente=false;
            this._statusAparencia('Aparência publicada! Atualize o portal para conferir.');
            UI.ok('Aparência salva no Firebase e disponível para todos os dispositivos.');
        } catch (erro) {
            this._statusAparencia('Não foi possível salvar: ' + (erro.message||erro),true);
        } finally {if(btn) btn.disabled = false;}
    },

    async _carregarConfigEmBreve() {
        const local = Storage.carregarConfigEmBreve();
        try {
            const cfg = await AparenciaPortal.carregar();
            if (AparenciaPortal.dados || !local) {
                document.getElementById('previewPadrao').src=cfg.imagem;
                document.getElementById('tituloPadrao').value=cfg.titulo;
                document.getElementById('mensagemPadrao').value=cfg.mensagem;
            } else {
                document.getElementById('previewPadrao').src=local.imagem||cfg.imagem;
                document.getElementById('tituloPadrao').value=local.titulo||cfg.titulo;
                document.getElementById('mensagemPadrao').value=local.mensagem||cfg.mensagem;
                this._statusAparencia('Configuração local antiga detectada. Revise e clique em Salvar para publicar.');
            }
            document.getElementById('previewLogoPortal').src=cfg.logo;
        } catch (erro) {
            this._statusAparencia('Não foi possível carregar o Firebase: '+(erro.message||erro),true);
        }
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
