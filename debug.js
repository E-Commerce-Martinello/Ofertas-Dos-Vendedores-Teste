// ============================================
// debug.js - FUNÇÕES DE DIAGNÓSTICO
// ============================================

function diagnosticarCompleto(titulo = 'DIAGNÓSTICO') {
    console.log(`\n=== ${titulo} ===`);
    
    // 1. Verificar localStorage
    console.log('📦 LOCALSTORAGE:');
    for (let i = 0; i < localStorage.length; i++) {
        const chave = localStorage.key(i);
        const valor = localStorage.getItem(chave);
        console.log(`   - ${chave}:`, valor ? valor.substring(0, 80) + '...' : 'vazio');
    }
    
    // 2. Verificar horário
    try {
        const agora = getHorarioBrasilia();
        console.log('🕒 HORÁRIO:');
        console.log('   - Agora (UTC):', agora.toISOString());
        console.log('   - Agora (Brasília):', formatarBrasilia(agora.toISOString()));
    } catch (e) {
        console.log('   - Erro ao obter horário');
    }
    
    // 3. Verificar ofertas
    try {
        const ofertas = JSON.parse(localStorage.getItem('ofertasMartinello') || '[]');
        console.log('📋 OFERTAS CADASTRADAS:', ofertas.length);
        
        if (ofertas.length > 0) {
            ofertas.forEach((oferta, index) => {
                console.log(`   OFERTA ${index + 1}:`);
                console.log(`      - Título: ${oferta.tituloPagina}`);
                console.log(`      - Início: ${oferta.dataInicio} (${formatarBrasilia(oferta.dataInicio)})`);
                console.log(`      - Fim: ${oferta.dataFim} (${formatarBrasilia(oferta.dataFim)})`);
                console.log(`      - Ativa agora: ${isOfertaAtiva(oferta) ? '✅ SIM' : '❌ NÃO'}`);
            });
        }
    } catch (e) {
        console.log('   - Erro ao carregar ofertas');
    }
    
    // 4. Verificar oferta ativa
    try {
        const ofertaAtiva = JSON.parse(localStorage.getItem('ofertaAtiva'));
        const modoExpirado = localStorage.getItem('modoExpirado') === 'true';
        
        console.log('🔍 OFERTA ATIVA:');
        if (ofertaAtiva) {
            console.log(`   - Título: ${ofertaAtiva.tituloPagina}`);
            console.log(`   - Início: ${formatarBrasilia(ofertaAtiva.dataInicio)}`);
            console.log(`   - Fim: ${formatarBrasilia(ofertaAtiva.dataFim)}`);
            console.log(`   - modoExpirado: ${modoExpirado ? 'true' : 'false'}`);
        } else {
            console.log(`   - Nenhuma oferta ativa (modoExpirado: ${modoExpirado})`);
        }
    } catch (e) {
        console.log('   - Erro ao carregar oferta ativa');
    }
    
    console.log('=== FIM DO DIAGNÓSTICO ===\n');
}

// Função para corrigir ofertas (se necessário)
function corrigirOfertas() {
    try {
        const ofertas = JSON.parse(localStorage.getItem('ofertasMartinello') || '[]');
        if (ofertas.length === 0) return;
        
        console.log('🛠️ CORRIGINDO OFERTAS...');
        
        // Recalcular oferta ativa
        const ofertaAtiva = atualizarOfertaAtiva(ofertas);
        
        if (ofertaAtiva) {
            console.log('✅ Oferta ativa definida:', ofertaAtiva.tituloPagina);
        } else {
            console.log('⏸️ Nenhuma oferta ativa no momento');
        }
        
        diagnosticarCompleto('APÓS CORREÇÃO');
    } catch (e) {
        console.error('❌ Erro na correção:', e);
    }
}
