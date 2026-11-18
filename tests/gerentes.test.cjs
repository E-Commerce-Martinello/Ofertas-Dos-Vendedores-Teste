// Testes locais com dados sintéticos. Nenhuma chamada a serviços externos.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const raiz=path.join(__dirname,'..');
const fonte=fs.readFileSync(path.join(raiz,'infrastructure/apps-script/admin/Gerentes.gs'),'utf8');
const Telefones=require(path.join(raiz,'shared/telefones.js'));
function montar(){
  const now=Date.now();
  const dados={
    Gerentes_Autorizados:[['matricula_gerente','nome','filial_autorizada','ativo','atualizado_em','telefone'],
      ['12345','Gerente A','1','ATIVO','','65998124567'],
      ['67890','Gerente B','2','INATIVO','','65998124568']],
    Vendedores:[['matricula','nome','filial','codigo_filial','telefone_original','telefone_normalizado','situacao_funcional',
      'status_cadastro','origem_cadastro','criado_em','atualizado_em','observacoes','status_telefone'],
      ['11111','Vendedor A','1','','65998124567','','OK','ATIVO','','','','','VALIDADO'],
      ['22222','Vendedor B','2','','65998124568','','OK','ATIVO','','','','','VALIDADO']],
  };
  dados.Solicitacoes_Gerentes=[['solicitacao_id','criado_em','gerente_matricula','origem_acesso','filial','vendedor_matricula',
    'vendedor_nome','telefone','tipo','contrato_temporario','status','observacao','atualizado_em','processado_por']];
  dados.Eventos_Portal=[['id','registrado_em','ms','oferta','titulo','mat','tipo'],
    ['evt-a','',now,'oferta','Produto','11111','inicio_compartilhamento'],
    ['evt-b','',now,'oferta','Produto','22222','inicio_compartilhamento']];
  dados.Eventos_Campanhas=[['id','registrado_em','ms','tipo','oferta','mat','campanha','origem','titulo'],
    ['evt-a','',now,'inicio_compartilhamento','oferta','11111','camp1','portal','Produto'],
    ['evt-b','',now,'inicio_compartilhamento','oferta','22222','camp2','portal','Produto']];
  dados.Verificacao_Links=[['matricula','url','status','http','destino','verificado_em','detalhe'],
    ['11111','','redirecionamento','','','',''],['22222','','inativo','','','','']];
  const folha=nome=>!dados[nome]?null:{
    getLastRow:()=>dados[nome].length,
    getRange:(r,c,n=1,w=1)=>({
      getDisplayValues:()=>dados[nome].slice(r-1,r-1+n).map(a=>Array.from({length:w},(_,i)=>String(a[c-1+i]??''))),
      getValues:()=>dados[nome].slice(r-1,r-1+n).map(a=>Array.from({length:w},(_,i)=>a[c-1+i]??'')),
      setNumberFormat(){return this;},
      setValues:vals=>vals.forEach((v,i)=>{const index=r-1+i;const row=dados[nome][index]||[];
        for(let k=0;k<v.length;k++)row[c-1+k]=v[k];
        dados[nome][index]=row;})
    })
  };
  const planilha={getSheetByName:folha};
  const formatDate=(d,tz,fmt)=>new Intl.DateTimeFormat('sv-SE',
    {timeZone:tz,year:'numeric',month:'2-digit',...(fmt==='yyyy-MM-dd'?{day:'2-digit'}:{})}).format(new Date(d));
  const mocks={
    obterPlanilhaVendedoresV153_:()=>planilha,
    obterAbaVendedoresV153_:()=>folha('Vendedores'),
    MART_V153_HEADERS:dados.Vendedores[0],
    Telefones,LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},
    CacheService:{getScriptCache:()=>({get:()=>null,put:()=>{}})},
    Utilities:{formatDate,getUuid:()=> 'abc12345-aaaa-aaaa-aaaa-abcdef123456'},
    mart19_contexto_:()=>({grupo:{participantes:[],identificacoes:[],disponivel:true},
      registros:dados.Vendedores.slice(1).map(r=>({matricula:r[0],numero:r[4],statusTelefone:r[12],telefonesExtras:{}}))}),
    listarFiliaisV153_:()=>[['1','Cidade A'],['2','Cidade B']]
  };
  const keys=Object.keys(mocks);
  const api=new Function(...keys,fonte+'\nreturn {autorizar:mart20_autorizarGerente_,painel:mart20_consultarPainelGerente_,criar:mart20_criarSolicitacaoGerente_,listar:mart20_listarSolicitacoesGerentes_,listarCadastro:mart20_listarCadastroGerentes_,salvarCadastro:mart20_salvarCadastroGerente_};')
    (...keys.map(k=>mocks[k]));
  const ator={email:'MATRICULA_12345',matricula:'12345',nome:'Gerente A',filial:'1'};
  return {dados,api,ator,formatDate};
}
test('matrícula ativa identifica a filial sem Google; inválida, inativa ou duplicada é recusada',()=>{
  const s=montar();
  assert.equal(s.api.autorizar('12345').filial,'1');
  assert.equal(s.api.autorizar('12345').autenticado,false);
  assert.throws(()=>s.api.autorizar('67890'));
  assert.throws(()=>s.api.autorizar('abc'));
  assert.throws(()=>s.api.autorizar('99999'));
  s.dados.Gerentes_Autorizados.push(['12345','Duplicado','2','ATIVO','','65998124569']);
  assert.throws(()=>s.api.autorizar('12345'));
});
test('ranking e campanhas não revelam outra filial',()=>{
  const s=montar(),mes=s.formatDate(new Date(),'America/Sao_Paulo','yyyy-MM');
  const p=s.api.painel({mes,campanha:''},s.ator);
  assert.deepEqual(p.vendedores.map(v=>v.matricula),['11111']);
  assert.equal(p.totais.compartilhamentos,1);
  assert.deepEqual(p.campanhas,['camp1']);
});
test('CT temporário não exige telefone/tipo e não permite outra filial',()=>{
  const s=montar();
  const pedido={matriculaVendedor:'11111',telefone:'',tipo:'',contratoTemporario:true};
  assert.throws(()=>s.api.criar({...pedido,matriculaVendedor:'22222'},s.ator));
  assert.equal(s.api.criar(pedido,s.ator).status,'CT_TEMPORARIO');
  assert.equal(s.api.criar({...pedido,telefone:'65998124567',tipo:'pessoal'},s.ator).duplicado,true);
  const r=s.api.listar().pedidos[0];
  assert.equal(r.contratoTemporario,true);
  assert.equal(r.telefone,'');
  assert.equal(r.tipo,'');
});
test('pedido comum exige telefone e tipo, inclusive quando há CT para o mesmo vendedor',()=>{
  const s=montar();
  s.api.criar({matriculaVendedor:'11111',contratoTemporario:true},s.ator);
  assert.throws(()=>s.api.criar({matriculaVendedor:'11111',contratoTemporario:false},s.ator));
  assert.equal(s.api.criar({matriculaVendedor:'11111',telefone:'65998124567',tipo:'profissional',contratoTemporario:false},s.ator).status,'PENDENTE');
  assert.equal(s.api.listar().pedidos.length,2);
});

test('admin cadastra e edita gerente, preservando vínculo e revisão',()=>{
  const s=montar(),matricula='22334';
  const p={matricula,nome:'Gerente Novo',telefone:'65998124569',filial:'1',ativo:true,revision:''};
  const novo=s.api.salvarCadastro(p);
  assert.equal(novo.matricula,matricula);
  assert.equal(s.api.autorizar(matricula).filial,'1');
  assert.equal(s.api.listarCadastro().gerentes.length,3);
  assert.throws(()=>s.api.salvarCadastro(p)); // revisão vazia não sobrescreve registro recém-criado
  const alterado=s.api.salvarCadastro({...p,matriculaOriginal:matricula,nome:'Gerente Editado',ativo:false,revision:novo.revision});
  assert.equal(alterado.ativo,false);
  assert.throws(()=>s.api.autorizar(matricula));
  assert.equal(s.api.listarCadastro().gerentes.find(g=>g.matricula===matricula).nome,'Gerente Editado');
  assert.throws(()=>s.api.salvarCadastro({...p,matricula:'22445',filial:'999'}));
  assert.throws(()=>s.api.salvarCadastro({...p,matricula:'22445',telefone:'65911111111'}));
});

test('gerente pode ser cadastrado sem celular e o número preenchido continua validado',()=>{
  const s=montar();
  const p={matricula:'33445',nome:'Gerente Sem Celular',filial:'1',telefone:'',ativo:true,revision:''};
  const registro=s.api.salvarCadastro(p);
  assert.equal(registro.telefone,'');
  assert.equal(s.api.listarCadastro().gerentes.find(g=>g.matricula==='33445').telefone,'');
  assert.equal(s.api.autorizar('33445').filial,'1');
  assert.throws(()=>s.api.salvarCadastro({...p,matricula:'33446',telefone:'65911111111'}));
});
