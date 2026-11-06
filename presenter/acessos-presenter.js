// Administração de acessos — controles não expõem a URL de serviço ou tokens.
const GerenciarAcessosPresenter = {
    carregando: false,

    _status(mensagem, erro = false) {
        const el = document.getElementById('statusAcessos');
        if (!el) return;
        el.textContent = mensagem;
        el.className = 'vendor-status' + (erro ? ' error' : '');
    },

    _escapar(valor) {
        return String(valor || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    },

    async carregar() {
        if (this.carregando) return;
        this.carregando = true;
        this._status('Consultando administradores...');
        try {
            const { administradores } = await GoogleSheetsService.listarAdministradores();
            const tbody = document.getElementById('listaAdministradores');
            tbody.innerHTML = (administradores || []).map(a => `
                <tr><td class="admin-email">${this._escapar(a.email)}</td>
                <td><span class="vendor-badge ${a.proprietario ? 'in' : 'unknown'}">${a.proprietario ? 'Principal' : 'Administrador'}</span></td>
                <td>${a.proprietario ? '—' : `<button class="admin-remover" type="button" data-email="${this._escapar(a.email)}">Remover</button>`}</td></tr>`).join('') || '<tr><td colspan="3">Nenhum administrador.</td></tr>';
            tbody.querySelectorAll('button[data-email]').forEach(btn => btn.addEventListener('click', () => this.remover(btn.dataset.email)));
            this._status(`${(administradores || []).length} acesso(s) autorizado(s).`);
        } catch (erro) {
            this._status(erro.message || 'Não foi possível carregar os acessos.', true);
        } finally { this.carregando = false; }
    },

    async adicionar() {
        const campo = document.getElementById('novoEmailAdmin');
        const email = (campo.value || '').trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { this._status('Informe um e-mail válido.', true); return; }
        const btn = document.getElementById('btnAdicionarAdmin');
        btn.disabled = true;
        try {
            await GoogleSheetsService.adicionarAdministrador(email);
            campo.value = '';
            await this.carregar();
            UI.ok('Administrador autorizado. A permissão foi registrada; o acesso continuará sujeito à validação da API deste ambiente.');
        } catch (erro) { this._status(erro.message, true); }
        finally { btn.disabled = false; }
    },

    async remover(email) {
        if (!confirm(`Remover o acesso administrativo de ${email}?`)) return;
        try {
            await GoogleSheetsService.removerAdministrador(email);
            await this.carregar();
            UI.ok('Acesso removido.');
        } catch (erro) { this._status(erro.message, true); }
    }
};
