// ============================================
// admin-fix.js - CORREÇÕES PARA O ADMIN
// ============================================

// Sobrescrever a função de renderização para garantir que a oferta ativa seja atualizada
function renderizarListaComCorrecao() {
    // Carregar ofertas
    const ofertas = carregarOfertas();
    
    // ATUALIZAR OFERTA ATIVA ANTES DE RENDERIZAR
    atualizarOfertaAtiva(ofertas);
    
    // Chamar a renderização original
    if (typeof renderizarListaOfertasOriginal === 'function') {
        renderizarListaOfertasOriginal();
    }
}

// Aplicar correção no admin
function aplicarCorrecaoAdmin() {
    console.log('🛠️ Aplicando correções no admin...');
    
    // Guardar função original
    if (typeof renderizarListaOfertas === 'function') {
        window.renderizarListaOfertasOriginal = renderizarListaOfertas;
        renderizarListaOfertas = renderizarListaOfertasComCorrecao;
    }
    
    // Adicionar botão de diagnóstico
    adicionarBotaoDiagnostico();
}

function adicionarBotaoDiagnostico() {
    const header = document.querySelector('.admin-card:first-child div');
    if (header) {
        const btn = document.createElement('button');
        btn.innerHTML = '🔍 DIAGNÓSTICO';
        btn.style.background = '#17a2b8';
        btn.style.color = 'white';
        btn.style.border = 'none';
        btn.style.padding = '8px 15px';
        btn.style.borderRadius = '20px';
        btn.style.marginLeft = '10px';
        btn.style.cursor = 'pointer';
        btn.onclick = function() {
            diagnosticarCompleto('ADMIN');
            corrigirOfertas();
        };
        header.appendChild(btn);
    }
}

// Executar correção quando a página carregar
setTimeout(aplicarCorrecaoAdmin, 500);
