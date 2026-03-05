// ============================================
// cache.js - GERENCIAMENTO DE CACHE
// ============================================

const CACHE = {
    prefixo: 'martinello_',
    
    set(chave, valor, expiracao = null) {
        const item = {
            valor,
            timestamp: Date.now(),
            expiracao: expiracao ? Date.now() + expiracao : null
        };
        
        try {
            localStorage.setItem(this.prefixo + chave, JSON.stringify(item));
            return true;
        } catch (e) {
            console.error('Erro ao salvar cache:', e);
            return false;
        }
    },
    
    get(chave) {
        try {
            const itemStr = localStorage.getItem(this.prefixo + chave);
            if (!itemStr) return null;
            
            const item = JSON.parse(itemStr);
            
            if (item.expiracao && Date.now() > item.expiracao) {
                localStorage.removeItem(this.prefixo + chave);
                return null;
            }
            
            return item.valor;
        } catch (e) {
            return null;
        }
    },
    
    remove(chave) {
        localStorage.removeItem(this.prefixo + chave);
    },
    
    limpar() {
        Object.keys(localStorage).forEach(chave => {
            if (chave.startsWith(this.prefixo)) {
                localStorage.removeItem(chave);
            }
        });
    },
    
    // Cache específico para ofertas
    ofertas: {
        salvar(ofertas) {
            return CACHE.set('ofertas', ofertas);
        },
        
        carregar() {
            return CACHE.get('ofertas') || [];
        },
        
        salvarAtiva(oferta) {
            return CACHE.set('oferta_ativa', oferta);
        },
        
        carregarAtiva() {
            return CACHE.get('oferta_ativa');
        }
    }
};
