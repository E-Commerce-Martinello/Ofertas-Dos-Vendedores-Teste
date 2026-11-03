// ============================================
// model/link-checker.js
// O verificador utiliza a mesma API privada de vendedores via POST.
// ============================================
const LinkCheckerService = {
    verificar(endpoint, matriculas, apiToken) {
        try {
            GoogleSheetsService.configurar(endpoint, apiToken);
        } catch (erro) {
            return Promise.reject(erro);
        }
        return GoogleSheetsService.verificarLinks(matriculas);
    }
};
