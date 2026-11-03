// ============================================
// model/google-sheets.js
// Cliente da API privada do Apps Script vinculado à planilha de TESTE.
// Todas as operações usam POST com token no corpo (não na URL).
// ============================================
const GoogleSheetsService = {
    apiUrl: '',
    apiToken: '',

    configurar(apiUrl, apiToken) {
        const url = String(apiUrl || '').trim();
        const token = String(apiToken || '').trim();
        if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec(?:\?.*)?$/.test(url)) {
            throw new Error('Informe a URL /exec do Apps Script de gestão.');
        }
        if (token.length < 30) throw new Error('Informe o token privado gerado pelo Apps Script.');
        this.apiUrl = url.split('?')[0];
        this.apiToken = token;
    },

    _post(action, payload = {}) {
        if (!this.apiUrl || !this.apiToken) return Promise.reject(new Error('Conecte a API da planilha antes de continuar.'));
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
                apiToken: this.apiToken,
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
                if (event.source !== iframe.contentWindow) return;
                let host = '';
                try { host = new URL(event.origin).hostname.toLowerCase(); } catch (_) { return; }
                const origemGoogle = host === 'script.google.com' || host.endsWith('.googleusercontent.com');
                if (!origemGoogle) return;
                const data = event.data;
                if (!data || data.tipo !== 'MART_VENDEDORES_API' || data.requestId !== requestId) return;
                if (data.ok) finalizar(null, data);
                else finalizar(new Error(data.erro || 'O Apps Script não conseguiu concluir a operação.'));
            };
            const timer = setTimeout(() => finalizar(
                new Error('O Apps Script não confirmou a operação. Abra a URL /exec?action=autorizar em uma aba, autorize sua conta Google e tente novamente. Se já autorizou, confira se a implantação foi atualizada.')
            ), 60000);
            window.addEventListener('message', aoReceber);
            document.body.appendChild(iframe);
            document.body.appendChild(form);
            form.submit();
        });
    },

    async testarConexao(apiUrl, apiToken) {
        this.configurar(apiUrl, apiToken);
        const resposta = await this._post('listarVendedores', { apenasResumo: true });
        return resposta.resultado?.resumo || {};
    },

    async carregarVendedores(apiUrl, apiToken) {
        this.configurar(apiUrl, apiToken);
        const resposta = await this._post('listarVendedores', {});
        const linhas = resposta.resultado?.linhas;
        if (!Array.isArray(linhas)) throw new Error('O Apps Script não retornou a lista de vendedores.');
        return linhas;
    },

    async verificarLinks(matriculas) {
        const ids = [...new Set((matriculas || []).map(v => String(v || '').replace(/\D/g, '')).filter(Boolean))];
        if (!ids.length) return { resultados: [] };
        if (ids.length > 30) throw new Error('O verificador aceita até 30 matrículas por lote.');
        const resposta = await this._post('verificarLinks', { matriculas: ids });
        return resposta.resultado || { resultados: [] };
    },

    async salvarVendedor(apiUrl, apiToken, dados) {
        this.configurar(apiUrl, apiToken);
        return this._post('salvarVendedor', dados);
    },

    async criarVendedor(apiUrl, apiToken, dados) {
        this.configurar(apiUrl, apiToken);
        return this._post('criarVendedor', dados);
    },

    limparSessao() {
        this.apiUrl = '';
        this.apiToken = '';
    }
};
