// ============================================
// model/vendor-management.js
// Complementos e identificações manuais do painel.
// A planilha oficial continua somente leitura; ajustes ficam no Firebase.
// ============================================
const VendorManagementService = {
    basePath: CONFIG.environment === 'TESTE' ? 'gestaoVendedores_TESTE' : 'gestaoVendedores',

    async carregar() {
        const snap = await database.ref(this.basePath).once('value');
        return snap.val() || {};
    },

    async salvarAjuste(matricula, dados) {
        const chave = String(matricula || '').replace(/\D/g, '');
        if (!chave) throw new Error('Matrícula inválida para salvar o ajuste.');
        await database.ref(`${this.basePath}/ajustes/m${chave}`).set({
            ...dados,
            atualizadoEm: new Date().toISOString()
        });
    },

    async removerAjuste(matricula) {
        const chave = String(matricula || '').replace(/\D/g, '');
        if (!chave) return;
        await database.ref(`${this.basePath}/ajustes/m${chave}`).remove();
    },

    async salvarComplemento(matricula, dados) {
        const chave = String(matricula || '').replace(/\D/g, '');
        if (!chave) throw new Error('Informe uma matrícula válida.');
        await database.ref(`${this.basePath}/complementos/m${chave}`).set({
            ...dados,
            matricula: chave,
            atualizadoEm: new Date().toISOString()
        });
    },

    async salvarIdentificacao(telefone, dados) {
        const chave = String(telefone || '').replace(/\D/g, '');
        if (!chave) throw new Error('Não foi possível identificar o telefone deste participante.');
        await database.ref(`${this.basePath}/participantes/p${chave}`).set({
            ...dados,
            telefoneDigitos: chave,
            atualizadoEm: new Date().toISOString()
        });
    },

    async salvarStatusLink(matricula, status) {
        const chave = String(matricula || '').replace(/\D/g, '');
        if (!chave) return;
        await database.ref(`${this.basePath}/links/m${chave}`).set({
            ...status,
            verificadoEm: new Date().toISOString()
        });
    }
};
