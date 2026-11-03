// ============================================
// view/ui.js — COMPONENTES DE INTERFACE
// ============================================

const UI = {

    // ----- TEMA -----
    tema: {
        aplicar(t) {
            document.body.classList.toggle('dark-mode', t === 'dark');
            Storage.salvarTema(t);
            const ic = document.querySelector('.dark-mode-toggle i');
            if (ic) ic.className = t === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        },
        toggle() {
            const isDark = document.body.classList.contains('dark-mode');
            this.aplicar(isDark ? 'light' : 'dark');
        },
    },

    // ----- NOTIFICAÇÕES -----
    notificar(msg, tipo = 'sucesso', ms = 3000) {
        const div = document.createElement('div');
        div.className = `notificacao notificacao-${tipo}`;
        div.innerHTML = `<span class="notif-icone">${tipo === 'sucesso' ? '✅' : '❌'}</span><span>${msg}</span>`;
        document.body.appendChild(div);
        setTimeout(() => {
            div.classList.add('notificacao-saindo');
            setTimeout(() => div.remove(), 300);
        }, ms);
    },
    ok(msg)   { this.notificar(msg, 'sucesso'); },
    erro(msg) { this.notificar(msg, 'erro'); },

    // ----- IMAGEM -----

    // Comprime e redimensiona imagem antes de converter para base64
    // Resolve o problema de imagens grandes serem rejeitadas pelo Firebase
    async paraBase64(file, maxPx = 1200, qualidade = 0.92) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(file);

            img.onload = () => {
                URL.revokeObjectURL(url);

                // Calcular novas dimensões mantendo proporção
                let { width, height } = img;
                if (width > maxPx || height > maxPx) {
                    if (width > height) {
                        height = Math.round(height * maxPx / width);
                        width  = maxPx;
                    } else {
                        width  = Math.round(width * maxPx / height);
                        height = maxPx;
                    }
                }

                // Desenhar no canvas com novo tamanho
                const canvas = document.createElement('canvas');
                canvas.width  = width;
                canvas.height = height;
                canvas.getContext('2d').drawImage(img, 0, 0, width, height);

                const base64 = canvas.toDataURL('image/jpeg', qualidade);
                const kbOriginal = Math.round(file.size / 1024);
                const kbFinal    = Math.round(base64.length * 0.75 / 1024);
                console.log(`🖼️ Imagem: ${kbOriginal}KB original → ${kbFinal}KB comprimida (${width}×${height}px)`);

                resolve(base64);
            };

            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('Falha ao carregar imagem'));
            };

            img.src = url;
        });
    },

    imagemFallback(imgEl, fallback) {
        imgEl.onerror = () => { imgEl.src = fallback; imgEl.onerror = null; };
        if (imgEl.complete && imgEl.naturalHeight === 0) imgEl.src = fallback;
    },
};

// Alias global
const TEMA = UI.tema;
