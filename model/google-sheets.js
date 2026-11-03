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
            const prazoMs = action === 'importarFuncionarios' ? 120000 : 30000;
            const timer = setTimeout(() => finalizar(
                new Error('A API não devolveu a confirmação. Verifique se a implantação atualizada do Apps Script está publicada e se a origem do site de teste está autorizada. A autorização em uma aba separada, sozinha, não testa a resposta POST.')
            ), prazoMs);
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
        return { linhas, filiais: Array.isArray(resposta.resultado?.filiais) ? resposta.resultado.filiais : [] };
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

    limparSessao() {
        this.apiUrl = '';
        this.apiToken = '';
    }
};
