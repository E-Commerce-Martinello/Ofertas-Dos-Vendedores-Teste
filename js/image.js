// ============================================
// image.js - MANIPULAÇÃO DE IMAGENS
// ============================================

const IMAGEM = {
    async paraBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    },
    
    async carregar(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });
    },
    
    async redimensionar(file, maxWidth = 800, maxHeight = 800) {
        const img = await this.carregar(URL.createObjectURL(file));
        
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        if (width > height) {
            if (width > maxWidth) {
                height *= maxWidth / width;
                width = maxWidth;
            }
        } else {
            if (height > maxHeight) {
                width *= maxHeight / height;
                height = maxHeight;
            }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        return new Promise((resolve) => {
            canvas.toBlob((blob) => {
                resolve(new File([blob], file.name, { type: 'image/jpeg' }));
            }, 'image/jpeg', 0.9);
        });
    },
    
    verificarCarregamento(imgElement, fallbackSrc) {
        if (imgElement.complete && imgElement.naturalHeight > 0) return true;
        
        let tentativas = 0;
        const intervalo = setInterval(() => {
            tentativas++;
            if (imgElement.complete && imgElement.naturalHeight > 0) {
                clearInterval(intervalo);
                return true;
            } else if (tentativas > 10) {
                imgElement.src = fallbackSrc;
                clearInterval(intervalo);
                return false;
            }
        }, 500);
    }
};
