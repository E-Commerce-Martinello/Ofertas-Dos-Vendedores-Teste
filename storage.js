// ============================================
// storage.js - GERENCIAMENTO DO LOCALSTORAGE
// ============================================

// Salvar ofertas no localStorage
function salvarOfertas(ofertas) {
    try {
        localStorage.setItem('ofertasMartinello', JSON.stringify(ofertas));
        console.log('✅ Ofertas salvas:', ofertas.length);
        return true;
    } catch (e) {
        console.error('❌ Erro ao salvar ofertas:', e);
        return false;
    }
}

// Carregar ofertas do localStorage
function carregarOfertas() {
    try {
        const ofertas = JSON.parse(localStorage.getItem('ofertasMartinello') || '[]');
        console.log('✅ Ofertas carregadas:', ofertas.length);
        return ofertas;
    } catch (e) {
        console.error('❌ Erro ao carregar ofertas:', e);
        return [];
    }
}

// Atualizar oferta ativa baseado no horário atual
function atualizarOfertaAtiva(ofertas) {
    try {
        const agora = getHorarioBrasilia();
        let ofertaAtiva = null;
        
        for (const oferta of ofertas) {
            const inicio = new Date(oferta.dataInicio);
            const fim = new Date(oferta.dataFim);
            
            if (agora >= inicio && agora <= fim) {
                ofertaAtiva = oferta;
                break;
            }
        }
        
        if (ofertaAtiva) {
            localStorage.setItem('ofertaAtiva', JSON.stringify(ofertaAtiva));
            localStorage.setItem('modoExpirado', 'false');
            console.log('✅ Oferta ativa:', ofertaAtiva.tituloPagina);
        } else {
            localStorage.removeItem('ofertaAtiva');
            localStorage.setItem('modoExpirado', 'true');
            console.log('⏸️ Nenhuma oferta ativa no momento');
        }
        
        return ofertaAtiva;
    } catch (e) {
        console.error('❌ Erro ao atualizar oferta ativa:', e);
        return null;
    }
}

// Limpar tudo (útil para testes)
function limparStorage() {
    if (confirm('Limpar todas as ofertas?')) {
        localStorage.removeItem('ofertasMartinello');
        localStorage.removeItem('ofertaAtiva');
        localStorage.removeItem('modoExpirado');
        localStorage.removeItem('configTelaEmBreve');
        console.log('🧹 Storage limpo!');
        location.reload();
    }
}
