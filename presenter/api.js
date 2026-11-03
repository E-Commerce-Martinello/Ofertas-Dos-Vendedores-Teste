// ============================================
// presenter/api.js — REQUISIÇÕES EXTERNAS
// ============================================

const API = {

    async rastrear(codigo, navegador) {
        try {
            const fd = new FormData();
            fd.append(CONFIG.entryIdCodigo,  codigo);
            fd.append(CONFIG.entryIdBrowser, navegador);
            const ctrl = new AbortController();
            const to   = setTimeout(() => ctrl.abort(), CONFIG.rastreioTimeout);
            await fetch(CONFIG.googleFormUrl, { method: 'POST', mode: 'no-cors', body: fd, signal: ctrl.signal });
            clearTimeout(to);
        } catch { /* rastreio é best-effort */ }
    },

    async compartilhar(texto, imagemUrl) {
        // Tentar Web Share API com imagem
        try {
            let file = null;

            if (imagemUrl && imagemUrl.startsWith('data:')) {
                // Base64 — converter para Blob sem fetch() (fetch de data: falha no GitHub Pages)
                const partes = imagemUrl.split(',');
                const mime   = partes[0].match(/:(.*?);/)[1];
                const bytes  = atob(partes[1]);
                const arr    = new Uint8Array(bytes.length);
                for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
                file = new File([arr], 'oferta.png', { type: mime });

            } else if (imagemUrl && imagemUrl.startsWith('http')) {
                // URL normal — fetch padrão
                const res  = await fetch(imagemUrl);
                const blob = await res.blob();
                file = new File([blob], 'oferta.png', { type: blob.type });
            }
            // Se urlImagem vazia ou inválida, compartilha só o texto

            if (file && navigator.share && navigator.canShare?.({ files: [file] })) {
                await navigator.share({ files: [file], text: texto });
                return { metodo: 'share-com-imagem' };
            }

            if (navigator.share) {
                await navigator.share({ text: texto });
                return { metodo: 'share-sem-imagem' };
            }
        } catch (e) {
            console.warn('⚠️ Web Share falhou:', e.message, '— abrindo WhatsApp');
        }

        // Fallback universal
        window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
        return { metodo: 'whatsapp' };
    },
};
