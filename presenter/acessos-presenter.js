// Administração de acessos — controles não expõem a URL de serviço ou tokens.
const GerenciarAcessosPresenter = {
    carregando: false,
    administradores: [],

    _status(mensagem, erro = false) {
        const el = document.getElementById('statusAcessos');
        if (!el) return;
        el.textContent = mensagem;
        el.className = 'vendor-status' + (erro ? ' error' : '');
    },

    _escapar(valor) {
        return String(valor || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    },

    async carregar(force=false) {
        if (this.carregando && !force) return;
        this.carregando = true;
        this._status('Consultando administradores...');
        try {
            const { administradores } = await GoogleSheetsService.listarAdministradores();
            this.administradores = administradores || [];
            const tbody = document.getElementById('listaAdministradores');
            const markup = await Promise.all(this.administradores.map(async a => {
                let aprovado = !!a.proprietario;
                if (a.uid && !a.proprietario) {
                    try { aprovado = (await database.ref('adminUids_TESTE/' + a.uid).once('value')).val() === true; }
                    catch (e) { aprovado = false; }
                }
                const tipo = a.proprietario ? 'Principal' : (aprovado ? 'Acesso completo' : a.uid ? 'Ofertas pendentes' : 'Primeiro login pendente');
                return `<tr><td class="admin-email">${this._escapar(a.email)}</td>
                    <td><span class="vendor-badge ${aprovado ? 'in' : 'unknown'}">${tipo}</span></td>
                    <td>${a.proprietario ? '—' : `<div class="acessos-acoes">${!aprovado && a.uid ? `<button type="button" class="admin-liberar" data-aprovar="${this._escapar(a.email)}">Liberar ofertas</button>` : ''}
                    <button class="admin-remover" type="button" data-email="${this._escapar(a.email)}">Remover</button></div>`}</td></tr>`;
            }));
            tbody.innerHTML = markup.join('') || '<tr><td colspan="3">Nenhum administrador.</td></tr>';
            tbody.querySelectorAll('button[data-email]').forEach(btn => btn.addEventListener('click', () => this.remover(btn.dataset.email)));
            tbody.querySelectorAll('button[data-aprovar]').forEach(btn => btn.addEventListener('click', () => this.aprovar(btn.dataset.aprovar)));
            this._status(`${this.administradores.length} conta(s) autorizada(s). Novas contas devem entrar uma vez antes de liberar a edição das ofertas.`);
        } catch (erro) { this._status(erro.message || 'Não foi possível carregar os acessos.', true); }
        finally { this.carregando = false; }
    },

    async aprovar(email) {
        const dado = this.administradores.find(a => a.email === email && !a.proprietario);
        if (!dado || !/^[a-zA-Z0-9_-]{6,128}$/.test(dado.uid || '')) {
            this._status('Peça ao administrador que entre no painel uma vez. Depois atualize a lista.', true); return;
        }
        if (!confirm(`Liberar acesso às ofertas do Firebase para ${email}?`)) return;
        try {
            // Confere novamente o vínculo e-mail/UID no Apps Script antes de aprovar.
            const atual = (await GoogleSheetsService.listarAdministradores()).administradores || [];
            if (!atual.some(a => a.email === email && a.uid === dado.uid && !a.proprietario)) throw new Error('Identificação do administrador mudou. Atualize a lista.');
            await database.ref('adminUids_TESTE/' + dado.uid).set(true);
            await this.carregar(true);
            UI.ok('Acesso às ofertas liberado. A outra conta pode atualizar o painel.');
        } catch (e) { this._status('Não foi possível liberar o Firebase: ' + (e.message || e), true); }
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
            await this.carregar(true);
            UI.ok('E-mail autorizado no Sheets. Peça à pessoa que faça seu primeiro login e depois libere o Firebase na aba Acessos.');
        } catch (erro) { this._status(erro.message, true); }
        finally { btn.disabled = false; }
    },

    async remover(email) {
        if (!confirm(`Remover o acesso administrativo de ${email}?`)) return;
        try {
            const dado = this.administradores.find(a => a.email === email && !a.proprietario);
            if (dado?.uid) {
                // Revogar primeiro no Firebase evita manter acesso às ofertas.
                await database.ref('adminUids_TESTE/' + dado.uid).remove();
            }
            await GoogleSheetsService.removerAdministrador(email);
            await this.carregar(true);
            UI.ok('Acesso revogado no Firebase e no Sheets.');
        } catch (erro) { this._status(erro.message, true); }
    }
};
