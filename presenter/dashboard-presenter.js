// Painel de utilização — registros e perfis consultados no Google Sheets.
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
        const campanha = el('dashboardFiltroCampanha')?.value || '';
        const daCampanha = ev => !campanha || (campanha === '__sem__'
            ? !ev.campanha : String(ev.campanha||'') === campanha);
        const mapa = this._mapaVendedores();
        const visitas=this.eventos.filter(ev=>ev.tipo==='acesso_portal' && daCampanha(ev));
        const eventos = this.eventos.filter(ev => ev.tipo==='inicio_compartilhamento' && daCampanha(ev) &&
          (!selecionada || String(ev.ofertaId)===selecionada));
        const cliques=this.eventos.filter(ev=>ev.tipo==='clique_link' && daCampanha(ev) &&
          (!selecionada || String(ev.ofertaId)===selecionada));
        const acesso=document.getElementById('dashAcessosPortal');
        const whats=document.getElementById('dashAcessosWhatsApp');
        if(acesso)acesso.textContent=visitas.length.toLocaleString('pt-BR');
        if(whats)whats.textContent=visitas.filter(ev=>ev.origem==='whatsapp_grupo').length.toLocaleString('pt-BR');
        const unicos = new Set(eventos.map(e => e.matricula));
        const ofertas = new Set(eventos.map(e => String(e.ofertaId)));
        el('dashInicios').textContent = eventos.length.toLocaleString('pt-BR');
        el('dashCliques').textContent = cliques.length.toLocaleString('pt-BR');
        this._ranking('dashRankingCliquesOfertas', this._agrupar(cliques,
            e=>String(e.ofertaId),e=>this._nomeOferta(e.ofertaId,e.tituloOferta)), 'Sem cliques nesta seleção.');
        this._ranking('dashRankingCliquesVendedores', this._agrupar(cliques,
            e=>String(e.matricula),e=>{
                const v=mapa.get(String(e.matricula));
                return v ? `${v.nome} · ${e.matricula}` : `Matrícula ${e.matricula}`;
            }), 'Sem cliques por vendedor nesta seleção.');
        this._ranking('dashRankingCliquesFiliais', this._agrupar(cliques,
            e=>mapa.get(String(e.matricula))?.filial||'?',e=>{
                const v=mapa.get(String(e.matricula));
                return v?.filial ? `Filial ${v.filial}${v.localidadeFilial?' · '+v.localidadeFilial:''}` : 'Filial não identificada';
            }), 'Sem cliques por filial nesta seleção.');
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

    atualizarFiltroCampanhas() {
        const sel=document.getElementById('dashboardFiltroCampanha');
        if(!sel)return;
        const anterior=sel.value;
        const nomes=new Set(this.eventos.map(e=>String(e.campanha||'').trim()).filter(Boolean));
        const geral=typeof CampanhasPresenter!=='undefined'?CampanhasPresenter.config?.campanhaGeral:'';
        if(geral)nomes.add(geral);
        for(const o of (AdminPresenter.ofertas||[]))if(o.campanha)nomes.add(o.campanha);
        const temSem=this.eventos.some(e=>!e.campanha);
        sel.replaceChildren(new Option('Todas as campanhas',''));
        if(temSem)sel.add(new Option('Sem campanha','__sem__'));
        for(const n of [...nomes].sort((a,b)=>a.localeCompare(b,'pt-BR')))sel.add(new Option(n,n));
        if([...sel.options].some(o=>o.value===anterior))sel.value=anterior;
    },

    atualizarFiltroOfertas() {
        const sel = document.getElementById('dashboardFiltroOferta');
        if (!sel) return;
        const anterior = sel.value;
        const map = new Map();
        for (const e of this.eventos.filter(ev=>['inicio_compartilhamento','clique_link'].includes(ev.tipo))) map.set(String(e.ofertaId), this._nomeOferta(e.ofertaId,e.tituloOferta));
        sel.replaceChildren(new Option('Todas as ofertas',''));
        for (const [id,nome] of [...map].sort((a,b) => a[1].localeCompare(b[1], 'pt-BR'))) {
            sel.add(new Option(nome, id));
        }
        if (map.has(anterior)) sel.value = anterior;
    },

    async copiarLinkGrupo() {
        const link=typeof CampanhasPresenter!=='undefined' && CampanhasPresenter.config?.linkGrupo
            ? CampanhasPresenter.config.linkGrupo
            : 'https://www.martinello.com.br/ofertasvendedor';
        try {await navigator.clipboard.writeText(link);UI.ok('Link compacto da Martinello copiado (sem alterar o endereço).');}
        catch(_) {window.prompt('Copie o link compacto:',link);}
    },

    async atualizar() {
        if (this.carregando) return;
        const sel = document.getElementById('dashboardPeriodo');
        this.periodo = sel?.value || '30';
        const status = document.getElementById('dashboardStatus');
        const btn = document.getElementById('dashboardAtualizar');
        this.carregando = true;
        btn.disabled = true;
        status.textContent = 'Consultando a aba Eventos_Portal no Google Sheets...';
        try {
            if (!Auth.usuarioAtual() || Auth.usuarioAtual().isAnonymous) throw new Error('Entre com uma conta Google administradora.');
            const consulta = await GoogleSheetsService.consultarEventosPortal(this.periodo);
            this.eventos = consulta.eventos;
            this.ultimoCarregamento = Date.now();
            this.atualizarFiltroOfertas();
            this.atualizarFiltroCampanhas();
            this.renderizar();
            status.textContent = `${this.eventos.length} registro(s) carregado(s) do Sheets. Medição indicativa: não confirma envio pelo WhatsApp.`;
            if (consulta.truncado) status.textContent += ' Atenção: histórico limitado na consulta. Use um período menor.';
            if (CONFIG.environment === 'TESTE' && this.eventos.length === 0) {
                try {
                    const d = JSON.parse(localStorage.getItem('martTelemetriaDiagnostico_TESTE') || 'null');
                    if (d?.status) status.textContent += ` Última tentativa neste navegador: ${d.status} — ${d.detalhe}`;
                } catch (_) {}
            }
        } catch (e) {
            this.eventos = [];
            this.atualizarFiltroOfertas();
            this.atualizarFiltroCampanhas();
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
