// No início do seu código no index.html
debugCompleto(JSON.parse(localStorage.getItem('ofertaAtiva')));

// Para atualizar o debug na tela
function atualizarDebug() {
    const agoraBrasilia = getHorarioBrasilia();
    document.getElementById('debugHoraBrasilia').innerText = formatarBrasilia(agoraBrasilia.toISOString());
    
    const oferta = JSON.parse(localStorage.getItem('ofertaAtiva'));
    if (oferta) {
        document.getElementById('debugOfertaInfo').innerHTML = 
            `${oferta.tituloPagina} (${formatarBrasilia(oferta.dataInicio)} até ${formatarBrasilia(oferta.dataFim)})`;
    }
}

setInterval(atualizarDebug, 1000);
