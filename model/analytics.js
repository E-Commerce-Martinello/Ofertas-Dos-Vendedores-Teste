// Martinello 1.6.3.2 — eventos no Google Sheets (sem gravar no Firebase).
// Registro público, indicativo: não comprova o envio pelo WhatsApp.
const AnalyticsService = {
    _diagnostico(status, detalhe = '') {
        if (CONFIG.environment !== 'TESTE') return;
        try {
            localStorage.setItem('martTelemetriaDiagnostico_TESTE', JSON.stringify({
                status, detalhe: String(detalhe).slice(0, 200), quando: new Date().toISOString()
            }));
        } catch (_) {}
    },

    // Visita sem matrícula, telefone, IP ou nome. Uma sessão a cada 30 min neste navegador.
    async registrarVisita() {
        const url=String(CONFIG.portalEventsApiUrl||'');
        if(!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url)) return false;
        let anterior=null;
        try { anterior=JSON.parse(sessionStorage.getItem('martVisitaPortal_TESTE')||'null'); } catch(_) {}
        if(anterior?.id && Date.now()-anterior.ts < 1800000) return true;
        const id=`vis_${Date.now()}_${Math.random().toString(36).slice(2,13)}`;
        const query=new URLSearchParams(location.search);
        const fonte=query.get('utm_source')==='whatsapp' && query.get('utm_medium')==='grupo'
          ? 'whatsapp_grupo' : query.has('utm_source') ? 'outro' : 'direto';
        const dados=new URLSearchParams({action:'registrarVisita',origem:location.origin,
          sessionId:id,origemCampanha:fonte});
        try {
            await fetch(url,{method:'POST',mode:'no-cors',keepalive:true,cache:'no-store',
              headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},body:dados.toString()});
            // Retorno opaco confirma somente despacho; a gravação deve ser conferida no Sheets.
            try {sessionStorage.setItem('martVisitaPortal_TESTE',JSON.stringify({id,ts:Date.now()}));} catch(_){}
            return true;
        } catch(e) {console.warn('Medição de visita indisponível:',e);return false;}
    },

    async registrarInicio(oferta, matricula) {
        const ofertaId = String(oferta?.id ?? '').trim();
        const rubi = String(matricula || '').replace(/\D/g, '');
        if (!/^[a-zA-Z0-9_-]{1,40}$/.test(ofertaId) || !/^\d{3,5}$/.test(rubi)) {
            this._diagnostico('erro', 'Matrícula ou identificador de oferta inválido.');
            return false;
        }
        const url = String(CONFIG.portalEventsApiUrl || '');
        if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url)) {
            this._diagnostico('não configurado', 'Configure portalEventsApiUrl em shared/config.js.');
            console.warn('Registro do portal não configurado em shared/config.js.');
            return false;
        }

        // Duplo clique: máximo uma tentativa por matrícula e oferta a cada 10 minutos
        // neste navegador. O servidor também aplica limites e checa repetição.
        const janela = Math.floor(Date.now() / 600000);
        const chave = `martEvento_${ofertaId}_${rubi}_${janela}`;
        try {
            if (sessionStorage.getItem(chave) === 'ok') return true;
        } catch (_) {}

        const parametros = new URLSearchParams({
            action: 'registrar',
            ofertaId,
            tituloOferta: String(oferta?.tituloPagina || 'Oferta').slice(0, 100),
            matricula: rubi,
            origem: window.location.origin,
            requestId: `ev_${Date.now()}_${Math.random().toString(36).slice(2,12)}`
        });
        try {
            // Sem CORS: navegadores não conseguem ler o retorno de Apps Script.
            // Uma resposta opaca confirma apenas o despacho, NÃO a gravação.
            await fetch(url, {
                method: 'POST', mode: 'no-cors',
                headers: {'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'},
                body: parametros.toString(), keepalive: true, cache: 'no-store'
            });
            try { sessionStorage.setItem(chave, 'ok'); } catch (_) {}
            this._diagnostico('enviado', 'Solicitação despachada; confirme a gravação na aba Eventos_Portal.');
            return true;
        } catch (erro) {
            this._diagnostico('erro', erro?.message || 'Falha na comunicação com o Apps Script.');
            console.warn('Registro indicativo não enviado ao Apps Script:', erro);
            return false;
        }
    }
};
