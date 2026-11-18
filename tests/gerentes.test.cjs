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
    Gerentes_Autorizados:[['matricula_gerente','nome','email_autorizado','filial_autorizada','ativo','atualizado_em'],
      ['12345','Gerente A','a@example.com','1','ATIVO',''],
      ['67890','Gerente B','b@example.com','2','INATIVO','']],
    Vendedores:[['matricula','nome','filial','codigo_filial','telefone_original','telefone_normalizado','situacao_funcional',
      'status_cadastro','origem_cadastro','criado_em','atualizado_em','observacoes','status_telefone'],
      ['11111','Vendedor A','1','','65998124567','','OK','ATIVO','','','','','VALIDADO'],
      ['22222','Vendedor B','2','','65998124568','','OK','ATIVO','','','','','VALIDADO']],
  };
  dados.Solicitacoes_Gerentes=[['solicitacao_id','criado_em','gerente_matricula','gerente_email','filial','vendedor_matricula',
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
  let email='a@example.com',verified=true,disabled=false;
  const mocks={
    UrlFetchApp:{fetch:()=>({getResponseCode:()=>200,getContentText:()=>JSON.stringify({users:[{
      localId:'synthetic-uid-123',email,emailVerified:verified,disabled,providerUserInfo:[{providerId:'google.com'}]
    }]})})},
    MART_V160_FIREBASE_API_KEY:'AIza'+'A'.repeat(26),
    obterPlanilhaVendedoresV153_:()=>planilha,
    obterAbaVendedoresV153_:()=>folha('Vendedores'),
    MART_V153_HEADERS:dados.Vendedores[0],
    Telefones,LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},
    Utilities:{formatDate,getUuid:()=> 'abc12345-aaaa-aaaa-aaaa-abcdef123456'},
    mart19_contexto_:()=>({grupo:{participantes:[],identificacoes:[],disponivel:true},
      registros:dados.Vendedores.slice(1).map(r=>({matricula:r[0],numero:r[4],statusTelefone:r[12],telefonesExtras:{}}))}),
    listarFiliaisV153_:()=>[['1','Cidade A'],['2','Cidade B']]
  };
  const keys=Object.keys(mocks);
  const api=new Function(...keys,fonte+'\nreturn {autorizar:mart20_autorizarGerente_,painel:mart20_consultarPainelGerente_,criar:mart20_criarSolicitacaoGerente_,listar:mart20_listarSolicitacoesGerentes_};')
    (...keys.map(k=>mocks[k]));
  const ator={email:'a@example.com',matricula:'12345',nome:'Gerente A',filial:'1'};
  return {dados,api,ator,formatDate,editarUsuario:(e,v=true,d=false)=>{email=e;verified=v;disabled=d}};
}
test('matrícula isolada não libera acesso; email e status precisam corresponder',()=>{
  const s=montar(),token='A'.repeat(300);
  assert.equal(s.api.autorizar(token,'12345').filial,'1');
  assert.throws(()=>s.api.autorizar(token,'67890'));
  s.editarUsuario('desconhecido@example.com');
  assert.throws(()=>s.api.autorizar(token,'12345'));
  s.editarUsuario('b@example.com');
  assert.throws(()=>s.api.autorizar(token,'67890'));
  s.editarUsuario('a@example.com',false);
  assert.throws(()=>s.api.autorizar(token,'12345'));
});
test('ranking e campanhas não revelam outra filial',()=>{
  const s=montar(),mes=s.formatDate(new Date(),'America/Sao_Paulo','yyyy-MM');
  const p=s.api.painel({mes,campanha:''},s.ator);
  assert.deepEqual(p.vendedores.map(v=>v.matricula),['11111']);
  assert.equal(p.totais.compartilhamentos,1);
  assert.deepEqual(p.campanhas,['camp1']);
});
test('solicitação fora da filial é bloqueada, CT e duplicação são preservados',()=>{
  const s=montar();
  const pedido={matriculaVendedor:'11111',telefone:'65998124567',tipo:'profissional',contratoTemporario:true};
  assert.throws(()=>s.api.criar({...pedido,matriculaVendedor:'22222'},s.ator));
  assert.equal(s.api.criar(pedido,s.ator).status,'CT_TEMPORARIO');
  assert.equal(s.api.criar(pedido,s.ator).duplicado,true);
  assert.equal(s.api.listar().pedidos.length,1);
  assert.equal(s.api.listar().pedidos[0].contratoTemporario,true);
});
