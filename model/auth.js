// Login Google com sessão preservada nas atualizações da página e encerrada ao fechar o navegador; autorização continua no Apps Script.
// A autorização é validada NOVAMENTE pelo Apps Script no servidor.
const Auth = {
    async iniciar() {
        if (!firebase.auth) throw new Error('Firebase Authentication não carregou.');
        await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.SESSION);
        // Conclui o retorno do login por redirecionamento, se foi necessário no celular.
        try { await firebase.auth().getRedirectResult(); }
        catch (erro) {
            const e = new Error('O retorno do login Google foi bloqueado pelo navegador. Abra o site no Chrome ou Safari (fora de apps como WhatsApp e Instagram). Detalhe: ' + (erro.code || erro.message));
            e.code = erro.code;
            throw e;
        }
        return await new Promise((resolve, reject) => {
            const remover = firebase.auth().onAuthStateChanged(usuario => {
                remover(); resolve(usuario);
            }, erro => { remover(); reject(erro); });
        });
    },

    usuarioAtual() { return firebase.auth().currentUser; },

    async entrarGoogle() {
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        let resultado;
        try {
            resultado = await firebase.auth().signInWithPopup(provider);
        } catch (erro) {
            // O popup pode ser bloqueado no celular. Tenta a navegação tradicional,
            // sem prometer compatibilidade com navegadores que bloqueiam cookies terceiros.
            if (erro?.code === 'auth/popup-blocked') {
                try {
                    await firebase.auth().signInWithRedirect(provider);
                    return null; // a página será recarregada ao voltar do Google
                } catch (e) { throw new Error('Pop-up e redirecionamento indisponíveis neste navegador: ' + (e.code || e.message)); }
            }
            const dicas = {
                'auth/popup-blocked': 'O navegador bloqueou a janela de login. Abra o site diretamente no Chrome ou Safari e permita pop-ups.',
                'auth/popup-closed-by-user': 'O login do Google foi fechado antes de terminar. Tente novamente.',
                'auth/unauthorized-domain': 'Este domínio ainda não está autorizado no Firebase Authentication.',
                'auth/operation-not-supported-in-this-environment': 'Este navegador interno não permite autenticação. Abra o site diretamente no Chrome ou Safari.',
                'auth/web-storage-unsupported': 'O navegador bloqueou o armazenamento da sessão. Tente no Chrome ou Safari fora do modo privado.',
                'auth/network-request-failed': 'Falha de conexão durante o login Google. Confira sua conexão e tente novamente.'
            };
            throw new Error(dicas[erro?.code] || ('Falha no login Google: ' + (erro?.message || 'tente abrir no Chrome ou Safari.')));
        }
        if (!resultado.user || !resultado.user.emailVerified) {
            await firebase.auth().signOut();
            throw new Error('É necessária uma conta Google com e-mail verificado.');
        }
        return resultado.user;
    },

    async idToken() {
        const usuario = this.usuarioAtual();
        if (!usuario) throw new Error('Entre com a conta Google autorizada para continuar.');
        // Firebase renova automaticamente o token quando necessário.
        return usuario.getIdToken();
    },

    async sair() { await firebase.auth().signOut(); }
};
