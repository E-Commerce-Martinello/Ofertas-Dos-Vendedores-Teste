/* Portal de Gerentes: informações acessíveis apenas via API autenticada por filial. */
const GerentesPresenter = {
  matricula:'',dados:null,ocupado:false,enviando:false,refresh:null,selecionado:null,aba:'resultados',
  el(id){return document.getElementById(id);},
  texto(v){return String(v==null?'':v);},
  escapar(v){return this.texto(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));},
  status(id,mensagem,tipo=''){
    const el=this.el(id);if(!el)return;
    el.textContent=mensagem||'';el.hidden=!mensagem;
    el.className='status'+(tipo?' '+tipo:'');
  },
  mesBrasilia(){
    const d=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit'}).formatToParts(new Date());
    const m=Object.fromEntries(d.map(x=>[x.type,x.value]));
    return m.year+'-'+m.month;
  },
  iniciarMeses(){
    const mes=this.mesBrasilia(),y=Number(mes.slice(0,4)),m=Number(mes.slice(5,7));
    const sel=this.el('gerenteMes');
    for(let i=0;i<=12;i++){
      const dt=new Date(Date.UTC(y,m-1-i,2,12));
      const value=dt.toISOString().slice(0,7);
      const titulo=new Intl.DateTimeFormat('pt-BR',{timeZone:'UTC',month:'long',year:'numeric'}).format(dt);
      sel.add(new Option(titulo.charAt(0).toUpperCase()+titulo.slice(1),value));
    }
  },
  async init(){
    this.iniciarMeses();
    this.el('formLoginGerente').addEventListener('submit',e=>{e.preventDefault();this.entrar();});
    this.el('gerenteSair').addEventListener('click',()=>this.sair());
    this.el('gerenteMes').addEventListener('change',()=>{this.el('gerenteCampanha').value='';this.carregar();});
    this.el('gerenteCampanha').addEventListener('change',()=>this.carregar());
    this.el('gerenteBusca').addEventListener('input',()=>this.renderizarListas());
    for(const botao of document.querySelectorAll('[data-aba]')){
      botao.addEventListener('click',()=>this.abrirAba(botao.dataset.aba));
    }
    this.el('gerenteCancelar').addEventListener('click',()=>this.el('gerenteDialogo').close());
    this.el('gerenteFormSolicitacao').addEventListener('submit',e=>{e.preventDefault();this.enviarSolicitacao();});
    this.el('gerenteTelefone').addEventListener('input',e=>{
      e.target.value=Telefones.formato(e.target.value);
      this.el('gerenteErroTelefone').textContent='';
    });
    try{await Auth.iniciar();}
    catch(e){this.status('gerenteLoginStatus','Falha ao iniciar login Google: '+e.message,'error');}
    this.refresh=setInterval(()=>{
      if(!document.hidden&&this.matricula&&this.dados&&!this.ocupado&&!this.enviando&&!this.el('gerenteDialogo').open)
        this.carregar(true);
    },90000);
  },
  async entrar(){
    const matricula=this.el('gerenteMatricula').value.replace(/\D/g,'');
    if(!/^\d{3,8}$/.test(matricula)){this.status('gerenteLoginStatus','Informe uma matrícula válida.','error');return;}
    const btn=this.el('gerenteEntrar');btn.disabled=true;
    this.status('gerenteLoginStatus','Autenticando e conferindo a filial autorizada...');
    try{
      // Google identifica o usuário; a API valida o vínculo entre o e-mail, a
      // matrícula e a filial. A matrícula isoladamente nunca libera dados.
      await Auth.entrarGoogle();
      this.matricula=matricula;
      await this.carregar();
      this.el('gerentesLogin').hidden=true;this.el('gerentesPainel').hidden=false;
      this.status('gerenteLoginStatus','');
    }catch(e){
      this.matricula='';this.dados=null;
      this.status('gerenteLoginStatus',e.message||'Acesso não autorizado.','error');
      this.el('gerentesPainel').hidden=true;this.el('gerentesLogin').hidden=false;
    }finally{btn.disabled=false;}
  },
  async sair(){
    this.matricula='';this.dados=null;this.selecionado=null;
    this.el('gerentesPainel').hidden=true;this.el('gerentesLogin').hidden=false;
    this.el('gerenteMatricula').value='';this.el('gerenteBusca').value='';
    this.status('gerenteStatus','');
    try{await Auth.sair();}catch(_){}
  },
  async carregar(silencioso=false){
    if(this.ocupado||!this.matricula)return;
    this.ocupado=true;
    if(!silencioso)this.status('gerenteStatus','Conferindo dados atualizados da sua filial...');
    try{
      const mes=this.el('gerenteMes').value,campanha=this.el('gerenteCampanha').value;
      const resposta=await GoogleSheetsService._post('consultarPainelGerente',
        {matriculaGerente:this.matricula,mes,campanha});
      const dados=resposta.resultado;
      if(!dados||dados.gerente?.matricula!==this.matricula||!Array.isArray(dados.vendedores))
        throw new Error('A API não confirmou a filial autorizada.');
      this.dados=dados;
      this.atualizarCampanhas();
      this.renderizar();
      this.status('gerenteStatus',dados.truncado
        ? 'Alguns eventos antigos estão fora do limite de consulta. Os indicadores podem estar incompletos.':'',
        dados.truncado?'error':'');
    }catch(e){
      this.status('gerenteStatus',e.message||'Não foi possível atualizar os dados.','error');
      if(!silencioso)throw e;
    }finally{this.ocupado=false;}
  },
  atualizarCampanhas(){
    const sel=this.el('gerenteCampanha'),antigo=sel.value;
    sel.replaceChildren(new Option('Todas as campanhas',''),new Option('Sem campanha','__sem__'));
    for(const c of this.dados.campanhas||[])sel.add(new Option(c,c));
    if([...sel.options].some(o=>o.value===antigo))sel.value=antigo;
  },
  abrirAba(aba){
    this.aba=aba==='cadastros'?'cadastros':'resultados';
    for(const valor of ['resultados','cadastros']){
      const ativa=valor===this.aba;
      const botao=this.el(valor==='resultados'?'gerenteAbaResultados':'gerenteAbaCadastros');
      botao.setAttribute('aria-selected',ativa?'true':'false');
      this.el(valor==='resultados'?'gerenteResultados':'gerenteCadastros').hidden=!ativa;
    }
  },
  fmt(n){return (Number(n)||0).toLocaleString('pt-BR');},
  data(ts){
    const n=Number(ts);
    return n>0?new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',
      day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(n)):'—';
  },
  filtrados(){
    const busca=this.el('gerenteBusca').value.trim().toLocaleLowerCase('pt-BR');
    return (this.dados?.vendedores||[]).filter(v=>!busca||
      String(v.nome||'').toLocaleLowerCase('pt-BR').includes(busca)||
      String(v.matricula||'').includes(busca.replace(/\D/g,'')));
  },
  renderizar(){
    if(!this.dados)return;
    const dados=this.dados,ger=dados.gerente||{},t=dados.totais||{};
    this.el('gerenteNome').textContent=ger.nome?'Olá, '+ger.nome:'Resultados da sua filial';
    this.el('gerenteFilial').textContent='Filial '+ger.filial+(ger.localidade?' • '+ger.localidade:'');
    this.el('gerenteAtualizadoEm').textContent='Última consulta '+this.data(Date.parse(dados.atualizadoEm));
    const ids={gerenteTotal:t.vendedores,gerenteAtivos:t.ativos,gerenteUsando:t.usando,
      gerenteInicios:t.compartilhamentos,gerenteOfertas:t.ofertas};
    for(const [id,n] of Object.entries(ids))this.el(id).textContent=this.fmt(n);
    this.renderizarListas();
  },
  renderizarListas(){
    const lista=this.filtrados();
    this.el('gerenteRankingResumo').textContent=this.fmt(lista.length)+' vendedores';
    this.el('gerenteRanking').innerHTML=lista.length
      ? lista.map((v,i)=>'<tr><td><strong>'+this.escapar(v.nome)+'</strong><small>'+(i+1)+'º na lista</small></td>'+
        '<td>'+this.escapar(v.matricula)+'</td><td><strong>'+this.fmt(v.compartilhamentos)+'</strong></td>'+
        '<td>'+this.data(v.ultimaAtividade)+'</td></tr>').join('')
      : '<tr><td colspan="4">Nenhum vendedor encontrado.</td></tr>';
    const ec={LINK_VERIFICADO:['Link verificado','good'],LINK_NAO_LOCALIZADO:['Link não localizado','bad'],
      INCONCLUSIVO:['Verificação pendente','warn']};
    const tel={VALIDADO:['Telefone validado','good'],CONFLITO:['Telefone em conflito','bad'],
      TITULARIDADE_PENDENTE:['Titularidade pendente','warn'],PENDENTE:['Telefone pendente','warn']};
    const area=this.el('gerenteListaCadastros');
    area.innerHTML=lista.length?lista.map(v=>{
      const a=ec[v.eCommerce]||ec.INCONCLUSIVO,b=tel[v.statusTelefone]||tel.PENDENTE;
      return '<article class="seller-card"><h3>'+this.escapar(v.nome)+'</h3>'+
        '<p class="info">Matrícula '+this.escapar(v.matricula)+' • '+(v.ativo?'Ativo':'Inativo')+
        ' • '+this.escapar(v.situacaoFuncional||'Situação não informada')+'</p>'+
        '<div class="indicators"><span class="badge '+a[1]+'">'+a[0]+'</span>'+
        '<span class="badge '+b[1]+'">'+b[0]+'</span></div>'+
        '<button type="button" class="btn btn-primary btn-full" data-solicitar="'+this.escapar(v.matricula)+'">Solicitar cadastro / revisão</button></article>';
    }).join(''):'<div class="empty">Nenhum vendedor encontrado.</div>';
    for(const botao of area.querySelectorAll('[data-solicitar]')){
      botao.addEventListener('click',()=>this.abrirSolicitacao(botao.dataset.solicitar));
    }
  },
  abrirSolicitacao(matricula){
    const v=this.dados?.vendedores?.find(x=>x.matricula===matricula);
    if(!v)return;
    this.selecionado=v;
    this.el('gerenteFormSolicitacao').reset();
    this.el('gerenteSolicitacaoVendedor').textContent=v.nome+' • matrícula '+v.matricula;
    this.el('gerenteErroTelefone').textContent='';
    this.status('gerenteSolicitacaoStatus','');
    this.el('gerenteDialogo').showModal();
    this.el('gerenteTelefone').focus();
  },
  async enviarSolicitacao(){
    if(this.enviando||!this.selecionado||!this.matricula)return;
    const raw=this.el('gerenteTelefone').value;
    const erro=Telefones.erro(raw,false);
    if(erro){this.el('gerenteErroTelefone').textContent=erro;return;}
    const tipo=this.el('gerenteTipo').value;
    if(!['pessoal','profissional'].includes(tipo)){
      this.status('gerenteSolicitacaoStatus','Selecione o tipo de telefone.','error');return;
    }
    this.enviando=true;this.el('gerenteEnviar').disabled=true;
    this.status('gerenteSolicitacaoStatus','Registrando solicitação para a equipe administrativa...');
    try{
      const resposta=await GoogleSheetsService._post('criarSolicitacaoGerente',{
        matriculaGerente:this.matricula,matriculaVendedor:this.selecionado.matricula,
        telefone:Telefones.numero(raw),tipo,contratoTemporario:this.el('gerenteCT').checked,
        observacao:this.el('gerenteObservacao').value.trim()
      });
      const r=resposta.resultado||{};
      this.status('gerenteSolicitacaoStatus',r.duplicado
        ? 'Essa solicitação já está pendente na equipe administrativa.'
        : 'Solicitação registrada! A equipe administrativa fará a revisão.','success');
      this.el('gerenteEnviar').disabled=true;
    }catch(e){this.status('gerenteSolicitacaoStatus',e.message||'Não foi possível registrar.','error');}
    finally{this.enviando=false;this.el('gerenteEnviar').disabled=false;}
  }
};
document.addEventListener('DOMContentLoaded',()=>GerentesPresenter.init());
