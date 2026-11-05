// ============================================
// model/google-sheets.js
// Cliente da API privada do Apps Script vinculado à planilha de TESTE.
// Todas as operações usam Firebase ID token temporário no corpo do POST.
// ============================================
const GoogleSheetsService = {
    apiUrl: '',

    obterUrl() {
        // Usamos primeiro o endereço que já funcionou neste navegador, sem pedir que o usuário cole novamente.
        // CONFIG fornece um endereço inicial para outros dispositivos.
        return localStorage.getItem('martVendedoresApiUrl_TESTE') || CONFIG.adminApiUrl || '';
    },

    configurar(apiUrl) {
        const url = String(apiUrl || '').trim();
        if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec(?:\?.*)?$/.test(url)) {
            throw new Error('A conexão da planilha não está configurada. Verifique o endereço adminApiUrl em shared/config.js.');
        }
        this.apiUrl = url.split('?')[0];
    },

    // Ponte HTTPS opcional para celulares: evita formulários em iframes invisíveis.
    // Nunca armazena o token nem a base de vendedores no gateway.
    obterProxy() {
        const valor = String(CONFIG.adminProxyUrl || '').trim();
        if (!valor) return '';
        const url = new URL(valor);
        if (url.protocol !== 'https:' || !url.hostname.endsWith('.workers.dev')) {
            throw new Error('Endereço do gateway inválido. Use a URL HTTPS .workers.dev do seu Cloudflare Worker.');
        }
        return url.href.replace(/\/$/, '');
    },

    async _postProxy(action, payload = {}) {
        const url = this.obterProxy();
        const token = await Auth.idToken();
        const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const controller = new AbortController();
        const longo = ['importarFuncionarios','importarWhatsApp','normalizarWhatsApp','verificarLinks'].includes(action);
        const timer = setTimeout(() => controller.abort(), longo ? 120000 : 45000);
        try {
            const resposta = await fetch(url, {
                method: 'POST', mode: 'cors', cache: 'no-store', credentials: 'omit',
                headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
                body: JSON.stringify({ action, firebaseIdToken: token, requestId, payload })
            });
            let dados;
            try { dados = await resposta.json(); }
            catch (_) { throw new Error(`O gateway respondeu em formato inesperado (HTTP ${resposta.status}).`); }
            if (!resposta.ok) throw new Error(dados.erro || `Falha na conexão com o gateway (HTTP ${resposta.status}).`);
            if (dados.tipo !== 'MART_VENDEDORES_API' || dados.requestId !== requestId)
                throw new Error('O gateway não devolveu a confirmação esperada.');
            if (!dados.ok) throw new Error(dados.erro || 'A conta não foi autorizada pelo Apps Script.');
            return dados;
        } catch (erro) {
            if (erro.name === 'AbortError') throw new Error('O gateway demorou para responder. A operação pode ter sido processada; confira a planilha antes de tentar novamente.');
            if (erro instanceof TypeError) throw new Error('Não foi possível alcançar o gateway HTTPS. Confira sua URL e a implantação do Worker.');
            throw erro;
        } finally { clearTimeout(timer); }
    },

    async _post(action, payload = {}) {
        // O gateway é optativo. Sem ele, mantemos a comunicação anterior do desktop.
        if (this.obterProxy()) return this._postProxy(action, payload);

        if (!this.apiUrl) this.configurar(this.obterUrl());
        const firebaseIdToken = await Auth.idToken();
        return new Promise((resolve, reject) => {
            const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
            const iframe = document.createElement('iframe');
            const form = document.createElement('form');
            const frameName = `martApiFrame_${requestId.replace(/[^a-zA-Z0-9_]/g, '')}`;
            let encerrado = false;
            iframe.name = frameName;
            iframe.style.display = 'none';
            iframe.setAttribute('aria-hidden', 'true');
            form.method = 'POST';
            form.action = this.apiUrl;
            form.target = frameName;
            form.enctype = 'application/x-www-form-urlencoded';
            form.style.display = 'none';

            const campos = {
                action,
                firebaseIdToken,
                requestId,
                parentOrigin: window.location.origin,
                payload: JSON.stringify(payload || {})
            };
            Object.entries(campos).forEach(([name, value]) => {
                const input = document.createElement('input');
                input.type = 'hidden';
                input.name = name;
                input.value = String(value);
                form.appendChild(input);
            });

            const limpar = () => {
                window.removeEventListener('message', aoReceber);
                clearTimeout(timer);
                form.remove();
                iframe.remove();
            };
            const finalizar = (erro, valor) => {
                if (encerrado) return;
                encerrado = true;
                limpar();
                erro ? reject(erro) : resolve(valor);
            };
            const aoReceber = event => {
                // Apps Script HtmlService executa o HTML em iframes internos.
                // Por isso, event.source pode ser um quadro interno, não o iframe externo do formulário.
                // A origem Google permitida + requestId aleatório identificam a resposta desta solicitação.
                let host = '';
                try { host = new URL(event.origin).hostname.toLowerCase(); } catch (_) { return; }
                const origemGoogle = host === 'script.google.com' || host.endsWith('.googleusercontent.com');
                if (!origemGoogle) return;
                const data = event.data;
                if (!data || data.tipo !== 'MART_VENDEDORES_API' || data.requestId !== requestId) return;
                if (data.ok) finalizar(null, data);
                else finalizar(new Error(data.erro || 'O Apps Script não conseguiu concluir a operação.'));
            };
            // A importação pode atualizar centenas de linhas e o mapa de filiais.
            // Damos mais tempo a ela sem alterar o prazo normal das consultas.
            const prazoMs = ['importarFuncionarios','importarWhatsApp','normalizarWhatsApp','verificarLinks'].includes(action) ? 120000 : 30000;
            const timer = setTimeout(() => finalizar(
                new Error('A API não respondeu ao formulário incorporado. Se o login Google funcionou, seu navegador pode estar bloqueando o iframe do Apps Script. No celular, configure o gateway HTTPS indicado nas instruções; no computador, confirme a implantação e o endereço da API.')
            ), prazoMs);
            window.addEventListener('message', aoReceber);
            document.body.appendChild(iframe);
            document.body.appendChild(form);
            form.submit();
        });
    },

    async testarConexao(apiUrl) {
        this.configurar(apiUrl);
        const resposta = await this._post('listarVendedores', { apenasResumo: true });
        return resposta.resultado ? { ...(resposta.resultado.resumo || {}), email: resposta.resultado.email || '', proprietario: resposta.resultado.proprietario === true } : {};
    },

    async carregarVendedores(apiUrl) {
        this.configurar(apiUrl);
        const resposta = await this._post('listarVendedores', {});
        const linhas = resposta.resultado?.linhas;
        if (!Array.isArray(linhas)) throw new Error('O Apps Script não retornou a lista de vendedores.');
        return { linhas, filiais: Array.isArray(resposta.resultado?.filiais) ? resposta.resultado.filiais : [] };
    },

    async consultarEventosPortal(periodo = '30') {
        const resposta = await this._post('listarEventosPortal', { periodo: String(periodo) });
        const dados = resposta.resultado || {};
        return {
            eventos: Array.isArray(dados.eventos) ? dados.eventos : [],
            truncado: dados.truncado === true,
            totalLinhas: Number(dados.totalLinhas || 0)
        };
    },

    async listarSolicitacoesTelefone() {
        const r=await this._post('listarSolicitacoesTelefone');
        return Array.isArray(r.resultado?.pedidos)?r.resultado.pedidos:[];
    },

    async listarLinks() {
        const resposta = await this._post('listarVerificacoesLinks');
        return resposta.resultado || { resultados: [] };
    },

    async listarCampanhas() {
        const r=await this._post('listarCampanhas');
        return r.resultado || {campanhaGeral:'',linkGrupo:'https://www.martinello.com.br/ofertasvendedor',revision:''};
    },

    async salvarCampanhas(campanhaGeral,linkGrupo,revision) {
        const r=await this._post('salvarCampanhas',{campanhaGeral,linkGrupo,revision});
        return r.resultado || {};
    },

    async listarConfigContatos() {
        const r = await this._post('listarConfigContatos');
        return r.resultado || {};
    },

    async salvarConfigContatos(linkGrupo, mensagemConvite) {
        const r = await this._post('salvarConfigContatos', {linkGrupo, mensagemConvite});
        return r.resultado || {};
    },

    async listarContatosRecentes() {
        const resposta = await this._post('listarContatosRecentes');
        return resposta.resultado || { contatos: [] };
    },

    async registrarContatoRealizado(matricula, ofertaId) {
        const resposta = await this._post('registrarContatoRealizado', { matricula, ofertaId });
        return resposta.resultado || {};
    },

    async verificarLinks(matriculas) {
        const ids = [...new Set((matriculas || []).map(v => String(v || '').replace(/\D/g, '')).filter(Boolean))];
        if (!ids.length) return { resultados: [] };
        if (ids.length > 30) throw new Error('O verificador aceita até 30 matrículas por lote.');
        const resposta = await this._post('verificarLinks', { matriculas: ids });
        return resposta.resultado || { resultados: [] };
    },

    async salvarVendedor(apiUrl, _naoUsado, dados) {
        this.configurar(apiUrl);
        return this._post('salvarVendedor', dados);
    },

    async criarVendedor(apiUrl, _naoUsado, dados) {
        this.configurar(apiUrl);
        return this._post('criarVendedor', dados);
    },

    async importarFuncionarios(registros, inativarAusentes, nomeArquivo, filiais = []) {
        if (!Array.isArray(registros) || !registros.length) throw new Error('Nenhum vendedor válido foi encontrado no relatório.');
        if (registros.length > 2500) throw new Error('O relatório excede o limite de 2.500 registros por importação.');
        return this._post('importarFuncionarios', {
            registros,
            filiais,
            inativarAusentes: inativarAusentes === true,
            nomeArquivo: String(nomeArquivo || '').slice(0, 160)
        });
    },


    async listarWhatsApp() {
        const r = await this._post('listarWhatsApp');
        return r.resultado || { participantes: [], identificacoes: [] };
    },
    async lerParametrosWhatsApp() {
        const r = await this._post('lerParametrosWhatsApp');
        return r.resultado || { registros: [], descartadas: 0 };
    },
    async importarWhatsApp(dados) {
        const r = await this._post('importarWhatsApp', dados);
        return r.resultado || {};
    },
    async normalizarWhatsApp(dados) {
        const r = await this._post('normalizarWhatsApp', dados);
        return r.resultado || {};
    },
    async salvarIdentificacaoWhatsApp(dados) {
        const r = await this._post('salvarIdentificacaoWhatsApp', dados);
        return r.resultado || {};
    },

    async listarAdministradores() {
        const r = await this._post('listarAdministradores');
        return r.resultado || { administradores: [] };
    },

    async adicionarAdministrador(email) {
        const r = await this._post('adicionarAdministrador', { email });
        return r.resultado || {};
    },

    async removerAdministrador(email) {
        const r = await this._post('removerAdministrador', { email });
        return r.resultado || {};
    },

    limparSessao() {
        this.apiUrl = '';
    }
};
