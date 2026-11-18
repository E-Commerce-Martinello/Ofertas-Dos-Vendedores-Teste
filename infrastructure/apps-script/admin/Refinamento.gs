/** v1.6.19: preparado para implantação, sem instalação automática. */
const MART19_TABELAS = {
  core:['Vendedores','Filiais','Telefones_Vendedores','WhatsApp_Atual','Identificacoes_Manuais','Solicitacoes_Telefone','Verificacao_Links','Solicitacoes_Gerentes','Gerentes_Autorizados'],
  contatos:['Config_Contatos','Historico_Contatos'], campanhas:['Config_Campanhas'],
  dashboard:['Eventos_Portal','Eventos_Campanhas'], auditoria:['Auditoria_Admin']
};
function mart19_hash_(v) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify(v))
    .map(b=>('0'+((b+256)%256).toString(16)).slice(-2)).join('');
}
function mart19_ler_(ss,nome,limite) {
  const sh=ss.getSheetByName(nome); if(!sh||!sh.getLastRow())return [];
  const n=sh.getLastRow(),cols=sh.getLastColumn();
  if(n>20000&&!limite)throw new Error('Tabela excede o limite de leitura segura: '+nome);
  const inicio=limite?Math.max(2,n-limite+1):1;
  if(inicio>n)return [sh.getRange(1,1,1,cols).getDisplayValues()[0]];
  const linhas=sh.getRange(inicio,1,n-inicio+1,cols).getDisplayValues();
  return inicio>1?[sh.getRange(1,1,1,cols).getDisplayValues()[0]].concat(linhas):linhas;
}
function mart19_revisoes_(forcar) {
  const lock=LockService.getScriptLock();lock.waitLock(15000);
  try {
    const props=PropertiesService.getScriptProperties();
    let estado=JSON.parse(props.getProperty('MART19_REVISOES')||'{}');
    const verificar=forcar||Date.now()-Number(estado.verificadoEm||0)>300000;
    if(verificar){
      const ss=obterPlanilhaVendedoresV153_();
      for(const dominio of Object.keys(MART19_TABELAS)){
        const dados=MART19_TABELAS[dominio].map(n=>mart19_ler_(ss,n,['dashboard','auditoria','contatos'].includes(dominio)?500:0));
        estado[dominio]=mart19_hash_(dados);
      }
      estado.acessos=mart19_hash_([obterAdministradoresV161_(),obterUidsAdministradoresV169_()]);
      estado.verificadoEm=Date.now();props.setProperty('MART19_REVISOES',JSON.stringify(estado));
    }
    return estado;
  } finally {lock.releaseLock();}
}
function mart19_invalidar_() {
  // Invalidação antes da gravação: protege também o caso de uma operação antiga falhar parcialmente.
  PropertiesService.getScriptProperties().deleteProperty('MART19_REVISOES');
}
function mart19_notificar_() {
  const props=PropertiesService.getScriptProperties();
  if(props.getProperty('MART19_PUSH_ATIVO')!=='true')return;
  const ambiente=props.getProperty('MART_AMBIENTE');
  const destinos={TESTE:'https://ofertas-do-vendedor-default-rtdb.firebaseio.com',OFICIAL:'https://portal-de-oferta-default-rtdb.firebaseio.com'};
  if(!destinos[ambiente])throw new Error('MART_AMBIENTE inválido.');
  const caminho='adminSync'+(ambiente==='TESTE'?'_TESTE':'');
  const r=UrlFetchApp.fetch(destinos[ambiente]+'/'+caminho+'.json',{
    method:'put',contentType:'application/json',muteHttpExceptions:true,
    headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},
    payload:JSON.stringify({revision:Utilities.getUuid(),updatedAt:Date.now()})
  });
  if(r.getResponseCode()!==200)throw new Error('Notificação indisponível; modo periódico permanece ativo.');
}
function mart19_depoisEscrita_() {
  mart19_invalidar_();
  try{mart19_notificar_();}catch(e){console.warn('MART19_PUSH_INDISPONIVEL');}
}
function mart19_aposEdicao(e) {
  if(!e||!e.source||e.source.getId()!==MART_V153_TEST_SHEET_ID)return;
  mart19_depoisEscrita_();
}
// Executar somente após aprovação: instala dois acionadores, sem migrar registros.
function instalarAcionadoresRefinamento() {
  const existentes=ScriptApp.getProjectTriggers();
  for(const tipo of ['onEdit','onChange']){
    const evento=tipo==='onEdit'?ScriptApp.EventType.ON_EDIT:ScriptApp.EventType.ON_CHANGE;
    if(!existentes.some(t=>t.getHandlerFunction()==='mart19_aposEdicao'&&t.getEventType()===evento))
      ScriptApp.newTrigger('mart19_aposEdicao').forSpreadsheet(MART_V153_TEST_SHEET_ID)[tipo]().create();
  }
}
// Diagnóstico local no editor; não expõe dados ou credenciais ao navegador.
function diagnosticarBackendV1619() {
  const ss=obterPlanilhaVendedoresV153_();
  const fones=mart1618_abaFones_(false);
  return {
    versao:'1.6.19',
    ambiente:PropertiesService.getScriptProperties().getProperty('MART_AMBIENTE')||'NAO_CONFIGURADO',
    planilhaEncontrada:!!ss,
    abaTelefonesPronta:!!fones,
    sheetsAvancado:typeof Sheets!=='undefined',
    pushAtivo:PropertiesService.getScriptProperties().getProperty('MART19_PUSH_ATIVO')==='true'
  };
}
// Preparação opcional explícita: cria SOMENTE a aba vazia, sem alterar registros.
function prepararAbaTelefonesV1619() {
  const existente=mart1618_abaFones_(false);
  if(existente)return {situacao:'existente',registros:Math.max(0,existente.getLastRow()-1)};
  const criada=mart1618_abaFones_(true);
  return {situacao:'criada',registros:Math.max(0,criada.getLastRow()-1)};
}

function mart19_contexto_(ss) {
  const base=mart19_ler_(ss,'Vendedores');
  if(base.length&&base[0].slice(0,13).join('|')!==MART_V153_HEADERS.join('|'))throw new Error('Cabeçalho Vendedores divergente.');
  const extras=mart19_ler_(ss,'Telefones_Vendedores');
  if(extras.length&&extras[0].slice(0,8).join('|')!==MART1618_FONES_CAB.join('|'))throw new Error('Cabeçalho Telefones_Vendedores divergente.');
  const grupo=mart164_listar_();
  // Mapas por matrícula evitam varrer as tabelas inteiras para cada vendedor.
  const porMatricula=linhas=>{
    const mapa=new Map();
    for(const linha of linhas.slice(1)){
      const id=String(linha[0]||'');if(!id)continue;
      if(!mapa.has(id))mapa.set(id,[]);
      mapa.get(id).push(linha);
    }
    return mapa;
  };
  const basePorMatricula=porMatricula(base),extrasPorMatricula=porMatricula(extras);
  let registros=base.slice(1).filter(r=>r[0]).map(r=>{
    const f=(extrasPorMatricula.get(String(r[0]))||[])[0];
    return {matricula:r[0],numero:r[4],statusTelefone:r[12],
      ativo:r[7]!=='INATIVO'&&!/INATIV|DESLIG|DEMIT|REMOVID|PENDENTE_VALIDACAO/.test(String(r[6]||'')),
      telefonesExtras:f?{pessoal:f[1],statusPessoal:f[2],profissional:f[4],statusProfissional:f[5]}:null};
  });
  const pedidos=mart19_ler_(ss,'Solicitacoes_Telefone').slice(1).map(r=>({matricula:r[2],telefone:r[3],tipoTelefone:r[6]}));
  registros=Telefones.associarSolicitacoes(registros,pedidos,grupo.participantes,grupo.identificacoes);
  return {base,extras,basePorMatricula,extrasPorMatricula,grupo,registros,pedidos,
    evidencia:mart19_hash_([registros.map(v=>[v.matricula,Telefones.campos(v)]),grupo])};
}
function mart19_revisionVendedor_(ctx,matricula) {
  const id=String(matricula);
  return mart19_hash_([ctx.basePorMatricula.get(id)||[],ctx.extrasPorMatricula.get(id)||[],ctx.evidencia]);
}
function mart19_snapshot_(p,acesso) {
  const revisions=mart19_revisoes_(false),known=p.revisions||{},dados={},ss=obterPlanilhaVendedoresV153_();
  const dominios=['core','contatos','campanhas','dashboard','auditoria','acessos'];
  for(const dominio of dominios){
    if(['auditoria','acessos'].includes(dominio)&&!acesso.proprietario)continue;
    if(known[dominio]===revisions[dominio])continue;
    if(dominio==='core'){
      const ctx=mart19_contexto_(ss);
      dados.core={linhas:ctx.base,filiais:listarFiliaisV153_(ss),extras:ctx.registros.map(v=>{const e=v.telefonesExtras||{};return [v.matricula,e.pessoal||'',e.statusPessoal||'PENDENTE','NAO',e.profissional||'',e.statusProfissional||'PENDENTE','NAO',''];}),grupo:ctx.grupo,
        links:mart19_ler_(ss,'Verificacao_Links').slice(1).map(r=>({matricula:r[0],url:r[1],status:r[2],http:r[3],destino:r[4],verificadoEm:r[5],detalhe:r[6]})),
        pedidos:mart1613_listarSolicitacoesTelefone_().pedidos||[],
        revisoesIdentificacoes:Object.fromEntries(ctx.grupo.participantes.map(p=>[p.telefone,mart19_hash_(ctx.grupo.identificacoes.filter(i=>i.telefone===p.telefone))])),
        revisoes:Object.fromEntries(ctx.registros.map(v=>[v.matricula,mart19_revisionVendedor_(ctx,v.matricula)]))};
      if(typeof mart20_listarSolicitacoesGerentes_==='function')
        dados.core.solicitacoesGerentes=mart20_listarSolicitacoesGerentes_();
    }else if(dominio==='contatos'){
      const config=mart169_listarConfigContatos_();config.revision=mart19_hash_([config.linkGrupo,config.mensagemConvite]);
      const sh=ss.getSheetByName('Historico_Contatos');
      const rows=sh&&sh.getLastRow()>1?sh.getRange(Math.max(2,sh.getLastRow()-499),1,Math.min(500,sh.getLastRow()-1),10).getValues():[];
      dados.contatos={config,contatos:rows.map(r=>({matricula:String(r[1]),ofertaId:String(r[3]),status:String(r[4]),confirmadoEm:r[7] instanceof Date?r[7].toISOString():String(r[7]||'')}))};
    }else if(dominio==='campanhas')dados.campanhas=mart1614_listarCampanhas_();
    else if(dominio==='acessos')dados.acessos=listarAdministradoresV161_();
    else dados[dominio]={alterado:true};
  }
  return {versao:'1.6.19',revisions,dados,verificadoEm:new Date().toISOString(),push:PropertiesService.getScriptProperties().getProperty('MART19_PUSH_ATIVO')==='true'};
}
function mart19_cells_(sheetId,row,values){
  return {updateCells:{start:{sheetId,rowIndex:row-1,columnIndex:0},rows:[{values:values.map(v=>({userEnteredValue:{stringValue:String(v??'')},userEnteredFormat:{numberFormat:{type:'TEXT'}}}))}],fields:'userEnteredValue,userEnteredFormat.numberFormat'}};
}
function mart19_salvarVendedor_(p,ator) {
  if(typeof Sheets==='undefined')throw new Error('Habilite o serviço Google Sheets API antes de usar a edição v1.6.19.');
  const m=String(p.matricula||''),nome=String(p.nome||'').trim(),filial=String(p.filial||'');
  if(!/^\d{3,5}$/.test(m)||!nome||nome.length>180||!/^\d{1,6}$/.test(filial)||Number(filial)===0)throw new Error('Confira matrícula, nome e filial.');
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    const ss=obterPlanilhaVendedoresV153_(),ctx=mart19_contexto_(ss);
    const rows=ctx.base.map((r,i)=>r[0]===m?i:-1).filter(i=>i>0);
    const novo=p.novo===true;
    if((novo&&rows.length)||(!novo&&rows.length!==1))throw new Error('Matrícula ausente ou duplicada. Reabra o cadastro.');
    if(!novo&&p.revision!==mart19_revisionVendedor_(ctx,m))throw new Error('CONFLITO: o cadastro ou suas associações mudaram. Seus campos foram preservados; reabra após revisar.');
    const idx=rows[0],anterior=novo?null:ctx.base[idx];
    const frows=ctx.extras.map((r,i)=>r[0]===m?i:-1).filter(i=>i>0);
    if(frows.length>1)throw new Error('Telefones duplicados para a matrícula. Revisão necessária.');
    const antigo=frows.length?ctx.extras[frows[0]]:null;
    const entradas=[p.telefonePessoal,p.telefoneProfissional];
    for(let i=0;i<2;i++){
      const valor=entradas[i],historico=antigo?antigo[i===0?1:4]:'';
      // Campo inválido histórico inalterado é preservado, nunca convertido em vazio.
      if(valor!==historico&&Telefones.erro(valor))throw new Error(Telefones.erro(valor));
    }
    const pessoal=Telefones.numero(entradas[0])||entradas[0],profissional=Telefones.numero(entradas[1])||entradas[1];
    if(pessoal&&pessoal===profissional)throw new Error('Não repita o mesmo número nos dois campos.');
    const status=(raw,tipo,col)=>{
      if(!raw)return 'PENDENTE';
      if(antigo&&raw===antigo[col]&&antigo[col+1]==='VALIDADO')return 'VALIDADO';
      return p['confirmar'+tipo]===true?'VALIDADO':'PENDENTE';
    };
    const candidato={matricula:m,numero:anterior?anterior[4]:'',statusTelefone:anterior?anterior[12]:'PENDENTE',
      telefonesExtras:{pessoal,statusPessoal:status(pessoal,'Pessoal',1),profissional,statusProfissional:status(profissional,'Profissional',4)}};
    const base=ctx.registros.filter(v=>v.matricula!==m).concat(candidato);
    const avaliados=Telefones.avaliar(candidato,base,ctx.grupo.participantes,ctx.grupo.identificacoes);
    for(const tipo of ['pessoal','profissional']){
      const f=avaliados.find(x=>x.tipo===tipo);
      const anteriorNumero=antigo?antigo[tipo==='pessoal'?1:4]:'';
      if(f?.conflito&&f.original!==anteriorNumero)throw new Error('Número associado a outra pessoa. Resolva o conflito antes de salvar.');
    }
    const agora=new Date().toISOString();
    const linha=anterior?anterior.slice(0,13):[m,nome,filial,'','','','PENDENTE_VALIDACAO','ATIVO','CADASTRO_MANUAL',agora,agora,'','PENDENTE'];
    linha[1]=nome;linha[2]=String(Number(filial));linha[7]=p.ativo===false?'INATIVO':(linha[7]==='INATIVO'?'ATIVO':linha[7]);linha[10]=agora;linha[11]=String(p.observacoes||'').slice(0,2000);
    const validacao=tipo=>avaliados.find(f=>f.tipo===tipo)?.validado?'VALIDADO':'PENDENTE';
    const extra=[m,pessoal,validacao('pessoal'),antigo?.[3]||'NAO',profissional,validacao('profissional'),antigo?.[6]||'NAO',agora];
    const sh=obterAbaVendedoresV153_(ss),fs=ss.getSheetByName(MART1618_FONES_ABA);
    // Preparar a aba vazia é uma dependência de implantação, nunca criá-la escondido nesta gravação.
    if(!fs)throw new Error('A aba Telefones_Vendedores precisa ser preparada antes da edição. Nenhum dado salvo.');
    const row=novo?sh.getLastRow()+1:idx+1,frow=frows.length?frows[0]+1:fs.getLastRow()+1;
    const requests=[];
    if(row>sh.getMaxRows())requests.push({appendDimension:{sheetId:sh.getSheetId(),dimension:'ROWS',length:row-sh.getMaxRows()}});
    if(frow>fs.getMaxRows())requests.push({appendDimension:{sheetId:fs.getSheetId(),dimension:'ROWS',length:frow-fs.getMaxRows()}});
    requests.push(mart19_cells_(sh.getSheetId(),row,linha),mart19_cells_(fs.getSheetId(),frow,extra));
    Sheets.Spreadsheets.batchUpdate({requests},ss.getId());
    return {matricula:m,atualizadoEm:agora,camposAlterados:['cadastro','telefones'],legadoPreservado:true};
  }finally{lock.releaseLock();}
}
