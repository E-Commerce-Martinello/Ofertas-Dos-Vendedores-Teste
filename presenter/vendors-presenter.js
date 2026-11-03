// ============================================
// presenter/vendors-presenter.js
// Consulta, complementa e organiza vendedores e participantes do WhatsApp.
// A planilha oficial permanece somente leitura; ajustes operacionais ficam no Firebase.
// ============================================
const VendedoresPresenter = {
    STORAGE_CLIENT_ID: 'adminGoogleClientId',
    STORAGE_SHEET_ID: 'adminGoogleSpreadsheetId',
    STORAGE_LINK_CHECKER: 'adminLinkCheckerUrl',
    registros: [],
    registrosBase: [],
    filtrados: [],
    participantes: [],
    participantesNaoIdentificados: [],
    candidatosCadastro: [],
    ajustes: {},
    complementos: {},
    identificacoes: {},
    links: {},
    pagina: 1,
    porPagina: 50,
    inicializado: false,
    carregando: false,
    verificandoLinks: false,
    ultimaAtualizacaoTexto: '',

    init() {
        if (!this.inicializado) {
            document.getElementById('googleClientId').value = localStorage.getItem(this.STORAGE_CLIENT_ID) || '';
            document.getElementById('googleSheetId').value = localStorage.getItem(this.STORAGE_SHEET_ID) || CONFIG.googleSpreadsheetId || '';
            const urlVerificador = document.getElementById('urlVerificadorLinks');
            if (urlVerificador) urlVerificador.value = localStorage.getItem(this.STORAGE_LINK_CHECKER) || '';
            this.inicializado = true;
        }
        if (!this.registros.length) this._status('Conecte à planilha para carregar vendedores, participantes do grupo e pendências.');
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

    _matricula(valor) {
        let texto = this._texto(valor);
        if (/^\d+\.0+$/.test(texto)) texto = texto.replace(/\.0+$/, '');
        return texto;
    },

    _digitos(valor) {
        let texto = this._texto(valor);
        if (/^[+-]?(?:\d+\.?\d*|\.\d+)[eE][+-]?\d+$/.test(texto)) {
            const numero = Number(texto);
            if (Number.isFinite(numero)) texto = numero.toFixed(0);
        }
        return texto.replace(/\D/g, '');
    },

    _chaveMatricula(valor) { return `m${this._digitos(valor)}`; },
    _telefoneCanonico(valor) {
        let digitos = this._digitos(valor);
        // O mesmo telefone pode aparecer com ou sem o código do país 55.
        if (digitos.startsWith('55') && (digitos.length === 12 || digitos.length === 13)) digitos = digitos.slice(2);
        return digitos;
    },
    _chaveTelefone(valor) { return `p${this._telefoneCanonico(valor)}`; },

    _classificarTelefone(numero) {
        const telefone = this._telefoneCanonico(numero);
        if (!telefone || telefone.length < 8) return 'unknown';
        const exatos = new Set(this.participantes.map(p => this._telefoneCanonico(p.telefoneDigitos)).filter(Boolean));
        if (exatos.has(telefone)) return 'in';
        const final = telefone.slice(-8);
        const finais = new Set(this.participantes.map(p => this._telefoneCanonico(p.telefoneDigitos)).filter(v => v.length >= 8).map(v => v.slice(-8)));
        return finais.has(final) ? 'review' : 'out';
    },

    _classificarZap(status) {
        const valor = this._texto(status).toLocaleUpperCase('pt-BR');
        if (valor.startsWith('JÁ ESTÁ')) return 'in';
        if (valor.startsWith('NÃO ESTÁ')) return 'out';
        if (valor.startsWith('REVISAR')) return 'review';
        return 'unknown';
    },

    _exibirTelefone(valor) {
        let digitos = this._digitos(valor);
        let prefixo = '';
        if (digitos.startsWith('55') && (digitos.length === 12 || digitos.length === 13)) {
            prefixo = '+55 ';
            digitos = digitos.slice(2);
        }
        if (digitos.length === 11) return `${prefixo}(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
        if (digitos.length === 10) return `${prefixo}(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
        return this._texto(valor) || '—';
    },

    limparDados() {
        this.registros = [];
        this.registrosBase = [];
        this.filtrados = [];
        this.participantes = [];
        this.participantesNaoIdentificados = [];
        this.candidatosCadastro = [];
        this.ajustes = {};
        this.complementos = {};
        this.identificacoes = {};
        this.links = {};
        this.pagina = 1;
        this.ultimaAtualizacaoTexto = '';
        this.carregando = false;
        ['painelDadosVendedores','painelGestaoVendedores'].forEach(id => {
            const painel = document.getElementById(id);
            if (painel) painel.style.display = 'none';
        });
        const botao = document.getElementById('btnAtualizarVendedores');
        if (botao) botao.disabled = true;
    },

    _mapearLinhas(linhas) {
        if (!Array.isArray(linhas) || linhas.length < 2) return [];
        const cabecalhos = linhas[0].map(v => this._texto(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase());
        const indice = (nome, fallback) => {
            const pos = cabecalhos.indexOf(nome);
            return pos >= 0 ? pos : fallback;
        };
        const col = {
            filial: indice('FILIAL', 0), codfil: indice('CODFIL', 1), matricula: indice('MATRICULA', 2),
            nome: indice('NOME', 3), empresa: indice('EMPRESA', 4), zap: indice('ZAP', 5),
            numero: indice('NUMERO', 6), envioDiario: indice('ENVIO DIARIO', 7),
            envioEver: indice('ENVIO EVER', 8), contato: indice('ENTRADO EM CTT', 9)
        };
        return linhas.slice(1).map(linha => {
            const valor = i => i < linha.length ? linha[i] : '';
            const vendedor = {
                filial: this._texto(valor(col.filial)), codfil: this._texto(valor(col.codfil)),
                matricula: this._matricula(valor(col.matricula)), nome: this._texto(valor(col.nome)),
                empresa: this._texto(valor(col.empresa)), zap: this._texto(valor(col.zap)),
                numero: this._texto(valor(col.numero)), telefoneDigitos: this._digitos(valor(col.numero)),
                envioDiario: this._texto(valor(col.envioDiario)), envioEver: this._texto(valor(col.envioEver)),
                contato: this._texto(valor(col.contato)), origem: 'planilha'
            };
            vendedor.statusZap = this._classificarZap(vendedor.zap);
            vendedor.ativo = vendedor.empresa.toLocaleUpperCase('pt-BR') === 'OK';
            return vendedor;
        }).filter(v => v.matricula || v.nome || v.numero);
    },

    _mapearParametros(linhas) {
        const participantes = [];
        const funcionarios = [];
        let filialAtual = '';
        let codFilialAtual = '';
        (linhas || []).slice(1).forEach(linha => {
            const nomeGrupo = this._texto(linha[0]);
            const numero = this._texto(linha[1]);
            const ajustado = this._texto(linha[2]);
            const telefoneDigitos = this._digitos(ajustado) || this._digitos(numero);
            if (nomeGrupo && telefoneDigitos) {
                participantes.push({ nome: nomeGrupo, numero: numero || ajustado, numeroAjustado: ajustado, telefoneDigitos });
            }

            const status = this._texto(linha[5]).toLocaleUpperCase('pt-BR');
            const matricula = this._matricula(linha[6]);
            const nome = this._texto(linha[7]);
            if (status === 'FILIAL') {
                const cabecalho = this._texto(linha[6]);
                const filial = cabecalho.match(/F\d{4}\s+(.+)$/i);
                const codigo = cabecalho.match(/(F\d{4})/i);
                filialAtual = filial ? filial[1].trim() : cabecalho;
                codFilialAtual = codigo ? codigo[1].toUpperCase() : '';
            } else if (status === 'OK' && matricula && nome) {
                funcionarios.push({ matricula, nome, filial: filialAtual, codfil: codFilialAtual, origem: 'relacao_atual' });
            }
        });
        return { participantes, funcionarios };
    },

    async conectar() {
        if (this.carregando) return;
        const clientId = this._texto(document.getElementById('googleClientId').value);
        const sheetInput = this._texto(document.getElementById('googleSheetId').value) || CONFIG.googleSpreadsheetId;
        const spreadsheetId = GoogleSheetsService.extrairSpreadsheetId(sheetInput);
        if (!clientId || !clientId.endsWith('.apps.googleusercontent.com')) {
            UI.erro('Informe um ID de cliente OAuth válido do Google.'); return;
        }
        if (!spreadsheetId || !/^[a-zA-Z0-9-_]+$/.test(spreadsheetId)) {
            UI.erro('Informe o link completo ou o ID válido da planilha Google Sheets.'); return;
        }
        localStorage.setItem(this.STORAGE_CLIENT_ID, clientId);
        localStorage.setItem(this.STORAGE_SHEET_ID, spreadsheetId);
        await this._carregar(clientId, spreadsheetId);
    },

    async atualizar() {
        if (this.carregando) return;
        const clientId = localStorage.getItem(this.STORAGE_CLIENT_ID) || this._texto(document.getElementById('googleClientId').value);
        const spreadsheetId = localStorage.getItem(this.STORAGE_SHEET_ID) || GoogleSheetsService.extrairSpreadsheetId(this._texto(document.getElementById('googleSheetId').value) || CONFIG.googleSpreadsheetId);
        if (!clientId || !spreadsheetId) { this._status('Configure e conecte sua planilha primeiro.'); return; }
        await this._carregar(clientId, spreadsheetId);
    },

    async _carregar(clientId, spreadsheetId) {
        this.carregando = true;
        const botao = document.getElementById('btnConectarSheets');
        const botaoAtualizar = document.getElementById('btnAtualizarVendedores');
        if (botao) { botao.disabled = true; botao.innerHTML = '<i class="fas fa-spinner fa-spin"></i> CONECTANDO...'; }
        if (botaoAtualizar) botaoAtualizar.disabled = true;
        this._status('Consultando Banco de Dados, Parâmetros de Dados e ajustes do painel...');
        try {
            const [linhasBanco, linhasParametros] = await Promise.all([
                GoogleSheetsService.carregarBancoDeDados(clientId, spreadsheetId),
                GoogleSheetsService.carregarParametros(clientId, spreadsheetId)
            ]);
            let gestao = {};
            this.erroFirebaseGestao = '';
            try { gestao = await VendorManagementService.carregar(); }
            catch (erroGestao) {
                console.warn('Firebase não permitiu ler os complementos de gestão:', erroGestao);
                this.erroFirebaseGestao = ' A base de ajustes do Firebase não pôde ser lida; confira as regras de acesso do Realtime Database.';
            }
            this.registrosBase = this._mapearLinhas(linhasBanco);
            if (!this.registrosBase.length) throw new Error('A aba Banco de Dados foi acessada, mas não encontrei linhas de vendedores nas colunas A até J.');
            const parametros = this._mapearParametros(linhasParametros);
            this.participantes = parametros.participantes;
            this._funcionariosFonte = parametros.funcionarios;
            this.ajustes = gestao.ajustes || {};
            this.complementos = gestao.complementos || {};
            this.identificacoes = gestao.participantes || {};
            this.links = gestao.links || {};
            this._reconstruirRegistros(parametros.funcionarios);
            document.getElementById('painelDadosVendedores').style.display = 'block';
            document.getElementById('painelGestaoVendedores').style.display = 'block';
            if (botaoAtualizar) botaoAtualizar.disabled = false;
            this.pagina = 1;
            this.filtrar();
            this._renderizarGestaoExtra();
            const horario = new Date().toLocaleString('pt-BR');
            this.ultimaAtualizacaoTexto = `Dados consultados em ${horario}. A planilha foi lida; complementos e ajustes são salvos separadamente no Firebase.`;
            document.getElementById('ultimaAtualizacaoVendedores').textContent = this.ultimaAtualizacaoTexto;
            this._status(`${this.registros.length.toLocaleString('pt-BR')} vendedores/complementos e ${this.participantes.length.toLocaleString('pt-BR')} participantes carregados.${this.erroFirebaseGestao}`, this.erroFirebaseGestao ? 'error' : 'ok');
        } catch (erro) {
            console.error('Erro ao carregar gestão de vendedores:', erro);
            this._status(erro.message || 'Não foi possível carregar os dados.', 'error');
            UI.erro(erro.message || 'Não foi possível conectar aos dados.');
        } finally {
            this.carregando = false;
            if (botao) { botao.disabled = false; botao.innerHTML = '<i class="fab fa-google"></i> CONECTAR E CARREGAR'; }
        }
    },

    _reconstruirRegistros(funcionarios = []) {
        const base = this.registrosBase.map(v => {
            const chave = this._chaveMatricula(v.matricula);
            const ajuste = this.ajustes[chave] || {};
            const complemento = this.complementos[chave] || {};
            const link = this.links[chave] || null;
            const ajustado = { ...v };
            let complementoAplicado = false;
            // Quando um registro complementar passa a existir também na planilha oficial,
            // aproveita os dados preenchidos manualmente apenas nos campos que vierem vazios.
            ['nome','filial','codfil','numero'].forEach(campo => {
                if (ajuste[campo] !== undefined && ajuste[campo] !== '') {
                    ajustado[campo] = ajuste[campo];
                } else if ((!ajustado[campo] || ajustado[campo] === '—') && complemento[campo]) {
                    ajustado[campo] = complemento[campo];
                    complementoAplicado = true;
                }
            });
            ajustado.telefoneDigitos = this._telefoneCanonico(ajustado.numero);
            ajustado.ajusteManual = Object.keys(ajuste).some(k => ['nome','filial','codfil','numero'].includes(k));
            ajustado.complementoAplicado = complementoAplicado;
            ajustado.ativo = ajuste.ativo === false ? false : (ajuste.ativo === true ? true : v.ativo);
            // Recalcula a situação usando o telefone efetivamente exibido (inclusive correções manuais).
            ajustado.statusZap = ajustado.telefoneDigitos ? this._classificarTelefone(ajustado.telefoneDigitos) : this._classificarZap(ajuste.zap || v.zap);
            ajustado.zap = ajuste.zap || v.zap;
            ajustado.linkStatus = link;
            return ajustado;
        });
        const matriculasExistentes = new Set(base.map(v => this._digitos(v.matricula)));
        Object.keys(this.complementos).forEach(chave => {
            const comp = this.complementos[chave] || {};
            const matricula = this._matricula(comp.matricula || String(chave).replace(/^m/, ''));
            if (!matricula || matriculasExistentes.has(this._digitos(matricula)) || comp.ativo === false) return;
            base.push({
                filial: this._texto(comp.filial), codfil: this._texto(comp.codfil), matricula,
                nome: this._texto(comp.nome), empresa: 'COMPLEMENTAR', zap: 'NÃO VERIFICADO',
                numero: this._texto(comp.numero), telefoneDigitos: this._telefoneCanonico(comp.numero),
                envioDiario: '', envioEver: '', contato: '', statusZap: this._classificarTelefone(comp.numero),
                ativo: true, origem: 'complementar', ajusteManual: false,
                linkStatus: this.links[this._chaveMatricula(matricula)] || null
            });
        });
        this.registros = base;

        const matBase = new Set(this.registrosBase.map(v => this._digitos(v.matricula)));
        const matComplementos = new Set(Object.values(this.complementos).filter(v => v?.ativo !== false).map(v => this._digitos(v?.matricula)).filter(Boolean));
        this.candidatosCadastro = (funcionarios || []).filter(v => {
            const mat = this._digitos(v.matricula);
            return mat && !matBase.has(mat) && !matComplementos.has(mat);
        });

        const telefones = new Set();
        const ultimosOito = new Set();
        this.registros.forEach(v => {
            const fone = this._telefoneCanonico(v.numero);
            if (fone) { telefones.add(fone); if (fone.length >= 8) ultimosOito.add(fone.slice(-8)); }
        });
        this.participantesNaoIdentificados = this.participantes.filter(p => {
            const fone = this._telefoneCanonico(p.telefoneDigitos);
            if (!fone) return true;
            return !telefones.has(fone) && !(fone.length >= 8 && ultimosOito.has(fone.slice(-8)));
        }).map(p => ({ ...p, identificacaoManual: this.identificacoes[this._chaveTelefone(p.telefoneDigitos)] || null }));
    },

    filtrar() {
        const termo = this._texto(document.getElementById('buscaVendedor')?.value).toLocaleLowerCase('pt-BR');
        const filtro = document.getElementById('filtroStatusVendedor')?.value || 'todos';
        const filtroEmpresa = document.getElementById('filtroEmpresaVendedor')?.value || 'ativos';
        this.filtrados = this.registros.filter(v => {
            if (filtroEmpresa === 'ativos' && !v.ativo) return false;
            const correspondeBusca = !termo || [v.nome, v.matricula, v.numero, v.filial, v.codfil]
                .some(campo => this._texto(campo).toLocaleLowerCase('pt-BR').includes(termo));
            if (!correspondeBusca) return false;
            if (filtro === 'fora') return v.statusZap === 'out';
            if (filtro === 'no-grupo') return v.statusZap === 'in';
            if (filtro === 'revisar') return v.statusZap === 'review';
            if (filtro === 'sem-telefone') return !v.telefoneDigitos;
            if (filtro === 'complementares') return v.origem === 'complementar';
            if (filtro === 'sem-link') return !v.linkStatus;
            return true;
        });
        this.pagina = 1;
        this._renderizarResumo();
        this._renderizarTabela();
    },

    _renderizarResumo() {
        const ativos = this.registros.filter(v => v.ativo);
        const contar = status => ativos.filter(v => v.statusZap === status).length;
        document.getElementById('kpiTotalAtivos').textContent = ativos.length.toLocaleString('pt-BR');
        document.getElementById('kpiNoGrupo').textContent = contar('in').toLocaleString('pt-BR');
        document.getElementById('kpiForaGrupo').textContent = contar('out').toLocaleString('pt-BR');
        document.getElementById('kpiRevisar').textContent = contar('review').toLocaleString('pt-BR');
        const elPend = document.getElementById('kpiPendenciasCadastro');
        if (elPend) elPend.textContent = this.candidatosCadastro.length.toLocaleString('pt-BR');
        const elNao = document.getElementById('kpiNaoIdentificados');
        if (elNao) elNao.textContent = this.participantesNaoIdentificados.length.toLocaleString('pt-BR');
    },

    _statusLink(link) {
        if (!link) return '<span class="vendor-badge unknown">Não verificado</span>';
        const status = link.status || 'inconclusivo';
        const map = {
            ativo: ['success','Ativo'], inativo: ['inactive','Inativo'],
            redirecionamento: ['review','Redireciona'], inconclusivo: ['unknown','Inconclusivo'],
            erro: ['unknown','Erro na consulta']
        };
        const [classe,label] = map[status] || map.inconclusivo;
        const detalhe = link.httpCode ? `HTTP ${link.httpCode}` : (link.destino || '');
        return `<span class="vendor-badge ${classe}" title="${this._escapar(detalhe)}">${label}</span>`;
    },

    _renderizarTabela() {
        const tbody = document.getElementById('corpoTabelaVendedores');
        const total = this.filtrados.length;
        const paginas = Math.max(1, Math.ceil(total / this.porPagina));
        if (this.pagina > paginas) this.pagina = paginas;
        const inicio = (this.pagina - 1) * this.porPagina;
        const paginaDados = this.filtrados.slice(inicio, inicio + this.porPagina);
        if (!total) {
            tbody.innerHTML = '<tr><td colspan="9" class="vendor-empty">Nenhum vendedor encontrado com esses filtros.</td></tr>';
        } else {
            tbody.innerHTML = paginaDados.map(v => {
                const badge = v.statusZap;
                const statusLabel = ({ in: 'JÁ ESTÁ (IDÊNTICO)', out: 'NÃO ESTÁ NO GRUPO', review: 'REVISAR TELEFONE' })[badge] || v.zap || 'NÃO IDENTIFICADO';
                const badgeClass = badge === 'in' ? 'in' : badge === 'out' ? 'out' : badge === 'review' ? 'review' : 'unknown';
                const contatoRegistrado = ['1','SIM','TRUE','OK','✅'].includes(v.contato.toLocaleUpperCase('pt-BR'));
                const contato = v.contato ? (contatoRegistrado ? 'Sim' : this._escapar(v.contato)) : '—';
                const origem = v.origem === 'complementar' ? '<span class="vendor-badge review">Complementar</span>' : (v.ajusteManual ? '<span class="vendor-badge review">Ajustado</span>' : (v.complementoAplicado ? '<span class="vendor-badge review">Dados complementares</span>' : 'Planilha'));
                return `<tr>
                    <td>${this._escapar(v.matricula || '—')}</td>
                    <td>${this._escapar(v.nome || '—')}</td>
                    <td>${this._escapar(v.filial || '—')}</td>
                    <td><span class="vendor-badge ${v.ativo ? 'success' : 'inactive'}">${v.ativo ? 'ATIVO' : 'INATIVO'}</span></td>
                    <td>${this._escapar(this._exibirTelefone(v.numero))}</td>
                    <td><span class="vendor-badge ${badgeClass}">${this._escapar(statusLabel)}</span></td>
                    <td>${contato}</td>
                    <td>${this._statusLink(v.linkStatus)}</td>
                    <td><button class="vendor-small-btn" type="button" onclick="VendedoresPresenter.abrirEdicao('${this._escapar(v.matricula)}')"><i class="fas fa-pen"></i> Editar</button><div class="vendor-last-update">${origem}</div></td>
                </tr>`;
            }).join('');
        }
        document.getElementById('infoPaginacaoVendedores').textContent = total
            ? `Exibindo ${inicio + 1}–${Math.min(inicio + this.porPagina, total)} de ${total.toLocaleString('pt-BR')} vendedores`
            : 'Nenhum registro';
        document.getElementById('paginaAnteriorVendedores').disabled = this.pagina <= 1;
        document.getElementById('paginaProximaVendedores').disabled = this.pagina >= paginas;
    },

    _renderizarGestaoExtra() {
        const corpoPend = document.getElementById('corpoPendenciasCadastro');
        if (corpoPend) {
            corpoPend.innerHTML = this.candidatosCadastro.length ? this.candidatosCadastro.map(v => `
                <tr>
                    <td>${this._escapar(v.matricula)}</td><td>${this._escapar(v.nome)}</td><td>${this._escapar(v.filial || '—')}</td>
                    <td><input class="vendor-inline-input" id="foneNovo_${this._escapar(v.matricula)}" inputmode="tel" placeholder="DDD + telefone"></td>
                    <td><button class="vendor-small-btn primary" type="button" onclick="VendedoresPresenter.finalizarCadastro('${this._escapar(v.matricula)}')">Cadastrar no painel</button></td>
                </tr>`).join('') : '<tr><td colspan="5" class="vendor-empty">Nenhum novo funcionário pendente de cadastro na comparação atual.</td></tr>';
        }
        const corpoNao = document.getElementById('corpoParticipantesNaoIdentificados');
        if (corpoNao) {
            corpoNao.innerHTML = this.participantesNaoIdentificados.length ? this.participantesNaoIdentificados.map(p => {
                const info = p.identificacaoManual || {};
                const key = this._telefoneCanonico(p.telefoneDigitos);
                const tipo = info.tipo || '';
                return `<tr>
                    <td>${this._escapar(p.nome)}</td><td>${this._escapar(this._exibirTelefone(p.numeroAjustado || p.numero))}</td>
                    <td><select class="vendor-inline-input" id="tipoParticipante_${key}">
                        <option value="">A identificar</option><option value="vendedor" ${tipo==='vendedor'?'selected':''}>Vendedor</option>
                        <option value="gerente" ${tipo==='gerente'?'selected':''}>Gerente</option><option value="funcionario" ${tipo==='funcionario'?'selected':''}>Funcionário</option><option value="outro" ${tipo==='outro'?'selected':''}>Outro</option>
                    </select></td>
                    <td><input class="vendor-inline-input" id="descricaoParticipante_${key}" value="${this._escapar(info.identificacao || '')}" placeholder="Nome, setor ou observação"></td>
                    <td><button class="vendor-small-btn primary" type="button" onclick="VendedoresPresenter.salvarIdentificacao('${key}')">Salvar</button></td>
                </tr>`;
            }).join('') : '<tr><td colspan="5" class="vendor-empty">Todos os participantes encontrados possuem correspondência com a base de vendedores.</td></tr>';
        }
        const last = document.getElementById('ultimaAtualizacaoVendedores');
        if (last) last.textContent = `${this.ultimaAtualizacaoTexto} Relação de funcionários comparada: ${this.candidatosCadastro.length} pendência(s) de cadastro; ${this.participantesNaoIdentificados.length} participante(s) sem vínculo com a base.`;
        this._renderizarResumo();
    },

    async finalizarCadastro(matricula) {
        const candidato = this.candidatosCadastro.find(v => this._digitos(v.matricula) === this._digitos(matricula));
        if (!candidato) { UI.erro('Este cadastro já foi processado ou não está mais pendente. Atualize os dados.'); return; }
        const numero = this._texto(document.getElementById(`foneNovo_${matricula}`)?.value);
        if (this._digitos(numero).length < 10) { UI.erro('Informe um telefone com DDD e número válido.'); return; }
        try {
            await VendorManagementService.salvarComplemento(matricula, {
                nome: candidato.nome, filial: candidato.filial, codfil: candidato.codfil,
                numero, ativo: true, origem: 'relacao_atual', observacao: 'Cadastro complementar criado pelo painel.'
            });
            this.complementos[this._chaveMatricula(matricula)] = {
                matricula: this._digitos(matricula), nome: candidato.nome, filial: candidato.filial,
                codfil: candidato.codfil, numero, ativo: true, origem: 'relacao_atual'
            };
            this._reconstruirRegistros(this._obterFuncionariosDaLista());
            this.filtrar(); this._renderizarGestaoExtra();
            UI.ok('Cadastro complementar salvo no painel. A planilha oficial não foi alterada.');
        } catch (e) { console.error(e); UI.erro(`Não foi possível salvar o cadastro: ${e.message || e}`); }
    },

    _obterFuncionariosDaLista() {
        // Reconstrói a lista de candidatos a partir da fonte em memória já carregada.
        return this._funcionariosFonte || [];
    },

    async salvarIdentificacao(telefone) {
        const tipo = this._texto(document.getElementById(`tipoParticipante_${telefone}`)?.value);
        const identificacao = this._texto(document.getElementById(`descricaoParticipante_${telefone}`)?.value);
        if (!tipo) { UI.erro('Selecione se o participante é vendedor, gerente, funcionário ou outro.'); return; }
        const participante = this.participantes.find(p => this._digitos(p.telefoneDigitos) === this._digitos(telefone));
        try {
            await VendorManagementService.salvarIdentificacao(telefone, {
                tipo, identificacao, nomeParticipante: participante?.nome || ''
            });
            this.identificacoes[this._chaveTelefone(telefone)] = { tipo, identificacao, nomeParticipante: participante?.nome || '' };
            this._reconstruirRegistros(this._obterFuncionariosDaLista());
            this._renderizarGestaoExtra();
            UI.ok('Identificação salva. Ela será mantida nas próximas atualizações da planilha.');
        } catch (e) { console.error(e); UI.erro(`Não foi possível salvar a identificação: ${e.message || e}`); }
    },

    abrirEdicao(matricula) {
        const vendedor = this.registros.find(v => this._digitos(v.matricula) === this._digitos(matricula));
        if (!vendedor) return;
        document.getElementById('editarMatricula').value = vendedor.matricula;
        document.getElementById('editarNomeVendedor').value = vendedor.nome || '';
        document.getElementById('editarFilialVendedor').value = vendedor.filial || '';
        document.getElementById('editarTelefoneVendedor').value = vendedor.numero || '';
        document.getElementById('editarAtivoVendedor').checked = vendedor.ativo !== false;
        document.getElementById('modalEditarVendedor').style.display = 'flex';
    },

    fecharEdicao() { document.getElementById('modalEditarVendedor').style.display = 'none'; },

    async salvarEdicao() {
        const matricula = this._digitos(document.getElementById('editarMatricula').value);
        const nome = this._texto(document.getElementById('editarNomeVendedor').value);
        const filial = this._texto(document.getElementById('editarFilialVendedor').value);
        const numero = this._texto(document.getElementById('editarTelefoneVendedor').value);
        const ativo = document.getElementById('editarAtivoVendedor').checked;
        if (!matricula || !nome) { UI.erro('Matrícula e nome são obrigatórios.'); return; }
        if (numero && this._digitos(numero).length < 10) { UI.erro('Confira o telefone informado.'); return; }
        const base = this.registros.find(v => this._digitos(v.matricula) === matricula);
        try {
            const ajuste = { nome, filial, numero, ativo, codfil: base?.codfil || '' };
            await VendorManagementService.salvarAjuste(matricula, ajuste);
            this.ajustes[this._chaveMatricula(matricula)] = ajuste;
            if (this.complementos[this._chaveMatricula(matricula)]) {
                await VendorManagementService.salvarComplemento(matricula, { ...this.complementos[this._chaveMatricula(matricula)], nome, filial, numero, ativo });
                this.complementos[this._chaveMatricula(matricula)] = { ...this.complementos[this._chaveMatricula(matricula)], nome, filial, numero, ativo };
            }
            this._reconstruirRegistros(this._obterFuncionariosDaLista());
            this.fecharEdicao(); this.filtrar(); this._renderizarGestaoExtra();
            UI.ok('Ajuste salvo no painel. A linha original do Google Sheets foi preservada.');
        } catch (e) { console.error(e); UI.erro(`Não foi possível salvar o ajuste: ${e.message || e}`); }
    },

    salvarUrlVerificador() {
        const url = this._texto(document.getElementById('urlVerificadorLinks')?.value);
        if (url && !/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec(?:\?.*)?$/.test(url)) {
            UI.erro('A URL deve ser a URL publicada do Google Apps Script e terminar em /exec.'); return;
        }
        localStorage.setItem(this.STORAGE_LINK_CHECKER, url);
        UI.ok(url ? 'URL do verificador salva neste navegador.' : 'URL do verificador removida.');
    },

    async verificarProximosLinks() {
        if (this.verificandoLinks) return;
        const endpoint = this._texto(document.getElementById('urlVerificadorLinks')?.value) || localStorage.getItem(this.STORAGE_LINK_CHECKER) || '';
        const candidatos = this.registros.filter(v => v.ativo && this._digitos(v.matricula)).filter(v => {
            const link = this.links[this._chaveMatricula(v.matricula)];
            if (!link?.verificadoEm) return true;
            const idade = Date.now() - new Date(link.verificadoEm).getTime();
            if (['erro','inconclusivo'].includes(link.status)) return idade > 60 * 60 * 1000;
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
                const dados = { status: r.status || 'inconclusivo', httpCode: r.httpCode || '', destino: r.destino || '', url: r.url || '' };
                this.links[this._chaveMatricula(r.matricula)] = { ...dados, verificadoEm: new Date().toISOString() };
                await VendorManagementService.salvarStatusLink(r.matricula, dados);
            }));
            this._reconstruirRegistros(this._obterFuncionariosDaLista());
            this.filtrar();
            if (status) status.textContent = `${resultados.length} links verificados. Clique novamente para verificar o próximo lote.`;
            UI.ok(`${resultados.length} links verificados e resultados salvos.`);
        } catch (e) {
            console.error(e);
            if (status) status.textContent = e.message || 'Falha na verificação.';
            UI.erro(e.message || 'Não foi possível verificar os links.');
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
