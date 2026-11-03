// ============================================
// model/google-sheets.js
// Leitura privada da planilha via Google OAuth + Sheets API.
// Nenhum dado de vendedor é gravado no Firebase ou enviado para outro serviço.
// ============================================

const GoogleSheetsService = {
    SCOPE: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    accessToken: null,
    tokenExpiraEm: 0,
    tokenClient: null,
    scriptPromise: null,

    extrairSpreadsheetId(valor) {
        const texto = String(valor || '').trim();
        const match = texto.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
        return match ? match[1] : texto;
    },

    _carregarGoogleIdentity() {
        if (window.google?.accounts?.oauth2) return Promise.resolve();
        if (this.scriptPromise) return this.scriptPromise;

        this.scriptPromise = new Promise((resolve, reject) => {
            let script = document.getElementById('googleIdentityServices');
            if (!script) {
                script = document.createElement('script');
                script.id = 'googleIdentityServices';
                script.src = 'https://accounts.google.com/gsi/client';
                script.async = true;
                script.defer = true;
                document.head.appendChild(script);
            }
            script.addEventListener('load', resolve, { once: true });
            script.addEventListener('error', () => reject(new Error('Não foi possível carregar o serviço de login do Google.')), { once: true });
            // Se o script já terminou de carregar entre a checagem e os listeners.
            if (window.google?.accounts?.oauth2) resolve();
        });
        return this.scriptPromise;
    },

    _obterToken(clientId) {
        // Quando a biblioteca já está carregada, solicita o token imediatamente no clique do usuário,
        // preservando a permissão do navegador para abrir a janela OAuth.
        if (window.google?.accounts?.oauth2) return this._solicitarToken(clientId);
        return this._carregarGoogleIdentity().then(() => this._solicitarToken(clientId));
    },

    _solicitarToken(clientId) {
        if (this.accessToken && Date.now() < this.tokenExpiraEm - 60000) {
            return Promise.resolve(this.accessToken);
        }

        return new Promise((resolve, reject) => {
            let timeout = setTimeout(() => reject(new Error('A janela de autorização não foi concluída. Clique em conectar e tente novamente.')), 45000);
            const finalizar = callback => valor => { clearTimeout(timeout); callback(valor); };
            this.tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: clientId,
                scope: this.SCOPE,
                callback: finalizar((resposta) => {
                    if (resposta.error || !resposta.access_token) {
                        reject(new Error(resposta.error_description || resposta.error || 'O Google não autorizou o acesso à planilha.'));
                        return;
                    }
                    this.accessToken = resposta.access_token;
                    this.tokenExpiraEm = Date.now() + (Number(resposta.expires_in || 3600) * 1000);
                    resolve(this.accessToken);
                }),
                error_callback: finalizar((erro) => reject(new Error(erro?.message || 'Não foi possível abrir a janela de autorização do Google.')))
            });
            // Sem prompt=consent: o Google pede autorização na primeira vez e reutiliza a concessão existente depois.
            this.tokenClient.requestAccessToken({ prompt: '' });
        });
    },

    async carregarBancoDeDados(clientId, spreadsheetId) {
        const token = await this._obterToken(clientId);
        // A base atual tem cerca de 750 vendedores; a margem até a linha 5.000 permite crescimento sem baixar dezenas de milhares de linhas de fórmulas vazias.
        const intervalo = encodeURIComponent("'Banco de Dados'!A1:J5000");
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${intervalo}?valueRenderOption=FORMATTED_VALUE`;
        const resposta = await fetch(url, {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` }
        });

        const dados = await resposta.json().catch(() => ({}));
        if (!resposta.ok) {
            if (resposta.status === 401) {
                this.limparSessao();
                throw new Error('Sua autorização do Google expirou. Clique em CONECTAR E CARREGAR novamente.');
            }
            const detalhe = dados?.error?.message || `Erro HTTP ${resposta.status}`;
            if (resposta.status === 403) {
                throw new Error(`Acesso negado pelo Google. Confira se a conta conectada tem acesso à planilha e se a Google Sheets API está ativada. (${detalhe})`);
            }
            if (resposta.status === 404) {
                throw new Error('Planilha não encontrada. Confira o link/ID informado e se a aba “Banco de Dados” existe.');
            }
            throw new Error(`Falha ao consultar a planilha: ${detalhe}`);
        }
        return Array.isArray(dados.values) ? dados.values : [];
    },

    async carregarParametros(clientId, spreadsheetId) {
        const token = await this._obterToken(clientId);
        // A aba contém os participantes (A:C) e a relação de funcionários ativos (F:H).
        const intervalo = encodeURIComponent("'Parâmetros de Dados'!A1:H1500");
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${intervalo}?valueRenderOption=FORMATTED_VALUE`;
        const resposta = await fetch(url, {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` }
        });
        const dados = await resposta.json().catch(() => ({}));
        if (!resposta.ok) {
            const detalhe = dados?.error?.message || `Erro HTTP ${resposta.status}`;
            throw new Error(`Não foi possível consultar a aba Parâmetros de Dados: ${detalhe}`);
        }
        return Array.isArray(dados.values) ? dados.values : [];
    },

    limparSessao() {
        this.accessToken = null;
        this.tokenExpiraEm = 0;
        this.tokenClient = null;
    }
};
