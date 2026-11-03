// ============================================
// presenter/vendors-presenter.js
// Consulta e filtragem da base Banco de Dados no Google Sheets.
// ============================================

const VendedoresPresenter = {
    STORAGE_CLIENT_ID: 'adminGoogleClientId',
    STORAGE_SHEET_ID: 'adminGoogleSpreadsheetId',
    registros: [],
    filtrados: [],
    pagina: 1,
    porPagina: 50,
    inicializado: false,
    carregando: false,

    init() {
        if (!this.inicializado) {
            document.getElementById('googleClientId').value = localStorage.getItem(this.STORAGE_CLIENT_ID) || '';
            document.getElementById('googleSheetId').value = localStorage.getItem(this.STORAGE_SHEET_ID) || CONFIG.googleSpreadsheetId || '';
            this.inicializado = true;
        }
        if (!this.registros.length) this._status('Configure o acesso à planilha e clique em “Conectar e carregar”.');
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

    _texto(valor) {
        return String(valor ?? '').trim();
    },

    _matricula(valor) {
        let texto = this._texto(valor);
        if (/^\d+\.0+$/.test(texto)) texto = texto.replace(/\.0+$/, '');
        return texto;
    },

    _digitos(valor) {
        let texto = this._texto(valor);
        // Algumas exportações podem representar telefones grandes em notação científica.
        if (/^[+-]?(?:\d+\.?\d*|\.\d+)[eE][+-]?\d+$/.test(texto)) {
            const numero = Number(texto);
            if (Number.isFinite(numero)) texto = numero.toFixed(0);
        }
        return texto.replace(/\D/g, '');
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
        this.filtrados = [];
        this.pagina = 1;
        const painel = document.getElementById('painelDadosVendedores');
        if (painel) painel.style.display = 'none';
        const corpo = document.getElementById('corpoTabelaVendedores');
        if (corpo) corpo.innerHTML = '<tr><td colspan="6" class="vendor-empty">Conecte a planilha para visualizar os vendedores.</td></tr>';
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
            filial: indice('FILIAL', 0),
            codfil: indice('CODFIL', 1),
            matricula: indice('MATRICULA', 2),
            nome: indice('NOME', 3),
            empresa: indice('EMPRESA', 4),
            zap: indice('ZAP', 5),
            numero: indice('NUMERO', 6),
            envioDiario: indice('ENVIO DIARIO', 7),
            envioEver: indice('ENVIO EVER', 8),
            contato: indice('ENTRADO EM CTT', 9)
        };

        return linhas.slice(1).map(linha => {
            const valor = i => i < linha.length ? linha[i] : '';
            const vendedor = {
                filial: this._texto(valor(col.filial)),
                codfil: this._texto(valor(col.codfil)),
                matricula: this._matricula(valor(col.matricula)),
                nome: this._texto(valor(col.nome)),
                empresa: this._texto(valor(col.empresa)),
                zap: this._texto(valor(col.zap)),
                numero: this._texto(valor(col.numero)),
                telefoneDigitos: this._digitos(valor(col.numero)),
                envioDiario: this._texto(valor(col.envioDiario)),
                envioEver: this._texto(valor(col.envioEver)),
                contato: this._texto(valor(col.contato))
            };
            vendedor.statusZap = this._classificarZap(vendedor.zap);
            vendedor.ativo = vendedor.empresa.toLocaleUpperCase('pt-BR') === 'OK';
            return vendedor;
        }).filter(v => v.matricula || v.nome || v.numero);
    },

    async conectar() {
        if (this.carregando) return;
        const clientId = this._texto(document.getElementById('googleClientId').value);
        const sheetInput = this._texto(document.getElementById('googleSheetId').value) || CONFIG.googleSpreadsheetId;
        const spreadsheetId = GoogleSheetsService.extrairSpreadsheetId(sheetInput);

        if (!clientId || !clientId.endsWith('.apps.googleusercontent.com')) {
            UI.erro('Informe um ID de cliente OAuth válido do Google.');
            return;
        }
        if (!spreadsheetId || !/^[a-zA-Z0-9-_]+$/.test(spreadsheetId)) {
            UI.erro('Informe o link completo ou o ID válido da planilha Google Sheets.');
            return;
        }

        localStorage.setItem(this.STORAGE_CLIENT_ID, clientId);
        localStorage.setItem(this.STORAGE_SHEET_ID, spreadsheetId);
        await this._carregar(clientId, spreadsheetId);
    },

    async atualizar() {
        if (this.carregando) return;
        const clientId = localStorage.getItem(this.STORAGE_CLIENT_ID) || this._texto(document.getElementById('googleClientId').value);
        const spreadsheetId = localStorage.getItem(this.STORAGE_SHEET_ID) || GoogleSheetsService.extrairSpreadsheetId(this._texto(document.getElementById('googleSheetId').value) || CONFIG.googleSpreadsheetId);
        if (!clientId || !spreadsheetId) {
            this._status('Configure e conecte sua planilha primeiro.');
            return;
        }
        await this._carregar(clientId, spreadsheetId);
    },

    async _carregar(clientId, spreadsheetId) {
        this.carregando = true;
        const botao = document.getElementById('btnConectarSheets');
        const botaoAtualizar = document.getElementById('btnAtualizarVendedores');
        if (botao) { botao.disabled = true; botao.innerHTML = '<i class="fas fa-spinner fa-spin"></i> CONECTANDO...'; }
        if (botaoAtualizar) botaoAtualizar.disabled = true;
        this._status('Aguardando autorização do Google e consultando a aba Banco de Dados...');

        try {
            // A autorização OAuth é solicitada pelo Google na primeira conexão; o token não é persistido no navegador.
            const linhas = await GoogleSheetsService.carregarBancoDeDados(clientId, spreadsheetId);
            this.registros = this._mapearLinhas(linhas);
            if (!this.registros.length) throw new Error('A aba Banco de Dados foi acessada, mas não encontrei linhas de vendedores. Confira se os dados estão nas colunas A até J.');

            document.getElementById('painelDadosVendedores').style.display = 'block';
            document.getElementById('btnAtualizarVendedores').disabled = false;
            this.pagina = 1;
            this.filtrar();
            const horario = new Date().toLocaleString('pt-BR');
            document.getElementById('ultimaAtualizacaoVendedores').textContent = `Dados consultados em ${horario}. A planilha não foi modificada.`;
            this._status(`${this.registros.length.toLocaleString('pt-BR')} registros carregados com acesso somente de leitura.`, 'ok');
        } catch (erro) {
            console.error('Erro ao carregar vendedores:', erro);
            this._status(erro.message || 'Não foi possível carregar a planilha.', 'error');
            if (this.registros.length) document.getElementById('btnAtualizarVendedores').disabled = false;
            UI.erro(erro.message || 'Não foi possível conectar ao Google Sheets.');
        } finally {
            this.carregando = false;
            if (botao) { botao.disabled = false; botao.innerHTML = '<i class="fab fa-google"></i> CONECTAR E CARREGAR'; }
        }
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
    },

    _renderizarTabela() {
        const tbody = document.getElementById('corpoTabelaVendedores');
        const total = this.filtrados.length;
        const paginas = Math.max(1, Math.ceil(total / this.porPagina));
        if (this.pagina > paginas) this.pagina = paginas;
        const inicio = (this.pagina - 1) * this.porPagina;
        const paginaDados = this.filtrados.slice(inicio, inicio + this.porPagina);

        if (!total) {
            tbody.innerHTML = '<tr><td colspan="6" class="vendor-empty">Nenhum vendedor encontrado com esses filtros.</td></tr>';
        } else {
            tbody.innerHTML = paginaDados.map(v => {
                const statusLabel = v.zap || 'NÃO IDENTIFICADO';
                const badge = v.statusZap;
                const badgeClass = badge === 'in' ? 'in' : badge === 'out' ? 'out' : badge === 'review' ? 'review' : 'unknown';
                const contatoRegistrado = ['1', 'SIM', 'TRUE', 'OK', '✅'].includes(v.contato.toLocaleUpperCase('pt-BR'));
                const contato = v.contato ? (contatoRegistrado ? 'Sim' : this._escapar(v.contato)) : '—';
                return `<tr>
                    <td>${this._escapar(v.matricula || '—')}</td>
                    <td>${this._escapar(v.nome || '—')}</td>
                    <td>${this._escapar(v.filial || '—')}</td>
                    <td>${this._escapar(this._exibirTelefone(v.numero))}</td>
                    <td><span class="vendor-badge ${badgeClass}">${this._escapar(statusLabel)}</span></td>
                    <td>${contato}</td>
                </tr>`;
            }).join('');
        }

        document.getElementById('infoPaginacaoVendedores').textContent = total
            ? `Exibindo ${inicio + 1}–${Math.min(inicio + this.porPagina, total)} de ${total.toLocaleString('pt-BR')} vendedores`
            : 'Nenhum registro';
        document.getElementById('paginaAnteriorVendedores').disabled = this.pagina <= 1;
        document.getElementById('paginaProximaVendedores').disabled = this.pagina >= paginas;
    },

    mudarPagina(direcao) {
        const paginas = Math.max(1, Math.ceil(this.filtrados.length / this.porPagina));
        this.pagina = Math.min(paginas, Math.max(1, this.pagina + direcao));
        this._renderizarTabela();
    }
};
