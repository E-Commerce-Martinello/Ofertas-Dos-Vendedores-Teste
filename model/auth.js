// ============================================
// model/auth.js — AUTENTICAÇÃO DO ADMIN
// Hash SHA-256 + bloqueio por tentativas + sessão com expiração
// ============================================

// Hash SHA-256 da senha "777"
// Para trocar a senha: gere o novo hash em: https://emn178.github.io/online-tools/sha256.html
// e substitua a constante abaixo.
const SENHA_HASH = 'eaf89db7108470dc3f6b23ea90618264b3e8f8b6145371667c4055e9c5ce9f52';

const Auth = {

    // ----- TENTATIVAS -----

    _tentativas() {
        try { return JSON.parse(sessionStorage.getItem('adminTentativas') || '{"count":0,"desde":0}'); }
        catch { return { count: 0, desde: 0 }; }
    },

    _salvarTentativas(obj) {
        sessionStorage.setItem('adminTentativas', JSON.stringify(obj));
    },

    estaBloqueado() {
        const t = this._tentativas();
        if (t.count < CONFIG.MAX_TENTATIVAS) return false;
        if (Date.now() - t.desde < CONFIG.BLOQUEIO_MS) return true;
        // Desbloqueado — resetar
        this._salvarTentativas({ count: 0, desde: 0 });
        return false;
    },

    tempoRestanteBloqueio() {
        const t = this._tentativas();
        const resto = CONFIG.BLOQUEIO_MS - (Date.now() - t.desde);
        return Math.max(0, Math.ceil(resto / 1000));
    },

    _registrarFalha() {
        const t = this._tentativas();
        t.count++;
        if (t.count === CONFIG.MAX_TENTATIVAS) t.desde = Date.now();
        this._salvarTentativas(t);
    },

    _resetarTentativas() {
        this._salvarTentativas({ count: 0, desde: 0 });
    },

    // ----- SESSÃO -----

    async verificarSenha(senhaDigitada) {
        if (this.estaBloqueado()) return { ok: false, bloqueado: true };
        const hash = await sha256(senhaDigitada);
        if (hash === SENHA_HASH) {
            this._resetarTentativas();
            const sessao = { inicio: Date.now() };
            sessionStorage.setItem(CONFIG.SESSION_KEY, JSON.stringify(sessao));
            return { ok: true };
        }
        this._registrarFalha();
        const t = this._tentativas();
        const restantes = CONFIG.MAX_TENTATIVAS - t.count;
        return { ok: false, bloqueado: false, restantes: Math.max(0, restantes) };
    },

    sessaoValida() {
        try {
            const raw = sessionStorage.getItem(CONFIG.SESSION_KEY);
            if (!raw) return false;
            const s = JSON.parse(raw);
            if (Date.now() - s.inicio > CONFIG.SESSAO_EXPIRA_MS) {
                sessionStorage.removeItem(CONFIG.SESSION_KEY);
                return false;
            }
            return true;
        } catch { return false; }
    },

    logout() {
        sessionStorage.removeItem(CONFIG.SESSION_KEY);
    },
};
