/* Portal de Gerentes: identificação por matrícula cadastrada; dados limitados à filial no servidor. */
const GerentesPresenter = {
  matricula:'',dados:null,ocupado:false,pendente:false,enviando:false,refresh:null,selecionado:null,aba:'resultados',
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
  // Mesma logo pública da vitrine, com fallback para o arquivo usado no admin.
  async carregarLogo(){
    const img=this.el('logoGerentes');
    if(!img)return;
    const base=String(CONFIG.firebaseConfig?.databaseURL||'').replace(/\/$/,'');
    if(!/^https:\/\/[a-z0-9-]+(?:-default-rtdb)?\.firebaseio\.com$/i.test(base))
      return;
    const sufixo=CONFIG.environment==='TESTE'?'_TESTE':'';
    const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),5000);
    try{
      const resposta=await fetch(base+'/aparenciaPortal'+sufixo+'/logo.json',{
        method:'GET',cache:'no-store',credentials:'omit',signal:ctl.signal
      });
      if(!resposta.ok)return;
      const logo=await resposta.json();
      if(logo==='img/logo.png'||(
        typeof logo==='string'&&logo.length<=180000&&
        /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(logo)
      ))img.src=logo;
    }catch(_){/* A logo estática do admin permanece visível. */}
    finally{clearTimeout(timer);}
  },
  iniciarTema(){
    let tema='light';
    try{tema=localStorage.getItem('tema')==='dark'?'dark':'light';}catch(_){}
    this.aplicarTema(tema);
    this.el('gerenteTema')?.addEventListener('click',()=>{
      const escuro=document.documentElement.classList.contains('dark-mode');
      this.aplicarTema(escuro?'light':'dark');
      try{localStorage.setItem('tema',escuro?'light':'dark');}catch(_){}
    });
  },
  aplicarTema(tema){
    const escuro=tema==='dark';
    document.documentElement.classList.toggle('dark-mode',escuro);
    const botao=this.el('gerenteTema');
    if(botao){botao.textContent=escuro?'☀ Tema claro':'☾ Tema escuro';
      botao.setAttribute('aria-label',escuro?'Ativar tema claro':'Ativar tema escuro');}
  },
  atualizarContratoTemporario(){
    const ct=this.el('gerenteCT').checked;
    const campos=this.el('gerenteCamposCadastro'),aviso=this.el('gerenteCTOrientacao');
    campos.hidden=ct;aviso.hidden=!ct;
    for(const id of ['gerenteTelefone','gerenteTipo']){
      const campo=this.el(id);campo.required=!ct;campo.disabled=ct;
      if(ct)campo.value='';
    }
    const observacao=this.el('gerenteObservacao');observacao.disabled=ct;
    if(ct)observacao.value='';
    this.el('gerenteErroTelefone').textContent='';
    this.status('gerenteSolicitacaoStatus','');
    this.el('gerenteEnviar').textContent=ct?'REGISTRAR CT TEMPORÁRIO':'ENVIAR SOLICITAÇÃO';
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
    this.carregarLogo();
    this.iniciarTema();
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
    this.el('gerenteCT').addEventListener('change',()=>this.atualizarContratoTemporario());
    this.el('gerenteTelefone').addEventListener('input',e=>{
      e.target.value=Telefones.formato(e.target.value);
      this.el('gerenteErroTelefone').textContent='';
    });
    this.refresh=setInterval(()=>{
      if(!document.hidden&&this.matricula&&this.dados&&!this.ocupado&&!this.enviando&&!this.el('gerenteDialogo').open)
        this.carregar(true);
    },300000);
  },
  async entrar(){
    const matricula=this.el('gerenteMatricula').value.replace(/\D/g,'');
    if(!/^\d{3,8}$/.test(matricula)){this.status('gerenteLoginStatus','Informe uma matrícula válida.','error');return;}
    const btn=this.el('gerenteEntrar');btn.disabled=true;
    this.status('gerenteLoginStatus','Localizando os dados da filial...');
    try{
      // Apenas a matrícula cadastrada identifica a filial. Não há autenticação.
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
  limparDados(){
    this.matricula='';this.dados=null;this.selecionado=null;this.pendente=false;
    this.el('gerentesPainel').hidden=true;this.el('gerentesLogin').hidden=false;
    this.el('gerenteRanking').replaceChildren();
    this.el('gerenteListaCadastros').replaceChildren();
    this.el('gerenteNome').textContent='Painel da filial';
    this.el('gerenteFilial').textContent='Filial';
    for(const id of ['gerenteTotal','gerenteAtivos','gerenteUsando','gerenteInicios','gerenteOfertas'])
      this.el(id).textContent='—';
    this.status('gerenteStatus','');
    // O Portal de Gerentes usa GerentesAPI; não compartilha cache da administração.
  },
  async sair(){
    this.limparDados();
    this.el('gerenteMatricula').value='';this.el('gerenteBusca').value='';
  },
  async carregar(silencioso=false){
    if(!this.matricula)return;
    if(this.ocupado){this.pendente=true;return;}
    this.ocupado=true;
    if(!silencioso)this.status('gerenteStatus','Conferindo dados atualizados da sua filial...');
    const identidade=this.matricula,mes=this.el('gerenteMes').value,
      campanha=this.el('gerenteCampanha').value;
    try{
      const resposta=await GerentesAPI.executar('consultarPainelGerente',
        {matriculaGerente:identidade,mes,campanha});
      if(identidade!==this.matricula)return;
      // Requisições antigas não podem substituir novos filtros selecionados.
      if(mes!==this.el('gerenteMes').value||campanha!==this.el('gerenteCampanha').value){
        this.pendente=true;return;
      }
      const dados=resposta.resultado;
      if(!dados||dados.gerente?.matricula!==identidade||!Array.isArray(dados.vendedores))
        throw new Error('A API não confirmou a filial autorizada.');
      this.dados=dados;
      this.atualizarCampanhas();
      this.renderizar();
      this.status('gerenteStatus',dados.truncado
        ? 'Alguns eventos antigos estão fora do limite de consulta. Os indicadores podem estar incompletos.':'',
        dados.truncado?'error':'');
    }catch(e){
      if(identidade!==this.matricula)return;
      const mensagem=e.message||'Não foi possível atualizar os dados.';
      if(/matrícula não cadastrada|matrícula.*desativada|filial do gerente não configurada|excedeu o limite de consulta/i.test(mensagem)){
        this.limparDados();
        this.status('gerenteLoginStatus','Matrícula não disponível. Consulte a equipe administrativa.','error');
      }else this.status('gerenteStatus',mensagem,'error');
      if(!silencioso)throw e;
    }finally{
      this.ocupado=false;
      if(this.pendente&&this.matricula){
        this.pendente=false;
        await this.carregar(true);
      }
    }
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
    const digitos=busca.replace(/\D/g,'');
    return (this.dados?.vendedores||[]).filter(v=>!busca||
      String(v.nome||'').toLocaleLowerCase('pt-BR').includes(busca)||
      (digitos&&String(v.matricula||'').includes(digitos)));
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
    const cadastros=this.dados?.vendedores||[];
    this.el('gerenteRankingResumo').textContent=this.fmt(lista.length)+' vendedores';
    this.el('gerenteRanking').innerHTML=lista.length
      ? lista.map((v,i)=>'<tr class="ranking-vendedor"><td data-label="Vendedor"><strong>'+this.escapar(v.nome)+'</strong><small>'+(i+1)+'º na lista</small></td>'+
        '<td data-label="Matrícula">'+this.escapar(v.matricula)+'</td><td data-label="Compartilhamentos"><strong>'+this.fmt(v.compartilhamentos)+'</strong></td>'+
        '<td data-label="Última atividade">'+this.data(v.ultimaAtividade)+'</td></tr>').join('')
      : '<tr class="ranking-vazio"><td colspan="4">Nenhum vendedor encontrado.</td></tr>';
    const ec={LINK_VERIFICADO:['Link verificado','good'],LINK_NAO_LOCALIZADO:['Link não localizado','bad'],
      INCONCLUSIVO:['Sem cadastro e-commerce','bad']};
    const tel={VALIDADO:['Telefone validado','good'],CONFLITO:['Telefone em conflito','bad'],
      TITULARIDADE_PENDENTE:['Titularidade pendente','warn'],PENDENTE:['Telefone pendente','warn'],
      NAO_ENCONTRADO_NO_RELATORIO:['Sem telefone','warn']};
    const area=this.el('gerenteListaCadastros');
    area.innerHTML=cadastros.length?cadastros.map(v=>{
      const a=ec[v.eCommerce]||ec.INCONCLUSIVO,b=tel[v.statusTelefone]||tel.PENDENTE;
      return '<article class="seller-card"><h3>'+this.escapar(v.nome)+'</h3>'+
        '<p class="info">Matrícula '+this.escapar(v.matricula)+' • '+(v.ativo?'Ativo':'Inativo')+
        ' • '+this.escapar(String(v.situacaoFuncional||'').toUpperCase()==='NAO_ENCONTRADO_NO_RELATORIO'?'Sem telefone':(v.situacaoFuncional||'Situação não informada'))+'</p>'+
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
    this.el('gerenteEnviar').disabled=false;
    this.el('gerenteSolicitacaoVendedor').textContent=v.nome+' • matrícula '+v.matricula;
    this.el('gerenteErroTelefone').textContent='';
    this.status('gerenteSolicitacaoStatus','');
    this.atualizarContratoTemporario();
    this.el('gerenteDialogo').showModal();
    this.el('gerenteCT').focus();
  },
  async enviarSolicitacao(){
    if(this.enviando||!this.selecionado||!this.matricula)return;
    const ct=this.el('gerenteCT').checked;
    const raw=ct?'':this.el('gerenteTelefone').value;
    if(!ct){
      const erro=Telefones.erro(raw,false);
      if(erro){this.el('gerenteErroTelefone').textContent=erro;return;}
    }
    const tipo=ct?'':this.el('gerenteTipo').value;
    if(!ct&&!['pessoal','profissional'].includes(tipo)){
      this.status('gerenteSolicitacaoStatus','Selecione o tipo de telefone.','error');return;
    }
    this.enviando=true;this.el('gerenteEnviar').disabled=true;
    let concluido=false;
    this.status('gerenteSolicitacaoStatus','Registrando solicitação para a equipe administrativa...');
    try{
      const resposta=await GerentesAPI.executar('criarSolicitacaoGerente',{
        matriculaGerente:this.matricula,matriculaVendedor:this.selecionado.matricula,
        telefone:ct?'':Telefones.numero(raw),tipo,contratoTemporario:ct,
        observacao:ct?'':this.el('gerenteObservacao').value.trim()
      });
      const r=resposta.resultado||{};
      this.status('gerenteSolicitacaoStatus',r.duplicado
        ? 'Essa solicitação já está pendente na equipe administrativa.'
        : 'Solicitação registrada! A equipe administrativa fará a revisão.','success');
      concluido=true;
    }catch(e){this.status('gerenteSolicitacaoStatus',e.message||'Não foi possível registrar.','error');}
    finally{this.enviando=false;this.el('gerenteEnviar').disabled=concluido;}
  }
};
document.addEventListener('DOMContentLoaded',()=>GerentesPresenter.init());
