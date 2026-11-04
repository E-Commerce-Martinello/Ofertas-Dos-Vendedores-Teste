// Painel de utilização — dados privados do Firebase, perfil de filial da base Sheets.
const DashboardPresenter = {
    eventos: [],
    periodo: '30',
    carregando: false,
    ultimoCarregamento: 0,

    escapar(texto) {
        return String(texto ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    },

    _mapaVendedores() {
        const m = new Map();
        for (const v of (VendedoresPresenter?.registros || [])) {
            const rubi = String(v.matricula || '').replace(/\D/g, '');
            if (rubi) m.set(rubi, v);
        }
        return m;
    },

    _nomeOferta(id, fallback) {
        const oferta = (AdminPresenter.ofertas || []).find(o => String(o.id) === String(id));
        return oferta?.tituloPagina || fallback || `Oferta ${id}`;
    },

    _agrupar(eventos, chave, texto, max = 10) {
        const lista = new Map();
        for (const item of eventos) {
            const id = chave(item);
            if (!lista.has(id)) lista.set(id, {id, titulo: texto(item), total: 0});
            lista.get(id).total++;
        }
        return [...lista.values()].sort((a,b) => b.total - a.total || String(a.titulo).localeCompare(String(b.titulo), 'pt-BR')).slice(0,max);
    },

    _ranking(destino, lista, vazio) {
        const el = document.getElementById(destino);
        if (!el) return;
        if (!lista.length) {
            el.innerHTML = `<p class="dashboard-vazio">${this.escapar(vazio)}</p>`;
            return;
        }
        const max = Math.max(1, lista[0].total);
        el.innerHTML = lista.map((r,i) => `<div class="dashboard-barra-item">
          <div class="dashboard-barra-cabecalho"><span><b>${i+1}.</b> ${this.escapar(r.titulo)}</span><strong>${r.total}</strong></div>
          <div class="dashboard-barra-pista"><div style="width:${Math.max(3,100*r.total/max)}%"></div></div>
        </div>`).join('');
    },

    renderizar() {
        const el = id => document.getElementById(id);
        const selecionada = el('dashboardFiltroOferta')?.value || '';
        const mapa = this._mapaVendedores();
        const eventos = this.eventos.filter(ev => !selecionada || String(ev.ofertaId) === selecionada);
        const unicos = new Set(eventos.map(e => e.matricula));
        const ofertas = new Set(eventos.map(e => String(e.ofertaId)));
        el('dashInicios').textContent = eventos.length.toLocaleString('pt-BR');
        el('dashVendedores').textContent = unicos.size.toLocaleString('pt-BR');
        el('dashOfertas').textContent = ofertas.size.toLocaleString('pt-BR');
        const primeiro = this._agrupar(eventos, e => String(e.ofertaId), e => this._nomeOferta(e.ofertaId, e.tituloOferta), 1)[0];
        el('dashMaisPopular').textContent = primeiro?.titulo || '—';
        this._ranking('dashRankingOfertas', this._agrupar(eventos,
            e => String(e.ofertaId), e => this._nomeOferta(e.ofertaId,e.tituloOferta)), 'Nenhum registro neste período.');
        this._ranking('dashRankingVendedores', this._agrupar(eventos,
            e => String(e.matricula), e => {
                const v = mapa.get(String(e.matricula));
                return v ? `${v.nome} · ${e.matricula}` : `Matrícula ${e.matricula}`;
            }), 'Nenhum vendedor registrado neste período.');
        this._ranking('dashRankingFiliais', this._agrupar(eventos,
            e => mapa.get(String(e.matricula))?.filial || '?', e => {
                const v = mapa.get(String(e.matricula));
                return v?.filial ? `Filial ${v.filial}${v.localidadeFilial ? ' · '+v.localidadeFilial : ''}` : 'Filial não identificada';
            }), 'Nenhum registro por filial.');
        const dias = this._agrupar(eventos,
            e => new Intl.DateTimeFormat('en-CA',{timeZone:'America/Cuiaba',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(e.iniciadoEm)),
            e => new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Cuiaba',day:'2-digit',month:'2-digit'}).format(new Date(e.iniciadoEm)), 100)
            .sort((a,b) => a.id.localeCompare(b.id)).slice(-14);
        this._ranking('dashEvolucao', dias.sort((a,b) => b.total - a.total), 'Nenhuma atividade neste período.');
        el('dashboardAvisoBase').textContent = mapa.size
            ? `Filiais associadas à base de ${mapa.size} vendedores carregados do Google Sheets.`
            : 'Aguardando a base de vendedores para identificar as filiais. Atualize o painel após o carregamento.';
    },

    atualizarFiltroOfertas() {
        const sel = document.getElementById('dashboardFiltroOferta');
        if (!sel) return;
        const anterior = sel.value;
        const map = new Map();
        for (const e of this.eventos) map.set(String(e.ofertaId), this._nomeOferta(e.ofertaId,e.tituloOferta));
        sel.replaceChildren(new Option('Todas as ofertas',''));
        for (const [id,nome] of [...map].sort((a,b) => a[1].localeCompare(b[1], 'pt-BR'))) {
            sel.add(new Option(nome, id));
        }
        if (map.has(anterior)) sel.value = anterior;
    },

    async atualizar() {
        if (this.carregando) return;
        const sel = document.getElementById('dashboardPeriodo');
        this.periodo = sel?.value || '30';
        const status = document.getElementById('dashboardStatus');
        const btn = document.getElementById('dashboardAtualizar');
        this.carregando = true;
        btn.disabled = true;
        status.textContent = 'Carregando registros privados do Firebase...';
        try {
            if (!Auth.usuarioAtual() || Auth.usuarioAtual().isAnonymous) throw new Error('Entre com uma conta Google administradora.');
            this.eventos = await AnalyticsService.consultar(this.periodo);
            this.ultimoCarregamento = Date.now();
            this.atualizarFiltroOfertas();
            this.renderizar();
            status.textContent = `${this.eventos.length} registro(s) carregado(s). Medição indicativa: não confirma envio pelo WhatsApp.`;
        } catch (e) {
            this.eventos = [];
            this.atualizarFiltroOfertas();
            this.renderizar();
            console.warn('Dashboard indisponível:', e);
            status.textContent = `Não foi possível consultar a utilização: ${e.message || 'verifique as permissões.'}`;
        } finally {
            this.carregando = false;
            btn.disabled = false;
        }
    },

    limpar() {
        this.eventos = [];
        this.ultimoCarregamento = 0;
    }
};
