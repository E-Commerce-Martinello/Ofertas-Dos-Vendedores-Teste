const WhatsAppPresenter = {
  participantes: [], identificacoes: [], previa: null, tipoPrevia:'colar',
  pagina:1, porPagina:40, editando:'', carregando:false,
  _esc(v) { return VendedoresPresenter._escapar(v); },
  _status(txt,tipo='') { const e=document.getElementById('whatsappStatus'); if(e){e.className='vendor-status '+tipo; e.textContent=txt;} },
  async carregar() {
    if (this.carregando) return;
    this.carregando=true; this._status('Consultando participantes no Google Sheets...');
    try {
      if (!VendedoresPresenter.registros.length && !VendedoresPresenter.carregando) await VendedoresPresenter.atualizar();
      if (!VendedoresPresenter.registros.length) throw new Error('Aguarde o carregamento da base de vendedores e tente novamente.');
      const dados=await GoogleSheetsService.listarWhatsApp();
      this.participantes=dados.participantes||[];
      this.identificacoes=dados.identificacoes||[];
      this.pagina=1;
      this.renderizar();
      this._status(`${this.participantes.length} participantes na lista atual. Identificações manuais preservadas.`, 'ok');
    } catch(e) { this._status(e.message,'error'); }
    finally {this.carregando=false;}
  },
  preverTexto() {
    const texto=document.getElementById('whatsappColar').value;
    const r=GrupoWhatsAppModel.analisarTexto(texto);
    if (!r.registros.length || r.erros.length) {
      this.previa=null;
      this._status(r.erros.length?`Existem ${r.erros.length} linhas inválidas. ${r.erros.slice(0,3).join(' ')}`:'Cole ao menos uma linha Nome;Telefone.','error');
      document.getElementById('whatsappPrevia').hidden=true;
      return;
    }
    this.previa=r.registros; this.tipoPrevia='colar'; this._mostrarPrevia(r.registros.length,r.duplicados, 'Texto colado');
  },
  async preverParametros() {
    this._status('Lendo a aba Parâmetros de Dados...');
    try {
      const r=await GoogleSheetsService.lerParametrosWhatsApp();
      if (!r.registros?.length) throw new Error('Não há participantes com telefone válido na aba Parâmetros de Dados.');
      this.previa=r.registros; this.tipoPrevia='parametros';
      this._mostrarPrevia(r.registros.length,r.descartadas||0,'Parâmetros de Dados');
    } catch(e) {this.previa=null;document.getElementById('whatsappPrevia').hidden=true;this._status(e.message,'error');}
  },
  _mostrarPrevia(total, ignorados, origem) {
    const p=document.getElementById('whatsappPrevia'); p.hidden=false;
    document.getElementById('whatsappPreviaTexto').textContent=`${origem}: ${total} números únicos; ${ignorados} linhas ignoradas ou repetidas. A lista anterior será substituída; identificações manuais serão preservadas.`;
    this._status('Prévia pronta. Confira a quantidade antes de substituir.');
  },
  async importar() {
    if (!this.previa?.length) return;
    const anteriores=this.participantes.length;
    const reducao=anteriores>=20 && this.previa.length<anteriores*0.7;
    const detalhe=reducao?' ATENÇÃO: a nova lista é mais de 30% menor do que a anterior.':'';
    if (!confirm(`Substituir a lista atual (${anteriores}) por ${this.previa.length} participantes?${detalhe}\nOs cadastros oficiais e as identificações manuais NÃO serão alterados.`)) return;
    if (reducao && !confirm('Confirma novamente a redução significativa da lista de participantes?')) return;
    this._status('Atualizando a lista do grupo no Sheets...');
    try {
      const resposta=await GoogleSheetsService.importarWhatsApp({origem:this.tipoPrevia,
        registros: this.tipoPrevia==='colar'?this.previa:[], confirmar:true, aceitarReducao:reducao });
      this._status(`${resposta.total} participantes importados. Telefones dos vendedores não foram alterados.`, 'ok');
      this.previa=null; document.getElementById('whatsappPrevia').hidden=true;
      await this.carregar();
    } catch(e) {this._status(e.message,'error');}
  },
  _registrosClassificados() {
    const base=VendedoresPresenter.registros || [];
    return this.participantes.map(p=>({...p, classificacao:GrupoWhatsAppModel.classificar(p,base,this.identificacoes)}));
  },
  renderizar() {
    const lista=this._registrosClassificados();
    const totais={vendedor:0,identificado:0,revisar:0,desconhecido:0};
    lista.forEach(p=>{totais[p.classificacao.situacao]=(totais[p.classificacao.situacao]||0)+1;});
    document.getElementById('whatsappTotal').textContent=String(lista.length);
    document.getElementById('whatsappVendedores').textContent=String(totais.vendedor);
    document.getElementById('whatsappRevisar').textContent=String(totais.revisar);
    document.getElementById('whatsappDesconhecidos').textContent=String(totais.desconhecido);
    const estado=document.getElementById('whatsappFiltro').value;
    const busca=document.getElementById('whatsappBusca').value.toLocaleLowerCase('pt-BR').trim();
    const vistos=lista.filter(p=>(!estado || p.classificacao.situacao===estado) &&
      (!busca || [p.nome,p.telefone,p.classificacao.matricula,p.classificacao.vendedor?.nome].some(v=>String(v||'').toLocaleLowerCase('pt-BR').includes(busca))));
    const pages=Math.max(1,Math.ceil(vistos.length/this.porPagina));
    this.pagina=Math.max(1,Math.min(this.pagina,pages));
    const pageItems=vistos.slice((this.pagina-1)*this.porPagina,this.pagina*this.porPagina);
    const statusNome={vendedor:'VENDEDOR',identificado:'OUTRO / GERENTE',revisar:'REVISAR',desconhecido:'NÃO IDENTIFICADO'};
    const classe={vendedor:'in',identificado:'success',revisar:'review',desconhecido:'unknown'};
    const corpo=document.getElementById('whatsappLinhas');
    corpo.innerHTML=pageItems.map(p=>`<tr><td>${this._esc(p.nome)}</td><td>${this._esc(p.telefone)}</td>
      <td><span class="vendor-badge ${classe[p.classificacao.situacao]}">${statusNome[p.classificacao.situacao]}</span></td>
      <td>${this._esc(p.classificacao.vendedor?.nome||p.classificacao.tipo||'—')}${p.classificacao.matricula?'<br><small>Rubi '+this._esc(p.classificacao.matricula)+'</small>':''}</td>
      <td>${this._esc(p.classificacao.motivo)}</td>
      <td><button type="button" class="vendor-small-btn primary" data-tel="${this._esc(p.telefone)}">IDENTIFICAR</button></td></tr>`).join('')||'<tr><td colspan="6" class="vendor-empty">Nenhum participante encontrado.</td></tr>';
    corpo.querySelectorAll('[data-tel]').forEach(b=>b.addEventListener('click',()=>this.abrirIdentificacao(b.dataset.tel)));
    document.getElementById('whatsappPagina').textContent=`${vistos.length} encontrados · Página ${this.pagina} de ${pages}`;
    document.getElementById('whatsappAnterior').disabled=this.pagina<=1;
    document.getElementById('whatsappProxima').disabled=this.pagina>=pages;
  },
  mover(n) {this.pagina+=n;this.renderizar();},
  abrirIdentificacao(telefone) {
    const participante=this.participantes.find(v=>v.telefone===telefone);
    if (!participante) return;
    const manual=this.identificacoes.find(v=>v.telefone===telefone);
    this.editando=telefone;
    document.getElementById('whatsappEditando').textContent=`${participante.nome} · ${participante.telefone}`;
    const classificado=GrupoWhatsAppModel.classificar(participante, VendedoresPresenter.registros||[], this.identificacoes);
    document.getElementById('whatsappTipoPessoa').value=manual?.tipo||(classificado.situacao==='vendedor'?'VENDEDOR':'GERENTE');
    document.getElementById('whatsappMatricula').value=manual?.matricula||classificado.matricula||'';
    document.getElementById('whatsappObservacao').value=manual?.observacao||'';
    this.mostrarMatricula();
    document.getElementById('whatsappModal').style.display='flex';
  },
  mostrarMatricula() {
    document.getElementById('whatsappMatriculaBloco').hidden=document.getElementById('whatsappTipoPessoa').value!=='VENDEDOR';
  },
  fechar() {document.getElementById('whatsappModal').style.display='none';},
  async salvar(remover=false) {
    const tipo=remover?'REMOVER':document.getElementById('whatsappTipoPessoa').value;
    const matricula=document.getElementById('whatsappMatricula').value;
    const observacao=document.getElementById('whatsappObservacao').value;
    const btn=document.getElementById('whatsappSalvar'); btn.disabled=true;
    try {
      await GoogleSheetsService.salvarIdentificacaoWhatsApp({telefone:this.editando,tipo,matricula,observacao});
      this.fechar();await this.carregar();
      UI.ok(remover?'Identificação manual removida.':'Identificação salva no Sheets.');
    } catch(e) { UI.erro(e.message); }
    finally {btn.disabled=false;}
  }
};
