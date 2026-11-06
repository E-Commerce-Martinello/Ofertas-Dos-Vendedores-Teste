// Login Google com sessão preservada nas atualizações da página e encerrada ao fechar o navegador; autorização continua no Apps Script.
// A autorização é validada NOVAMENTE pelo Apps Script no servidor.
const Auth = {
    async iniciar() {
        if (!firebase.auth) throw new Error('Firebase Authentication não carregou.');
        await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.SESSION);
        return await new Promise((resolve, reject) => {
            let cancelar = () => {};
            cancelar = firebase.auth().onAuthStateChanged(usuario => {
                cancelar(); resolve(usuario);
            }, erro => { cancelar(); reject(erro); });
        });
    },

    usuarioAtual() { return firebase.auth().currentUser; },

    async entrarGoogle() {
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        const resultado = await firebase.auth().signInWithPopup(provider);
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
