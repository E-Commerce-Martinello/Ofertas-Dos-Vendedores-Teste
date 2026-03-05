// ============================================
// storage.js - VERSÃO UNIFICADA (FIREBASE + LOCAL)
// ============================================

// 1. CARREGAR OFERTAS
async function carregarOfertas() {
    try {
        console.log('📡 Buscando ofertas no Firebase...');
        // Verifica se o Firebase e a variável ofertasRef (do firebase-config.js) existem
        if (typeof ofertasRef !== 'undefined') {
            const snapshot = await ofertasRef.once('value');
            const ofertas = snapshot.val() || [];
            
            // Sincroniza o local com o que veio da nuvem
            localStorage.setItem('ofertasMartinello', JSON.stringify(ofertas));
            console.log('✅ Sincronizado com Firebase:', ofertas.length);
            return ofertas;
        } else {
            throw new Error('ofertasRef não definida');
        }
    } catch (e) {
        console.warn('⚠️ Usando reserva local (Firebase offline):', e.message);
        return JSON.parse(localStorage.getItem('ofertasMartinello') || '[]');
    }
}

// 2. SALVAR OFERTAS
async function salvarOfertas(novasOfertas) {
    try {
        // Salva no LocalStorage primeiro (garantia rápida)
        localStorage.setItem('ofertasMartinello', JSON.stringify(novasOfertas));

        // Envia para o Firebase
        if (typeof ofertasRef !== 'undefined') {
            await ofertasRef.set(novasOfertas);
            console.log('🚀 Enviado para a nuvem com sucesso!');
            
            if (typeof NOTIFICACAO !== 'undefined') {
                NOTIFICACAO.sucesso('Sincronizado na nuvem!');
            }
            return true;
        } else {
            throw new Error('Configuração do Firebase ausente');
        }
    } catch (e) {
        console.error('❌ Erro ao salvar na nuvem:', e);
        if (typeof NOTIFICACAO !== 'undefined') {
            NOTIFICACAO.erro('Salvo apenas neste aparelho!');
        }
        return false;
    }
}

// 3. ATUALIZAR STATUS (OFERTA ATIVA)
// Esta função roda no celular do vendedor para saber qual oferta mostrar agora
function atualizarOfertaAtiva(ofertas) {
    try {
        const agora = (typeof getHorarioBrasilia === 'function') ? getHorarioBrasilia() : new Date();
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
        } else {
            localStorage.removeItem('ofertaAtiva');
            localStorage.setItem('modoExpirado', 'true');
        }
        
        return ofertaAtiva;
    } catch (e) {
        console.error('❌ Erro no cálculo de horário:', e);
        return null;
    }
}
