// ============================================
// presenter/vendors-presenter.js
// Gestão da base oficial Vendedores no Google Sheets via Apps Script privado.
// Dados oficiais não são gravados no Firebase.
// ============================================
const VendedoresPresenter = {
    STORAGE_API_URL: 'martVendedoresApiUrl_TESTE',
    STORAGE_LINK_CHECKER: 'adminLinkCheckerUrl',
    apiUrl: '',
    registros: [],
    filiais: {},
    filtrados: [],
    links: {},
    pagina: 1,
    porPagina: 50,
    inicializado: false,
    carregando: false,
    salvando: false,
    verificandoLinks: false,
    modoModal: 'editar',
    matriculaOriginal: '',
    ultimaAtualizacaoTexto: '',
    grupoCarregado: false,
    grupoTelefones: new Set(),
    grupoDuplicados: new Set(),

    init() {
        if (!this.inicializado) {
            this.apiUrl = GoogleSheetsService.obterUrl();
            this.inicializado = true;
        }
        if (!this.registros.length && !this.carregando) this._status('Carregando a base de vendedores...');
    },

    _status(mensagem, tipo = 'info') {
        const el = document.getElementById('statusConexaoSheets');
        if (!el) return;
        el.className = `vendor-status ${tipo === 'ok' ? 'ok' : tipo === 'error' ? 'error' : ''}`;
        const icone = tipo === 'ok' ? 'fa-check-circle' : tipo === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle';
        el.innerHTML = `<i class="fas ${icone}"></i><span>${this._escapar(mensagem)}</span>`;
    },

    _escapar(valor) {
        return String(valor ?? '').replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    },
    _texto(valor) { return String(valor ?? '').trim(); },
    _digitos(valor) { return this._texto(valor).replace(/\D/g, ''); },
    _matricula(valor) { return this._digitos(valor); },
    _normalizarTelefone(valor) {
        let n = this._digitos(valor);
        if ((n.length === 10 || n.length === 11) && !n.startsWith('55')) n = `55${n}`;
        return n;
    },
    _exibirTelefone(valor) {
        const padrao = typeof GrupoWhatsAppModel !== 'undefined' ? GrupoWhatsAppModel.telefone(valor) : '';
        if (padrao) return `(${padrao.slice(0,2)}) 9 ${padrao.slice(3,7)}-${padrao.slice(7)}`;
        let n = this._digitos(valor);
        let prefixo = '';
        if (n.startsWith('55') && (n.length === 12 || n.length === 13)) { prefixo = '+55 '; n = n.slice(2); }
        if (n.length === 11) return `${prefixo}(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
        if (n.length === 10) return `${prefixo}(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
        return this._texto(valor) || '—';
    },
    _normalizarCabecalho(valor) { return this._texto(valor).toLocaleLowerCase('pt-BR').replace(/\s+/g, '_'); },

    limparDados() {
        this.registros = [];
        this.filiais = {};
        this.filtrados = [];
        this.links = {};
        this.grupoCarregado = false;
        this.grupoTelefones = new Set();
        this.grupoDuplicados = new Set();
        this.pagina = 1;
        this.ultimaAtualizacaoTexto = '';
        this.carregando = false;
        ['painelDadosVendedores', 'painelGestaoVendedores'].forEach(id => {
            const painel = document.getElementById(id);
            if (painel) painel.style.display = 'none';
        });
        const botao = document.getElementById('btnAtualizarVendedores');
        if (botao) botao.disabled = true;
    },

    _mapearVendedores(linhas) {
        if (!Array.isArray(linhas) || linhas.length < 2) throw new Error('A aba Vendedores está vazia ou não retornou registros.');
        const headers = linhas[0].map(v => this._normalizarCabecalho(v));
        const esperados = [
            'matricula', 'nome', 'filial', 'codigo_filial', 'telefone_original',
            'telefone_normalizado', 'situacao_funcional', 'status_cadastro',
            'origem_cadastro', 'criado_em', 'atualizado_em', 'observacoes', 'status_telefone'
        ];
        const col = {};
        esperados.forEach(h => {
            col[h] = headers.indexOf(h);
            if (col[h] < 0) throw new Error(`Cabeçalho obrigatório ausente na aba Vendedores: ${h}. Confira se a migração terminou corretamente.`);
        });
        return linhas.slice(1).map((linha, idx) => {
            const get = h => col[h] < linha.length ? this._texto(linha[col[h]]) : '';
            const situacao = get('situacao_funcional');
            const statusCadastro = (get('status_cadastro') || 'IMPORTADO').toUpperCase();
            const situacaoUpper = situacao.toLocaleUpperCase('pt-BR');
            const telefone = get('telefone_original');
            const statusTelefone = (get('status_telefone') || 'PENDENTE').toUpperCase();
            const statusLink = this.links[`m${this._matricula(get('matricula'))}`] || null;
            const inativoFuncional = /INATIV|DESLIG|DEMIT|REMOVID/.test(situacaoUpper);
            const ativo = statusCadastro !== 'INATIVO' && !inativoFuncional;
            return {
                matricula: get('matricula'),
                nome: get('nome'),
                filial: get('filial'),
                localidadeFilial: this.filiais[get('filial')] || '',
                codfil: get('codigo_filial'),
                numero: telefone,
                telefoneNormalizado: get('telefone_normalizado') || this._normalizarTelefone(telefone),
                situacaoFuncional: situacao,
                statusCadastro,
                statusTelefone: telefone ? (statusTelefone === 'VALIDADO' ? 'VALIDADO' : 'PENDENTE') : 'PENDENTE',
                origem: get('origem_cadastro'),
                criadoEm: get('criado_em'),
                atualizadoEm: get('atualizado_em'),
                observacoes: get('observacoes'),
                ativo,
                linkStatus: statusLink,
                sheetRow: idx + 2
            };
        }).filter(v => v.matricula && v.nome);
    },

    _validarConfiguracao() {
        const url = this.apiUrl || GoogleSheetsService.obterUrl();
        if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url)) {
            throw new Error('A API do site não está configurada. Verifique shared/config.js.');
        }
        this.apiUrl = url;
        return { url, token: null };
    },

    async conectar() {
        if (this.carregando) return;
        try {
            const cfg = this._validarConfiguracao();
            await this._carregar(cfg.url, cfg.token);
        } catch (erro) {
            this._status(erro.message || 'Confira a configuração da API.', 'error');
            UI.erro(erro.message || 'Confira a configuração da API.');
        }
    },

    async atualizar() {
        if (this.carregando) return;
        try {
            const cfg = this._validarConfiguracao();
            await this._carregar(cfg.url, cfg.token);
        } catch (erro) {
            this._status(erro.message || 'Configure a API primeiro.', 'error');
            UI.erro(erro.message || 'Configure a API primeiro.');
        }
    },

    async _carregar(apiUrl, _naoUsado) {
        this.carregando = true;
        const botaoAtualizar = document.getElementById('btnAtualizarVendedores');
        if (botaoAtualizar) botaoAtualizar.disabled = true;
        this._status('Consultando a aba Vendedores da planilha de TESTE...');
        try {
            const base = await GoogleSheetsService.carregarVendedores(apiUrl);
            const linhas = base.linhas;
            this.filiais = Object.fromEntries((base.filiais || [])
                .filter(v => Array.isArray(v) && v.length >= 2 && /^\d+$/.test(String(v[0]))));
            // Resultados de verificação ficam somente na aba Verificacao_Links do Sheets.
            let consultaLinks = { resultados: [] };
            try { consultaLinks = await GoogleSheetsService.listarLinks(); }
            catch (erro) { console.warn('Não foi possível ler os status de links do Sheets:', erro); }
            this.links = Object.fromEntries((consultaLinks.resultados || [])
                .filter(x => /^\d+$/.test(String(x.matricula || '')))
                .map(x => [`m${this._matricula(x.matricula)}`, x]));
            this.registros = this._mapearVendedores(linhas);
            if (!this.registros.length) throw new Error('A aba Vendedores foi lida, mas não contém linhas válidas.');
            this._atualizarFiltroFilial();
            if (typeof WhatsAppPresenter !== 'undefined' && WhatsAppPresenter.grupoCarregado) this.atualizarGrupo();
            document.getElementById('painelDadosVendedores').style.display = 'block';
            document.getElementById('painelGestaoVendedores').style.display = 'block';
            const painelImportacao = document.getElementById('painelImportacaoFuncionarios');
            if (painelImportacao) painelImportacao.style.display = 'block';
            if (botaoAtualizar) botaoAtualizar.disabled = false;
            this.pagina = 1;
            this.filtrar();
            this._renderizarGestaoExtra();
            if (typeof PendenciasPresenter !== 'undefined') PendenciasPresenter.renderizar();
            if (typeof ContatosPresenter !== 'undefined' && AdminPresenter.abaAtual === 'contatos') ContatosPresenter.init();
            if (typeof WhatsAppPresenter !== 'undefined') {
                if (WhatsAppPresenter.grupoCarregado) this.atualizarGrupo();
                else if (!WhatsAppPresenter.carregando) WhatsAppPresenter.carregar();
            }
            this.ultimaAtualizacaoTexto = `Base Vendedores carregada em ${new Date().toLocaleString('pt-BR')}. ${this.registros.length.toLocaleString('pt-BR')} registros lidos diretamente do Google Sheets.`;
            const last = document.getElementById('ultimaAtualizacaoVendedores');
            if (last) last.textContent = this.ultimaAtualizacaoTexto;
            this._status(`${this.registros.length.toLocaleString('pt-BR')} vendedores carregados. Edições e novos cadastros serão gravados diretamente na aba Vendedores.`, 'ok');
        } catch (erro) {
            console.error('Erro ao carregar a base Vendedores:', erro);
            this._status(erro.message || 'Não foi possível carregar os dados.', 'error');
            UI.erro(erro.message || 'Não foi possível conectar à base.');
        } finally {
            this.carregando = false;
        }
    },

    _atualizarFiltroFilial() {
        const select = document.getElementById('filtroFilialVendedor');
        if (!select) return;
        const selecionada = select.value || '';
        const filiais = [...new Set(this.registros
            .map(v => this._texto(v.filial))
            .filter(Boolean))]
            .sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true, sensitivity: 'base' }));
        select.innerHTML = '<option value="">Todas as filiais</option>' + filiais.map(f =>
            `<option value="${this._escapar(f)}">${this._escapar(f)}${this.filiais[f] ? ' — ' + this._escapar(this.filiais[f]) : ''}</option>`
        ).join('');
        const sugestoes = document.getElementById('listaNumerosFiliais');
        if (sugestoes) sugestoes.innerHTML = Object.entries(this.filiais)
            .sort((a,b) => Number(a[0]) - Number(b[0]))
            .map(([numero, local]) => `<option value="${this._escapar(numero)}" label="${this._escapar(local)}"></option>`).join('');
        if (filiais.includes(selecionada)) select.value = selecionada;
    },

    atualizarLocalidadeFilial() {
        const input = document.getElementById('editarFilialVendedor');
        const ajuda = document.getElementById('localidadeFilialVendedor');
        if (!ajuda) return;
        const numero = String(input?.value || '').trim();
        ajuda.textContent = numero && this.filiais[numero]
            ? `Localidade vinculada: ${this.filiais[numero]}`
            : 'Informe apenas o número da filial; a localidade é vinculada pelo relatório.';
    },

    atualizarGrupo() {
        const grupo = typeof WhatsAppPresenter !== 'undefined' ? WhatsAppPresenter : null;
        this.grupoCarregado = !!grupo?.grupoCarregado && !!(grupo.participantes || []).length;
        this.grupoTelefones = new Set((grupo?.participantes || [])
            .map(p => GrupoWhatsAppModel.telefone(p.telefone)).filter(Boolean));
        const oficiais = new Map();
        this.registros.forEach(v => {
            if (v.statusTelefone !== 'VALIDADO') return;
            const n = GrupoWhatsAppModel.telefone(v.numero);
            if (!n) return;
            if (!oficiais.has(n)) oficiais.set(n, new Set());
            oficiais.get(n).add(v.matricula);
        });
        this.grupoDuplicados = new Set([...oficiais.entries()]
            .filter(([, matriculas]) => matriculas.size > 1).map(([telefone]) => telefone));
        this.filtrar();
        if (typeof PendenciasPresenter !== 'undefined') PendenciasPresenter.renderizar();
        if (typeof ContatosPresenter !== 'undefined' && AdminPresenter.abaAtual === 'contatos') ContatosPresenter.init();
    },

    _situacaoGrupo(v) {
        if (!v.ativo) return { codigo:'inativo', texto:'Cadastro inativo', classe:'unknown' };
        if (v.statusTelefone !== 'VALIDADO' || !GrupoWhatsAppModel.telefone(v.numero))
            return { codigo:'pendente', texto:'Telefone pendente', classe:'review' };
        const n = GrupoWhatsAppModel.telefone(v.numero);
        if (this.grupoDuplicados.has(n))
            return { codigo:'conflito', texto:'Número duplicado · revisar', classe:'review' };
        if (!this.grupoCarregado)
            return { codigo:'sem_dados', texto:'Aguardando lista do grupo', classe:'unknown' };
        if (this.grupoTelefones.has(n))
            return { codigo:'grupo', texto:'No grupo', classe:'in' };
        // Não associar automaticamente pelo final do número; apenas destacar DDD divergente.
        if ([...this.grupoTelefones].some(outro => outro.slice(-8) === n.slice(-8)))
            return { codigo:'revisar', texto:'Possível DDD diferente · revisar', classe:'review' };
        return { codigo:'fora', texto:'Fora do grupo', classe:'out' };
    },

    filtrar() {
        const termo = this._texto(document.getElementById('buscaVendedor')?.value).toLocaleLowerCase('pt-BR');
        const filtroAtivo = document.getElementById('filtroEmpresaVendedor')?.value || 'ativos';
        const filtroTelefone = document.getElementById('filtroStatusVendedor')?.value || 'todos';
        const filtroFilial = this._texto(document.getElementById('filtroFilialVendedor')?.value).toLocaleLowerCase('pt-BR');
        const filtroGrupo = document.getElementById('filtroGrupoVendedor')?.value || '';
        this.filtrados = this.registros.filter(v => {
            if (filtroAtivo === 'ativos' && !v.ativo) return false;
            if (filtroAtivo === 'inativos' && v.ativo) return false;
            if (filtroFilial && this._texto(v.filial).toLocaleLowerCase('pt-BR') !== filtroFilial) return false;
            const correspondeBusca = !termo || [v.nome, v.matricula, v.numero, v.filial, v.localidadeFilial, v.codfil]
                .some(campo => this._texto(campo).toLocaleLowerCase('pt-BR').includes(termo));
            if (!correspondeBusca) return false;
            if (filtroGrupo && this._situacaoGrupo(v).codigo !== filtroGrupo) return false;
            if (filtroTelefone === 'validado') return v.statusTelefone === 'VALIDADO';
            if (filtroTelefone === 'pendente') return v.statusTelefone === 'PENDENTE';
            if (filtroTelefone === 'sem-telefone') return !this._digitos(v.numero);
            if (filtroTelefone === 'sem-link') return !v.linkStatus;
            return true;
        });
        this.pagina = 1;
        this._renderizarResumo();
        this._renderizarTabela();
    },

    _renderizarResumo() {
        const ativos = this.registros.filter(v => v.ativo);
        const inativos = this.registros.length - ativos.length;
        const validados = this.registros.filter(v => v.statusTelefone === 'VALIDADO' && this._digitos(v.numero)).length;
        const pendentes = this.registros.filter(v => v.statusTelefone !== 'VALIDADO' || !this._digitos(v.numero)).length;
        document.getElementById('kpiTotalAtivos').textContent = ativos.length.toLocaleString('pt-BR');
        document.getElementById('kpiTelefoneValidado').textContent = validados.toLocaleString('pt-BR');
        document.getElementById('kpiTelefonePendente').textContent = pendentes.toLocaleString('pt-BR');
        document.getElementById('kpiTotalInativos').textContent = inativos.toLocaleString('pt-BR');
        const estados = ativos.map(v => this._situacaoGrupo(v).codigo);
        for (const [id, codigo] of [['kpiNoGrupo','grupo'],['kpiForaGrupo','fora'],['kpiConflitoGrupo','conflito'],['kpiGrupoPendente','pendente']]) {
            const el = document.getElementById(id);
            if (el) el.textContent = !this.grupoCarregado && ['grupo','fora'].includes(codigo)
                ? '—' : estados.filter(x => x === codigo).length.toLocaleString('pt-BR');
        }
    },

    _statusTelefone(v) {
        if (!this._digitos(v.numero)) return '<span class="vendor-badge unknown">Sem telefone</span>';
        return v.statusTelefone === 'VALIDADO'
            ? '<span class="vendor-badge success">Validado</span>'
            : '<span class="vendor-badge review">Pendente</span>';
    },

    _statusLink(link) {
        if (!link) return '<span class="vendor-badge unknown">Não verificado</span>';
        const status = link.status || 'inconclusivo';
        const mapa = {
            ativo: ['success', 'Respondeu (2xx)'], inativo: ['inactive', 'Possível inativo'],
            redirecionamento: ['review', 'Redireciona'], inconclusivo: ['unknown', 'Inconclusivo'],
            erro: ['unknown', 'Erro na consulta']
        };
        const [classe, rotulo] = mapa[status] || mapa.inconclusivo;
        const detalhe = link.httpCode ? `HTTP ${link.httpCode}` : (link.destino || '');
        return `<span class="vendor-badge ${classe}" title="${this._escapar(detalhe)}">${rotulo}</span>`;
    },

    _renderizarTabela() {
        const destino = document.getElementById('corpoTabelaVendedores');
        if (!destino) return;
        const total = this.filtrados.length;
        const paginas = Math.max(1, Math.ceil(total / this.porPagina));
        this.pagina = Math.min(this.pagina, paginas);
        const inicio = (this.pagina - 1) * this.porPagina;
        const linhas = this.filtrados.slice(inicio, inicio + this.porPagina);
        destino.innerHTML = linhas.map(v => {
            const grupo = this._situacaoGrupo(v);
            const rubi = this._escapar(v.matricula);
            return `<article class="vendor-entry" role="listitem">
                <div class="vendor-entry-main">
                    <span class="vendor-entry-name">${this._escapar(v.nome)}</span>
                    <small>Rubi ${rubi} · <span class="vendor-badge ${v.ativo ? 'success' : 'inactive'}">${v.ativo ? 'Ativo' : 'Inativo'}</span></small>
                    <span class="vendor-entry-meta">Link: ${this._statusLink(v.linkStatus)}</span>
                </div>
                <div class="vendor-entry-field"><span class="field-label">Filial</span>
                    <strong>${this._escapar(v.filial || '—')}</strong><small>${this._escapar(v.localidadeFilial || '')}</small></div>
                <div class="vendor-entry-field"><span class="field-label">WhatsApp / telefone</span>
                    <strong>${this._escapar(this._exibirTelefone(v.numero))}</strong><small>${v.statusTelefone === 'VALIDADO' ? 'Validado' : 'Pendente de validação'}</small></div>
                <div class="vendor-entry-field"><span class="field-label">Situação no grupo</span>
                    <span class="vendor-badge ${grupo.classe}">${this._escapar(grupo.texto)}</span></div>
                <div class="vendor-entry-actions"><button class="vendor-small-btn" type="button" data-rubi="${rubi}">
                    <i class="fas fa-pen"></i> Editar</button>
                    ${grupo.codigo === 'fora' && v.statusTelefone === 'VALIDADO' && v.ativo ? `<button class="vendor-small-btn" type="button" data-contato="${rubi}"><i class="fab fa-whatsapp"></i> Contatar</button>` : ''}</div>
            </article>`;
        }).join('') || '<p class="vendor-empty">Nenhum vendedor encontrado com esses filtros.</p>';
        destino.querySelectorAll('[data-rubi]').forEach(b => b.addEventListener('click', () => this.abrirEdicao(b.dataset.rubi)));
        destino.querySelectorAll('[data-contato]').forEach(b => b.addEventListener('click', () => ContatosPresenter.abrirVendedor(b.dataset.contato)));
        document.getElementById('infoPaginacaoVendedores').textContent = total
            ? `Exibindo ${inicio + 1}–${Math.min(inicio + this.porPagina, total)} de ${total.toLocaleString('pt-BR')} vendedores`
            : 'Nenhum registro';
        document.getElementById('paginaAnteriorVendedores').disabled = this.pagina <= 1;
        document.getElementById('paginaProximaVendedores').disabled = this.pagina >= paginas;
    },

    _renderizarGestaoExtra() {
        const last = document.getElementById('ultimaAtualizacaoVendedores');
        if (last) last.textContent = this.ultimaAtualizacaoTexto;
        this._renderizarResumo();
        const status = document.getElementById('statusVerificacaoLinks');
        if (status && !this.apiUrl) status.textContent = 'Conecte a API da base para habilitar a verificação dos links.';
    },

    abrirNovoCadastro() {
        this.modoModal = 'novo';
        this.matriculaOriginal = '';
        document.getElementById('tituloModalEditarVendedor').innerHTML = '<i class="fas fa-user-plus"></i> NOVO VENDEDOR';
        document.getElementById('editarMatricula').value = '';
        document.getElementById('editarMatricula').readOnly = false;
        document.getElementById('editarNomeVendedor').value = '';
        document.getElementById('editarFilialVendedor').value = '';
        this.atualizarLocalidadeFilial();
        document.getElementById('editarTelefoneVendedor').value = '';
        document.getElementById('editarStatusTelefone').value = 'PENDENTE';
        document.getElementById('editarAtivoVendedor').checked = true;
        document.getElementById('editarObservacoesVendedor').value = '';
        document.getElementById('btnSalvarVendedor').textContent = 'CADASTRAR VENDEDOR';
        document.getElementById('editarSituacaoFuncional').textContent = 'Novo cadastro manual';
        document.getElementById('modalEditarVendedor').style.display = 'flex';
    },

    abrirEdicao(matricula) {
        const chave = this._matricula(matricula);
        const vendedor = this.registros.find(v => this._matricula(v.matricula) === chave);
        if (!vendedor) return;
        this.modoModal = 'editar';
        this.matriculaOriginal = chave;
        document.getElementById('tituloModalEditarVendedor').innerHTML = '<i class="fas fa-user-edit"></i> EDITAR CADASTRO';
        document.getElementById('editarMatricula').value = vendedor.matricula;
        document.getElementById('editarMatricula').readOnly = true;
        document.getElementById('editarNomeVendedor').value = vendedor.nome || '';
        document.getElementById('editarFilialVendedor').value = vendedor.filial || '';
        this.atualizarLocalidadeFilial();
        document.getElementById('editarTelefoneVendedor').value = this._exibirTelefone(vendedor.numero) === '—' ? '' : this._exibirTelefone(vendedor.numero);
        document.getElementById('editarStatusTelefone').value = vendedor.statusTelefone || 'PENDENTE';
        document.getElementById('editarAtivoVendedor').checked = vendedor.ativo !== false;
        document.getElementById('editarObservacoesVendedor').value = vendedor.observacoes || '';
        document.getElementById('btnSalvarVendedor').textContent = 'SALVAR ALTERAÇÕES';
        document.getElementById('editarSituacaoFuncional').textContent = vendedor.situacaoFuncional || 'Não informada';
        document.getElementById('modalEditarVendedor').style.display = 'flex';
    },

    formatarTelefoneDigitado() {
        const campo = document.getElementById('editarTelefoneVendedor');
        if (!campo) return;
        const telefone = GrupoWhatsAppModel.telefone(campo.value);
        if (telefone) campo.value = this._exibirTelefone(telefone);
    },

    aoAlterarTelefone() {
        const numero = GrupoWhatsAppModel.telefone(document.getElementById('editarTelefoneVendedor').value);
        const atual = this.registros.find(v => this._matricula(v.matricula) === this.matriculaOriginal);
        if (this.modoModal === 'novo' || !atual || numero !== this._normalizarTelefone(atual.numero)) {
            document.getElementById('editarStatusTelefone').value = 'PENDENTE';
        }
    },

    fecharEdicao() { document.getElementById('modalEditarVendedor').style.display = 'none'; },

    async salvarEdicao() {
        if (this.salvando) return;
        const matricula = this._matricula(document.getElementById('editarMatricula').value);
        const nome = this._texto(document.getElementById('editarNomeVendedor').value);
        const filialDigitada = this._texto(document.getElementById('editarFilialVendedor').value);
        const filial = /^\d{1,6}$/.test(filialDigitada) ? String(Number(filialDigitada)) : filialDigitada;
        const telefoneInformado = this._digitos(document.getElementById('editarTelefoneVendedor').value);
        const numero = telefoneInformado ? GrupoWhatsAppModel.telefone(telefoneInformado) : '';
        const statusTelefone = this._texto(document.getElementById('editarStatusTelefone').value).toUpperCase();
        const ativo = document.getElementById('editarAtivoVendedor').checked;
        const observacoes = this._texto(document.getElementById('editarObservacoesVendedor').value);
        if (!matricula || !nome || !/^\d{1,6}$/.test(filial)) { UI.erro('Informe matrícula, nome e apenas o número da filial.'); return; }
        if (telefoneInformado && !numero) {
            UI.erro('Telefone inválido. Informe um celular com DDD: (DD) 9 1234-5678.'); return;
        }
        if (numero && !['VALIDADO', 'PENDENTE'].includes(statusTelefone)) { UI.erro('Selecione a situação de validação do telefone.'); return; }
        const cfg = { url: this.apiUrl || localStorage.getItem(this.STORAGE_API_URL), token: null };
        if (!cfg.url || !Auth.usuarioAtual()) { UI.erro('Conecte a API com sua conta Google antes de salvar.'); return; }
        this.salvando = true;
        const botao = document.getElementById('btnSalvarVendedor');
        if (botao) { botao.disabled = true; botao.textContent = 'SALVANDO...'; }
        try {
            if (this.modoModal === 'novo') {
                await GoogleSheetsService.criarVendedor(cfg.url, cfg.token, {
                    matricula, nome, filial, telefone: numero,
                    statusTelefone: numero ? statusTelefone : 'PENDENTE', statusCadastro: ativo ? 'ATIVO' : 'INATIVO', observacoes
                });
                UI.ok('Vendedor cadastrado diretamente na aba Vendedores.');
            } else {
                const atual = this.registros.find(v => this._matricula(v.matricula) === matricula);
                if (!atual) throw new Error('Cadastro não encontrado. Atualize a lista e tente novamente.');
                const statusCadastro = !ativo ? 'INATIVO' : (atual.statusCadastro === 'INATIVO' ? 'ATIVO' : atual.statusCadastro);
                await GoogleSheetsService.salvarVendedor(cfg.url, cfg.token, {
                    matricula, nome, filial, telefone: numero,
                    statusTelefone: numero ? statusTelefone : 'PENDENTE', statusCadastro, observacoes
                });
                UI.ok('Cadastro atualizado diretamente na aba Vendedores.');
            }
            this.fecharEdicao();
            await this._carregar(cfg.url, cfg.token);
        } catch (erro) {
            console.error('Falha ao salvar vendedor:', erro);
            UI.erro(erro.message || 'Não foi possível salvar o cadastro.');
        } finally {
            this.salvando = false;
            if (botao) { botao.disabled = false; botao.textContent = this.modoModal === 'novo' ? 'CADASTRAR VENDEDOR' : 'SALVAR ALTERAÇÕES'; }
        }
    },

    salvarUrlVerificador() { UI.ok('A verificação utilizará a mesma URL e o token da API de vendedores.'); },

    async verificarProximosLinks() {
        if (this.verificandoLinks) return;
        const endpoint = this.apiUrl || localStorage.getItem(this.STORAGE_API_URL) || '';
        if (!endpoint || !Auth.usuarioAtual()) { UI.erro('Conecte a API de vendedores antes de verificar links.'); return; }
        const candidatos = this.registros.filter(v => v.ativo && this._matricula(v.matricula)).filter(v => {
            const link = this.links[`m${this._matricula(v.matricula)}`];
            if (!link?.verificadoEm) return true;
            const idade = Date.now() - new Date(link.verificadoEm).getTime();
            if (['erro', 'inconclusivo'].includes(link.status)) return idade > 60 * 60 * 1000;
            return idade > 7 * 24 * 60 * 60 * 1000;
        }).slice(0, 30);
        if (!candidatos.length) { UI.ok('Todos os links dos vendedores ativos foram verificados nos últimos 7 dias.'); return; }
        this.verificandoLinks = true;
        const botao = document.getElementById('btnVerificarLinks');
        if (botao) { botao.disabled = true; botao.innerHTML = '<i class="fas fa-spinner fa-spin"></i> VERIFICANDO...'; }
        const status = document.getElementById('statusVerificacaoLinks');
        if (status) status.textContent = `Verificando lote com ${candidatos.length} links...`;
        try {
            const resposta = await LinkCheckerService.verificar(endpoint, candidatos.map(v => v.matricula));
            const resultados = resposta.resultados || [];
            await Promise.all(resultados.map(async r => {
                const dados = { status: r.status || 'inconclusivo', httpCode: r.httpCode || '', destino: r.destino || '', url: r.url || '', verificadoEm: r.verificadoEm || new Date().toISOString() };
                this.links[`m${this._matricula(r.matricula)}`] = dados;
            }));
            this.registros.forEach(v => { v.linkStatus = this.links[`m${this._matricula(v.matricula)}`] || null; });
            this.filtrar();
            if (status) status.textContent = `${resultados.length} links verificados e registrados no Google Sheets. Clique novamente para consultar o próximo lote.`;
            UI.ok(`${resultados.length} links verificados.`);
        } catch (erro) {
            console.error(erro);
            if (status) status.textContent = erro.message || 'Falha na verificação.';
            UI.erro(erro.message || 'Não foi possível verificar os links.');
        } finally {
            this.verificandoLinks = false;
            if (botao) { botao.disabled = false; botao.innerHTML = '<i class="fas fa-link"></i> VERIFICAR PRÓXIMOS 30'; }
        }
    },

    mudarPagina(direcao) {
        const paginas = Math.max(1, Math.ceil(this.filtrados.length / this.porPagina));
        this.pagina = Math.min(paginas, Math.max(1, this.pagina + direcao));
        this._renderizarTabela();
    }
};
