// Martinello — telemetria indicativa de compartilhamentos iniciados.
// Não atesta envio no WhatsApp. Não altera o cadastro oficial (Google Sheets).
// Um registro por navegador autenticado, oferta e minuto (proteção contra duplo clique).
const AnalyticsService = {
    caminho: 'eventosCompartilhamento' + (CONFIG.environment === 'TESTE' ? '_TESTE' : ''),
    autenticando: null,

    async prepararPortal() {
        if (typeof firebase === 'undefined' || !firebase.auth) return null;
        if (this.autenticando) return this.autenticando;
        this.autenticando = (async () => {
            let usuario = firebase.auth().currentUser;
            if (!usuario) {
                // Aguarda a restauração da sessão existente, evitando trocar a conta Google
                // do administrador por uma conta anônima quando ele abre o portal.
                usuario = await new Promise(resolve => {
                    let cancelar = () => {};
                    cancelar = firebase.auth().onAuthStateChanged(u => {
                        cancelar(); resolve(u);
                    }, () => resolve(null));
                });
            }
            if (usuario) return usuario;
            // Mantém sessão do navegador entre visitas, sem solicitar dados pessoais.
            await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
            const resultado = await firebase.auth().signInAnonymously();
            return resultado.user;
        })();
        try { return await this.autenticando; }
        finally { this.autenticando = null; }
    },

    async registrarInicio(oferta, matricula) {
        const id = String(oferta?.id ?? '').trim();
        const rubi = String(matricula || '').replace(/\D/g, '');
        if (!/^[A-Za-z0-9_-]{1,40}$/.test(id) || !/^\d{3,5}$/.test(rubi)) return false;
        const usuario = await this.prepararPortal();
        if (!usuario) return false;
        const instante = Date.now();
        const mes = new Date(instante).toISOString().slice(0, 7).replace('-', '');
        const minuto = Math.floor(instante / 60000);
        const chave = `${id}_${minuto}`;
        const dados = {
            ofertaId: id,
            tituloOferta: String(oferta.tituloPagina || 'Oferta').slice(0, 160),
            matricula: rubi,
            tipo: 'inicio_compartilhamento',
            iniciadoEm: firebase.database.ServerValue.TIMESTAMP
        };
        try {
            await database.ref(`${this.caminho}/${mes}/${usuario.uid}/${chave}`).set(dados);
            return true;
        } catch (erro) {
            // A regra impede gravar duas vezes a mesma oferta no mesmo minuto.
            // O compartilhamento continua mesmo quando o registro falhar.
            if (String(erro?.code || '').toUpperCase() !== 'PERMISSION_DENIED') {
                console.warn('Registro de utilização indisponível:', erro);
            }
            return false;
        }
    },

    periodoDias(dias) {
        const fim = Date.now();
        if (dias === 'hoje') {
            const partes = new Intl.DateTimeFormat('en-CA', {
                timeZone: 'America/Cuiaba', year: 'numeric', month: '2-digit', day: '2-digit'
            }).formatToParts(new Date(fim));
            const p = Object.fromEntries(partes.filter(x => x.type !== 'literal').map(x => [x.type,x.value]));
            // Brasil/Cuiabá (UTC-4 em 2026; sem horário de verão).
            const inicio = Date.parse(`${p.year}-${p.month}-${p.day}T04:00:00.000Z`);
            return {inicio, fim};
        }
        const qtd = [7,30,90].includes(Number(dias)) ? Number(dias) : 30;
        return {inicio: fim - qtd * 86400000, fim};
    },

    mesesEntre(inicio, fim) {
        const meses = [];
        const d = new Date(inicio);
        let ano = d.getUTCFullYear(), mes = d.getUTCMonth();
        const limite = new Date(fim);
        const ultimo = limite.getUTCFullYear() * 12 + limite.getUTCMonth();
        while (ano * 12 + mes <= ultimo && meses.length <= 6) {
            meses.push(`${ano}${String(mes+1).padStart(2,'0')}`);
            mes++;
            if (mes === 12) { ano++; mes = 0; }
        }
        return meses;
    },

    async consultar(periodo) {
        const {inicio, fim} = this.periodoDias(periodo);
        const resultados = await Promise.all(this.mesesEntre(inicio, fim).map(async mes => {
            const snap = await database.ref(`${this.caminho}/${mes}`).once('value');
            return snap.val() || {};
        }));
        const eventos = [];
        for (const mes of resultados) {
            for (const registros of Object.values(mes)) {
                if (!registros || typeof registros !== 'object') continue;
                for (const ev of Object.values(registros)) {
                    if (!ev || ev.tipo !== 'inicio_compartilhamento') continue;
                    if (typeof ev.iniciadoEm !== 'number' || ev.iniciadoEm < inicio || ev.iniciadoEm > fim) continue;
                    if (!/^\d{3,5}$/.test(String(ev.matricula || ''))) continue;
                    eventos.push(ev);
                }
            }
        }
        return eventos;
    }
};
