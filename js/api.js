// ============================================
// api.js - REQUISIÇÕES EXTERNAS
// ============================================

const API = {
    async rastrear(codigo, navegador) {
        try {
            const formData = new FormData();
            formData.append(CONFIG.entryIdCodigo, codigo);
            formData.append(CONFIG.entryIdBrowser, navegador);
            
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), CONFIG.rastreioTimeout);
            
            await fetch(CONFIG.googleFormUrl, {
                method: 'POST',
                mode: 'no-cors',
                body: formData,
                signal: controller.signal
            });
            
            clearTimeout(timeout);
            return { sucesso: true };
        } catch (error) {
            console.error('Erro no rastreio:', error);
            return { sucesso: false, erro: error };
        }
    },
    
    async compartilhar(texto, imagemUrl) {
        try {
            const response = await fetch(imagemUrl);
            const blob = await response.blob();
            const file = new File([blob], 'oferta.png', { type: 'image/png' });
            
            if (navigator.share && navigator.canShare?.({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    text: texto
                });
                return { sucesso: true, metodo: 'share' };
            }
            
            // Fallback para WhatsApp
            window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
            return { sucesso: true, metodo: 'whatsapp' };
            
        } catch (error) {
            console.error('Erro no compartilhamento:', error);
            
            // Último fallback
            window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
            return { sucesso: true, metodo: 'fallback' };
        }
    }
};
