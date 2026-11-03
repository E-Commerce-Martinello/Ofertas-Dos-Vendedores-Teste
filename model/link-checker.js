// ============================================
// model/link-checker.js
// Consulta o verificador público criado em Google Apps Script via JSONP.
// ============================================
const LinkCheckerService = {
    verificar(endpoint, matriculas) {
        const url = String(endpoint || '').trim();
        if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec(?:\?.*)?$/.test(url)) {
            return Promise.reject(new Error('Cole a URL publicada do Apps Script (que termina em /exec).'));
        }
        const ids = [...new Set((matriculas || []).map(v => String(v || '').replace(/\D/g, '')).filter(Boolean))];
        if (!ids.length) return Promise.resolve({ resultados: [] });
        if (ids.length > 30) return Promise.reject(new Error('O verificador aceita até 30 matrículas por lote.'));

        return new Promise((resolve, reject) => {
            const callback = `martinelloLinkCheck_${Date.now()}_${Math.random().toString(36).slice(2)}`;
            const script = document.createElement('script');
            const base = url.split('?')[0];
            const params = new URLSearchParams({
                action: 'verificarLinks',
                ids: ids.join(','),
                callback
            });
            let encerrado = false;
            const finalizar = () => {
                if (encerrado) return;
                encerrado = true;
                clearTimeout(timer);
                script.remove();
                try { delete window[callback]; } catch (_) { window[callback] = undefined; }
            };
            const timer = setTimeout(() => {
                finalizar();
                reject(new Error('A verificação demorou demais. Confira se o Apps Script foi implantado como aplicativo da Web com acesso permitido.'));
            }, 60000);

            window[callback] = resposta => {
                finalizar();
                if (!resposta || resposta.ok !== true) {
                    reject(new Error(resposta?.erro || 'O verificador não retornou um resultado válido.'));
                    return;
                }
                resolve(resposta);
            };
            script.onerror = () => {
                finalizar();
                reject(new Error('Não foi possível acessar o Apps Script. Confira a URL /exec e as permissões da implantação.'));
            };
            script.src = `${base}?${params.toString()}`;
            document.head.appendChild(script);
        });
    }
};
