/* Fila administrativa de solicitações recebidas de gerentes. */
const GerentesSolicitacoesPresenter={
  pedidos:[],carregando:false,processando:new Set(),
  el(id){return document.getElementById(id);},
  esc(v){return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));},
  formatar(v){return Telefones.formato(String(v||''));},
  definir(dados){
    if(!Array.isArray(dados?.pedidos))return;
    this.pedidos=dados.pedidos;
    if(this.el('painelSolicitacoesGerentes')?.open)this.renderizar();
  },
  async carregar(){
    if(this.carregando)return;
    this.carregando=true;
    const status=this.el('solicitacoesGerentesStatus');
    if(status)status.textContent='Consultando solicitações dos gerentes…';
    try{
      const resposta=await GoogleSheetsService._post('listarSolicitacoesGerentes');
      this.definir(resposta.resultado||{pedidos:[]});
      this.renderizar();
    }catch(e){if(status)status.textContent='Não foi possível consultar: '+e.message;}
    finally{this.carregando=false;}
  },
  renderizar(){
    const lista=this.el('solicitacoesGerentesLista'),status=this.el('solicitacoesGerentesStatus');
    if(!lista)return;
    const filtro=this.el('solicitacoesGerentesFiltro')?.value||'ABERTAS';
    const abertos=['PENDENTE','CT_TEMPORARIO','EM_ANALISE'];
    const exibidos=this.pedidos.filter(p=>filtro==='TODAS'||(filtro==='ABERTAS'&&abertos.includes(p.status))||p.status===filtro);
    if(status)status.textContent=exibidos.length+' solicitações exibidas • '+this.pedidos.length+' recebidas';
    const chip=p=>p.status==='CT_TEMPORARIO'?'CT TEMPORÁRIO':String(p.status||'PENDENTE').replace(/_/g,' ');
    lista.innerHTML=exibidos.length?exibidos.map(p=>{
      const ct=p.contratoTemporario||p.status==='CT_TEMPORARIO';
      const estado=abertos.includes(p.status);
      return '<article class="vendor-link-row"><div style="flex:1;min-width:190px"><strong>'+
        this.esc(p.nome)+' · Rubi '+this.esc(p.matricula)+'</strong><small>Filial '+
        this.esc(p.filial)+' · Gerente '+this.esc(p.gerenteMatricula)+
        (ct?' · Sem cadastro de telefone (CT Temporário)':' · Telefone '+this.esc(p.tipo)+
        ': '+this.esc(this.formatar(p.telefone)))+' · '+this.esc(p.criadoEm||'')+'</small>'+
        (p.observacao?'<small>Observação: '+this.esc(p.observacao)+'</small>':'')+
        '<span class="vendor-badge '+(ct?'unknown':'')+'">'+this.esc(chip(p))+'</span></div>'+
        (estado?'<div class="vendor-actions" style="align-items:center;flex-wrap:wrap">'+
        (ct?'':'<button type="button" class="vendor-small-btn" data-abrir="'+this.esc(p.id)+'">REVISAR VENDEDOR</button>')+
        '<button type="button" class="vendor-small-btn" data-concluir="'+this.esc(p.id)+'">CONCLUIR</button>'+
        '<button type="button" class="vendor-small-btn" data-rejeitar="'+this.esc(p.id)+'">REJEITAR</button>'+
        '</div>':'')+'</article>';
    }).join(''):'<p class="vendor-empty">Nenhuma solicitação nesta situação.</p>';
    for(const btn of lista.querySelectorAll('[data-abrir]')){
      btn.addEventListener('click',()=>this.abrir(btn.dataset.abrir));
    }
    for(const btn of lista.querySelectorAll('[data-concluir]')){
      btn.addEventListener('click',()=>this.atualizar(btn.dataset.concluir,'CONCLUIDO'));
    }
    for(const btn of lista.querySelectorAll('[data-rejeitar]')){
      btn.addEventListener('click',()=>this.atualizar(btn.dataset.rejeitar,'REJEITADO'));
    }
  },
  abrir(id){
    const p=this.pedidos.find(x=>x.id===id);if(!p)return;
    if(p.contratoTemporario||p.status==='CT_TEMPORARIO'){
      UI.ok('Contrato temporário: não é necessário cadastrar telefone. Conclua ou rejeite a solicitação.');return;
    }
    if(!VendedoresPresenter.registros.some(v=>v.matricula===p.matricula)){
      UI.erro('Vendedor não localizado na base atual. Confira matrícula e filial.');return;
    }
    VendedoresPresenter.abrirSolicitacaoTelefone(p.matricula,p.telefone,p.tipo,false);
  },
  async atualizar(id,status){
    const p=this.pedidos.find(x=>x.id===id);
    if(!p||this.processando.has(id))return;
    if(!confirm((status==='CONCLUIDO'?'Confirma que o cadastro foi revisado e deseja concluir':'Deseja rejeitar')+
      ' esta solicitação do gerente? A ação não altera automaticamente os dados do vendedor.'))return;
    this.processando.add(id);
    try{
      await GoogleSheetsService._post('atualizarSolicitacaoGerente',{id,revision:p.revision,status});
      UI.ok('Situação da solicitação atualizada.');
      await this.carregar();
      AdminSync.coordenador?.sinal();
    }catch(e){UI.erro(e.message||'Não foi possível atualizar a solicitação.');}
    finally{this.processando.delete(id);}
  }
};
