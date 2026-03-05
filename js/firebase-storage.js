// ============================================
// firebase-storage.js - FUNÇÕES DE STORAGE NO FIREBASE
// ============================================

// ============================================
// CARREGAR OFERTAS DO FIREBASE
// ============================================
async function carregarOfertasFirebase() {
    try {
        console.log('📥 Carregando ofertas do Firebase...');
        
        const snapshot = await ofertasRef.once('value');
        const ofertas = snapshot.val() || [];
        
        console.log(`✅ ${ofertas.length} ofertas carregadas`);
        
        localStorage.setItem('ofertasMartinello', JSON.stringify(ofertas));
        return ofertas;
    } catch (error) {
        console.error('❌ Erro ao carregar do Firebase:', error);
        return JSON.parse(localStorage.getItem('ofertasMartinello') || '[]');
    }
}

// ============================================
// SALVAR OFERTAS NO FIREBASE
// ============================================
async function salvarOfertasFirebase(ofertas) {
    try {
        console.log('📤 Salvando ofertas no Firebase...');
        
        await ofertasRef.set(ofertas);
        
        console.log('✅ Ofertas salvas no Firebase!');
        localStorage.setItem('ofertasMartinello', JSON.stringify(ofertas));
        
        if (typeof NOTIFICACAO !== 'undefined') {
            NOTIFICACAO.sucesso('Ofertas sincronizadas!');
        }
        
        return true;
    } catch (error) {
        console.error('❌ Erro ao salvar no Firebase:', error);
        localStorage.setItem('ofertasMartinello', JSON.stringify(ofertas));
        
        if (typeof NOTIFICACAO !== 'undefined') {
            NOTIFICACAO.erro('Erro ao sincronizar. Salvo apenas localmente.');
        }
        
        return false;
    }
}
