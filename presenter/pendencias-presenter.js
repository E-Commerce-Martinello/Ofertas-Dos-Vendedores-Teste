// Pendências de telefones, sem duplicar dados nem alterar a base por fora da API existente.
const PendenciasPresenter = {
  pagina: 1,
  porPagina: 40,
  renderizar() {
    const destino = document.getElementById('pendenciasLista');
    if (!destino) return;
    const vendedores = VendedoresPresenter.registros || [];
    if (!vendedores.length) {
      destino.innerHTML = '<p class="vendor-empty">Carregue a base de vendedores para consultar as pendências.</p>';
      return;
    }
    const filtrados = vendedores.filter(v=>v.ativo && v.statusTelefone!=='VALIDADO');
    const termo = (document.getElementById('pendenciasBusca')?.value || '').toLocaleLowerCase('pt-BR').trim();
    const filial = document.getElementById('pendenciasFilial')?.value || '';
    const encontrados = filtrados.filter(v => (!filial || v.filial === filial) &&
      (!termo || [v.matricula,v.nome,v.filial,v.numero].some(s=>String(s||'').toLocaleLowerCase('pt-BR').includes(termo))));
    const select = document.getElementById('pendenciasFilial');
    if (select) {
      const antiga = select.value;
      const opções = [...new Set(filtrados.map(v=>v.filial).filter(Boolean))].sort((a,b)=>Number(a)-Number(b));
      const escape = v => VendedoresPresenter._escapar(v);
      select.innerHTML = '<option value="">Todas as filiais</option>'+opções.map(v=>`<option value="${escape(v)}">${escape(v)}${VendedoresPresenter.filiais[v]?' — '+escape(VendedoresPresenter.filiais[v]):''}</option>`).join('');
      select.value = antiga;
    }
    const total = document.getElementById('pendenciasTotal');
    if (total) total.textContent = String(filtrados.length);
    const sem = document.getElementById('pendenciasSemNumero');
    if (sem) sem.textContent = String(filtrados.filter(v=>!v.numero).length);
    const com = document.getElementById('pendenciasAConferir');
    if (com) com.textContent = String(filtrados.filter(v=>!!v.numero).length);
    const paginas=Math.max(1,Math.ceil(encontrados.length/this.porPagina));
    this.pagina=Math.max(1,Math.min(this.pagina,paginas));
    const inicio=(this.pagina-1)*this.porPagina;
    const escape = v => VendedoresPresenter._escapar(v);
    destino.innerHTML = encontrados.slice(inicio,inicio+this.porPagina).map(v=>`<tr>
      <td>${escape(v.matricula)}</td><td>${escape(v.nome)}</td><td>${escape(v.filial)}${v.localidadeFilial?'<br><small>'+escape(v.localidadeFilial)+'</small>':''}</td>
      <td>${v.numero?escape(VendedoresPresenter._exibirTelefone(v.numero)):'Não informado'}</td>
      <td><span class="vendor-badge review">PENDENTE</span></td>
      <td><button class="vendor-small-btn primary" data-rubi="${escape(v.matricula)}">EDITAR</button></td></tr>`).join('') || '<tr><td colspan="6" class="vendor-empty">Nenhuma pendência encontrada.</td></tr>';
    destino.querySelectorAll('[data-rubi]').forEach(btn=>btn.addEventListener('click',()=>VendedoresPresenter.abrirEdicao(btn.dataset.rubi)));
    const info=document.getElementById('pendenciasPagina');
    if (info) info.textContent=`${encontrados.length} encontrados · Página ${this.pagina} de ${paginas}`;
    document.getElementById('pendenciasAnterior').disabled=this.pagina<=1;
    document.getElementById('pendenciasProxima').disabled=this.pagina>=paginas;
  },
  paginaMudar(n) { this.pagina+=n; this.renderizar(); }
};
