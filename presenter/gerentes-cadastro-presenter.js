/* Cadastro dos gerentes: somente no admin autenticado, com base no Sheets TESTE. */
const CadastroGerentesPresenter={
  gerentes:[],carregando:false,salvando:false,sujo:false,original:'',
  el(id){return document.getElementById(id);},
  status(texto='',erro=false){
    const el=this.el('cadastroGerentesStatus');if(!el)return;
    el.hidden=!texto;el.textContent=texto;el.classList.toggle('error',erro);
  },
  filiais(){
    const select=this.el('cadastroGerenteFilial');if(!select)return;
    const atual=select.value,base=VendedoresPresenter.filiais||{};
    select.replaceChildren(new Option('Selecione uma filial',''));
    Object.entries(base).filter(([codigo])=>/^\d{1,6}$/.test(codigo))
      .sort((a,b)=>Number(a[0])-Number(b[0]))
      .forEach(([codigo,nome])=>{
        const cidade=typeof FiliaisUI!=='undefined'?FiliaisUI.nome(codigo):nome;
        select.add(new Option(codigo+' • '+cidade,codigo));
      });
    if(atual&&Array.from(select.options).some(o=>o.value===atual))select.value=atual;
  },
  novo(){
    const form=this.el('cadastroGerentesForm');if(!form)return;
    form.reset();this.original='';this.sujo=false;
    this.el('cadastroGerenteMatricula').readOnly=false;
    this.el('cadastroGerenteRevision').value='';
    this.el('cadastroGerenteAtivo').checked=true;
    this.estadoAtivo();this.filiais();
    this.el('cadastroGerenteTitulo').textContent='Cadastrar gerente';
    this.status('');
  },
  estadoAtivo(){
    const ativo=!!this.el('cadastroGerenteAtivo')?.checked;
    const el=this.el('cadastroGerenteEstado');
    if(el)el.textContent=ativo?'ATIVO — acesso liberado':'INATIVO — acesso bloqueado';
  },
  editar(matricula){
    const g=this.gerentes.find(v=>v.matricula===String(matricula));if(!g)return;
    this.novo();this.original=g.matricula;this.filiais();
    this.el('cadastroGerenteMatricula').value=g.matricula;
    this.el('cadastroGerenteMatricula').readOnly=true;
    this.el('cadastroGerenteNome').value=g.nome;
    this.el('cadastroGerenteTelefone').value=Telefones.formato(g.telefone);
    this.el('cadastroGerenteFilial').value=g.filial;
    this.el('cadastroGerenteAtivo').checked=g.ativo;
    this.el('cadastroGerenteRevision').value=g.revision;
    this.el('cadastroGerenteTitulo').textContent='Editar gerente • '+g.matricula;
    this.estadoAtivo();this.sujo=false;
    this.el('cadastroGerentesForm').scrollIntoView({behavior:'smooth',block:'nearest'});
  },
  telefoneInput(){
    const el=this.el('cadastroGerenteTelefone');
    if(el)el.value=Telefones.formato(el.value);
    this.sujo=true;
  },
  async carregar(){
    const detalhe=this.el('painelCadastroGerentes');
    if(!detalhe?.open||this.carregando||this.salvando)return;
    if(!AdminPresenter._autorizado)return;
    this.filiais();
    this.carregando=true;
    try{
      const resp=await GoogleSheetsService._post('listarCadastroGerentes');
      const lista=resp.resultado?.gerentes;
      if(!Array.isArray(lista))throw new Error('A API não retornou a base de gerentes.');
      this.gerentes=lista;
      this.renderizar();
      if(!this.sujo)this.status(lista.length+' gerente(s) na base de acesso.');
    }catch(erro){this.status(erro.message||'Não foi possível carregar os gerentes.',true);}
    finally{this.carregando=false;}
  },
  renderizar(){
    const area=this.el('cadastroGerentesLista');if(!area)return;
    area.replaceChildren();
    const busca=String(this.el('cadastroGerentesBusca')?.value||'').trim().toLocaleLowerCase('pt-BR');
    const lista=this.gerentes.filter(g=>!busca||
      [g.matricula,g.nome,g.filial,g.telefone].some(x=>String(x||'').toLocaleLowerCase('pt-BR').includes(busca)));
    if(!lista.length){
      const p=document.createElement('p');p.className='vendor-subtext';
      p.textContent=this.gerentes.length?'Nenhum gerente corresponde à busca.':'Nenhum gerente cadastrado.';
      area.appendChild(p);return;
    }
    for(const g of lista){
      const card=document.createElement('article');card.className='cadastro-gerentes-item';
      const bloco=document.createElement('div');bloco.className='cadastro-gerentes-identidade';
      const titulo=document.createElement('strong');titulo.textContent=g.nome+' • '+g.matricula;
      const info=document.createElement('small');
      info.textContent='Filial '+g.filial+' • '+(typeof FiliaisUI!=='undefined'?FiliaisUI.nome(g.filial):g.filial)
        +' • '+Telefones.formato(g.telefone);
      const status=document.createElement('span');status.className='cadastro-gerentes-status';
      status.dataset.ativo=String(g.ativo);status.textContent=g.ativo?'ATIVO':'INATIVO';
      bloco.append(titulo,info,status);
      const editar=document.createElement('button');editar.type='button';editar.className='vendor-small-btn';
      editar.textContent='EDITAR';editar.addEventListener('click',()=>this.editar(g.matricula));
      card.append(bloco,editar);area.appendChild(card);
    }
  },
  async salvar(event){
    event?.preventDefault();
    if(this.salvando)return;
    const matricula=this.el('cadastroGerenteMatricula').value.trim();
    const nome=this.el('cadastroGerenteNome').value.trim();
    const filial=this.el('cadastroGerenteFilial').value;
    const telefone=this.el('cadastroGerenteTelefone').value.trim();
    const msg=Telefones.erro(telefone,false);
    if(!/^\d{3,8}$/.test(matricula)){this.status('Informe uma matrícula com 3 a 8 dígitos.',true);return;}
    if(nome.length<2||nome.length>160){this.status('Informe nome com 2 a 160 caracteres.',true);return;}
    if(!filial){this.status('Selecione uma filial da lista.',true);return;}
    if(msg){this.status(msg,true);return;}
    const botao=this.el('cadastroGerenteSalvar');this.salvando=true;botao.disabled=true;
    this.status('Salvando o gerente...');
    try{
      const resp=await GoogleSheetsService._post('salvarCadastroGerente',{
        matricula,matriculaOriginal:this.original,nome,filial,
        telefone:Telefones.numero(telefone),ativo:this.el('cadastroGerenteAtivo').checked,
        revision:this.el('cadastroGerenteRevision').value
      });
      if(!resp.resultado?.matricula)throw new Error('API não confirmou o cadastro.');
      this.novo();
      this.salvando=false;
      await this.carregar();
      this.status('Gerente salvo. A matrícula informada já pode ser usada na página de gerentes.');
    }catch(e){this.status(e.message||'Não foi possível salvar o gerente.',true);}
    finally{this.salvando=false;botao.disabled=false;}
  }
};
