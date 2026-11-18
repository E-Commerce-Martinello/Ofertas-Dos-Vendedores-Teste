/**
 * Portal de Gerentes — acesso somente por filial autorizada, v1.6.19 (TESTE).
 * Este arquivo deve ser instalado no MESMO Apps Script administrativo.
 * A matrícula cadastrada identifica a filial; NÃO prova a identidade do visitante.
 * A consulta divulga somente dados limitados à filial e o pedido não altera cadastros.
 */
const MART20_GERENTES_CAB=['matricula_gerente','nome','filial_autorizada','ativo','atualizado_em','telefone'];
const MART20_GERENTES_CAB_LEGADO=MART20_GERENTES_CAB.slice(0,5);
const MART20_SOLICITACOES_CAB=['solicitacao_id','criado_em','gerente_matricula','origem_acesso',
  'filial','vendedor_matricula','vendedor_nome','telefone','tipo','contrato_temporario',
  'status','observacao','atualizado_em','processado_por'];
const MART20_TZ='America/Sao_Paulo';

function mart20_aba_(nome,cab,criar) {
  const ss=obterPlanilhaVendedoresV153_();
  let sh=ss.getSheetByName(nome);
  if(!sh && criar){
    sh=ss.insertSheet(nome);
    sh.getRange(1,1,1,cab.length).setValues([cab]);sh.setFrozenRows(1);
    sh.getRange(1,1,sh.getMaxRows(),cab.length).setNumberFormat('@');
  }
  if(!sh)return null;
  const atuais=sh.getRange(1,1,1,cab.length).getDisplayValues()[0].map(x=>String(x||'').trim());
  if(atuais.join('|')!==cab.join('|'))throw new Error('Cabeçalhos inesperados na aba '+nome+'. Nenhum dado alterado.');
  return sh;
}

// Executar manualmente como proprietário após backup. A migração de cinco para seis
// colunas adiciona somente o campo telefone, sem reescrever os registros existentes.
function prepararEstruturaGerentesV1619() {
  const principal=String(PropertiesService.getScriptProperties().getProperty('MART_V153_ADMIN_EMAIL')||'').trim().toLowerCase();
  const operador=String(Session.getEffectiveUser().getEmail()||'').trim().toLowerCase();
  if(!principal||operador!==principal)throw new Error('Execute com a conta principal autorizada.');
  const ss=obterPlanilhaVendedoresV153_();
  let gerentes=ss.getSheetByName('Gerentes_Autorizados');
  const existe=!!gerentes;
  let migrado=false;
  if(!gerentes)gerentes=mart20_aba_('Gerentes_Autorizados',MART20_GERENTES_CAB,true);
  else {
    const atual=gerentes.getRange(1,1,1,5).getDisplayValues()[0].map(x=>String(x||'').trim());
    if(atual.join('|')!==MART20_GERENTES_CAB_LEGADO.join('|'))
      throw new Error('Cabeçalhos inesperados em Gerentes_Autorizados. Nenhum dado alterado.');
    if(gerentes.getMaxColumns()<6)gerentes.insertColumnsAfter(gerentes.getMaxColumns(),6-gerentes.getMaxColumns());
    const coluna6=String(gerentes.getRange(1,6).getDisplayValue()||'').trim();
    if(!coluna6){gerentes.getRange(1,6).setValue('telefone');migrado=true;}
    else if(coluna6!=='telefone')throw new Error('Coluna F ocupada por outro campo. Migração interrompida.');
    gerentes.getRange(1,6,gerentes.getMaxRows(),1).setNumberFormat('@');
    mart20_aba_('Gerentes_Autorizados',MART20_GERENTES_CAB,false);
  }
  const pedidosExistiam=!!mart20_aba_('Solicitacoes_Gerentes',MART20_SOLICITACOES_CAB,false);
  mart20_aba_('Solicitacoes_Gerentes',MART20_SOLICITACOES_CAB,true);
  return [{aba:'Gerentes_Autorizados',existia:existe,migrado},
    {aba:'Solicitacoes_Gerentes',existia:pedidosExistiam}];
}

// Identificação simples: manter registro ativo e filial explícita, sem Google.
// A matrícula não é senha; qualquer pessoa que a conheça pode consultar esta filial.
function mart20_listarCadastroGerentes_(){
  const sh=mart20_aba_('Gerentes_Autorizados',MART20_GERENTES_CAB,false);
  if(!sh)return {gerentes:[]};
  const n=sh.getLastRow()-1;
  if(n>5000)throw new Error('Limite de gerentes excedido.');
  const dados=n?sh.getRange(2,1,n,MART20_GERENTES_CAB.length).getDisplayValues():[];
  return {gerentes:dados.filter(r=>String(r[0]||'').trim()).map(r=>({
    matricula:String(r[0]||'').trim(),nome:String(r[1]||'').trim(),
    filial:mart20_filial_(r[2]),ativo:String(r[3]||'').trim()==='ATIVO',
    revision:String(r[4]||''),telefone:String(r[5]||'').trim()
  })).sort((a,b)=>Number(a.filial)-Number(b.filial)||a.nome.localeCompare(b.nome,'pt-BR'))};
}

function mart20_salvarCadastroGerente_(p){
  const matricula=String(p.matricula||'').trim(),nome=String(p.nome||'').replace(/[\x00-\x1f\x7f]/g,' ').trim();
  const filial=mart20_filial_(p.filial);
  const telefoneInformado=String(p.telefone||'').trim();
  const telefone=telefoneInformado?Telefones.numero(telefoneInformado):'';
  const revision=String(p.revision||''),ativo=p.ativo===true;
  if(!/^\d{3,8}$/.test(matricula))throw new Error('Matrícula deve conter de 3 a 8 dígitos.');
  if(nome.length<2||nome.length>160||/^[=+@-]/.test(nome))throw new Error('Informe um nome válido (até 160 caracteres).');
  if(!filial)throw new Error('Selecione uma filial válida.');
  if(telefoneInformado&&!telefone)throw new Error('Se informar telefone, use celular brasileiro com DDD válido.');
  if(revision&&(!/^\d{4}-/.test(revision)||revision.length>45))
    throw new Error('Revisão do gerente inválida.');
  const lock=LockService.getScriptLock();lock.waitLock(15000);
  try{
    const ss=obterPlanilhaVendedoresV153_();
    // Não permitir códigos inventados: a filial deve existir na tabela oficial.
    const filiais=listarFiliaisV153_(ss);
    if(!filiais.some(r=>mart20_filial_(r[0])===filial))
      throw new Error('Filial não encontrada no cadastro de filiais.');
    const sh=mart20_aba_('Gerentes_Autorizados',MART20_GERENTES_CAB,false);
    if(!sh)throw new Error('Execute prepararEstruturaGerentesV1619 antes de cadastrar.');
    if(sh.getLastRow()>5001)throw new Error('Limite de gerentes excedido.');
    const n=sh.getLastRow()-1;
    const dados=n?sh.getRange(2,1,n,MART20_GERENTES_CAB.length).getDisplayValues():[];
    const encontrados=dados.map((r,i)=>String(r[0]||'').trim()===matricula?i:-1).filter(i=>i>=0);
    if(encontrados.length>1)throw new Error('Matrícula duplicada na base. Corrija antes de continuar.');
    const indice=encontrados[0],atual=indice===undefined?null:dados[indice];
    if(atual&&revision!==String(atual[4]||''))
      throw new Error('CONFLITO: este gerente foi alterado. Reabra o cadastro atualizado.');
    if(!atual&&revision)throw new Error('CONFLITO: este gerente foi excluído ou não existe.');
    if(atual&&String(p.matriculaOriginal||matricula)!==matricula)
      throw new Error('A matrícula existente não pode ser alterada.');
    const agora=new Date().toISOString();
    const linha=[matricula,nome,filial,ativo?'ATIVO':'INATIVO',agora,telefone];
    const destino=atual?indice+2:sh.getLastRow()+1;
    sh.getRange(destino,1,1,MART20_GERENTES_CAB.length).setNumberFormat('@').setValues([linha]);
    return {matricula,nome,filial,ativo,revision:agora,telefone};
  }finally{lock.releaseLock();}
}

function mart20_autorizarGerente_(matriculaInformada){
  const matricula=String(matriculaInformada??'').trim();
  if(!/^\d{3,8}$/.test(matricula))
    throw new Error('Informe a matrícula do gerente com 3 a 8 dígitos.');
  const sh=mart20_aba_('Gerentes_Autorizados',MART20_GERENTES_CAB,false);
  if(!sh||sh.getLastRow()<2)throw new Error('Matrícula não cadastrada para o Portal de Gerentes.');
  if(sh.getLastRow()>5000)throw new Error('Cadastro de gerentes excedeu o limite de consulta.');
  const dados=sh.getRange(2,1,sh.getLastRow()-1,MART20_GERENTES_CAB.length).getDisplayValues();
  const registros=dados.filter(r=>String(r[0]||'').trim()===matricula);
  if(registros.length!==1||String(registros[0][3]||'').trim().toUpperCase()!=='ATIVO')
    throw new Error('Matrícula não cadastrada ou desativada para acesso.');
  const r=registros[0],filial=mart20_filial_(r[2]);
  if(!filial)throw new Error('Filial do gerente não configurada.');
  return {email:'MATRICULA_'+matricula,matricula,nome:String(r[1]||'').trim().slice(0,160),
    filial,gerente:true,autenticado:false};
}

function mart20_filial_(valor){
  const txt=String(valor||'').trim();
  return /^\d{1,6}$/.test(txt)&&Number(txt)>0?String(Number(txt)):'';
}

function mart20_vendedoresFilial_(ss,filial){
  const sh=obterAbaVendedoresV153_(ss);
  const linhas=sh.getLastRow()>1?sh.getRange(2,1,sh.getLastRow()-1,MART_V153_HEADERS.length).getDisplayValues():[];
  const vistos=new Set();
  return linhas.filter(r=>{
    const id=String(r[0]||'').replace(/\D/g,'');
    if(!/^\d{3,8}$/.test(id)||mart20_filial_(r[2])!==filial||vistos.has(id))return false;
    vistos.add(id);return true;
  });
}

function mart20_mes_(valor){
  const mes=String(valor||'').trim();
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes))throw new Error('Selecione um mês válido.');
  const hoje=Utilities.formatDate(new Date(),MART20_TZ,'yyyy-MM');
  const pos=s=>Number(s.slice(0,4))*12+Number(s.slice(5,7));
  const delta=pos(hoje)-pos(mes);
  if(delta<0||delta>12)throw new Error('Consulte somente o mês atual ou os 12 meses anteriores.');
  return mes;
}

// Consulta limitada a 12.000 registros mais recentes por aba; reporta truncamento.
function mart20_eventosRecentes_(ss,nome,largura){
  const sh=ss.getSheetByName(nome);
  if(!sh||sh.getLastRow()<2)return {linhas:[],truncado:false};
  const total=sh.getLastRow()-1,limite=Math.min(total,12000);
  return {linhas:sh.getRange(sh.getLastRow()-limite+1,1,limite,largura).getValues(),
    truncado:total>limite};
}

function mart20_resumoAtividade_(ss,ids,mes,campanha){
  const meta=mart20_eventosRecentes_(ss,'Eventos_Campanhas',9);
  const porEvento=new Map(),campanhas=new Set();
  for(const r of meta.linhas){
    const ts=Number(r[2]);
    if(!Number.isFinite(ts)||ts<1||!ids.has(String(r[5]||'').replace(/\D/g,'')))continue;
    if(Utilities.formatDate(new Date(ts),MART20_TZ,'yyyy-MM')!==mes)continue;
    if(String(r[3])==='inicio_compartilhamento')porEvento.set(String(r[0]||''),String(r[6]||''));
  }
  const registros=mart20_eventosRecentes_(ss,'Eventos_Portal',7);
  const contagens=new Map(),ultima=new Map(),ofertas=new Set();
  for(const row of registros.linhas){
    if(String(row[6]||'')!=='inicio_compartilhamento')continue;
    const id=String(row[5]||'').replace(/\D/g,'');
    if(!ids.has(id))continue;
    const ts=Number(row[2]);
    if(!Number.isFinite(ts)||ts<1||Utilities.formatDate(new Date(ts),MART20_TZ,'yyyy-MM')!==mes)continue;
    const slug=porEvento.get(String(row[0]||''))||'';
    if(slug)campanhas.add(slug);
    if(campanha==='__sem__'&&slug)continue;
    if(campanha&&campanha!=='__sem__'&&slug!==campanha)continue;
    contagens.set(id,(contagens.get(id)||0)+1);
    ultima.set(id,Math.max(ultima.get(id)||0,ts));
    ofertas.add(String(row[3]||''));
  }
  return {contagens,ultima,ofertas:ofertas.size,campanhas:[...campanhas].sort(),
    truncado:meta.truncado||registros.truncado};
}

function mart20_consultarPainelGerente_(payload,acesso){
  const mes=mart20_mes_(payload.mes);
  const campanha=String(payload.campanha||'').trim();
  if(campanha&&campanha!=='__sem__'&&!/^[a-z0-9_-]{1,60}$/.test(campanha))
    throw new Error('Filtro de campanha inválido.');
  // Cache curto por filial/mês/campanha; autorização é validada antes de chegar aqui.
  // O perfil do gerente NÃO entra no cache compartilhado entre gerentes da filial.
  const chave='mart20_painel_'+acesso.filial+'_'+mes+'_'+(campanha||'@all');
  const cache=CacheService.getScriptCache();
  const perfil=localidade=>({nome:acesso.nome,matricula:acesso.matricula,
    filial:acesso.filial,localidade});
  try {
    const salvo=cache.get(chave);
    if(salvo){const dados=JSON.parse(salvo);
      return {...dados,gerente:perfil(dados.localidadeFilial||'')};
    }
  }catch(_){}
  const ss=obterPlanilhaVendedoresV153_();
  const vendedores=mart20_vendedoresFilial_(ss,acesso.filial);
  const ids=new Set(vendedores.map(r=>String(r[0]).replace(/\D/g,'')));
  const atividade=mart20_resumoAtividade_(ss,ids,mes,campanha);
  const links=ss.getSheetByName('Verificacao_Links');
  const porLink=new Map();
  if(links&&links.getLastRow()>1)for(const r of links.getRange(2,1,links.getLastRow()-1,7).getDisplayValues())
    porLink.set(String(r[0]||'').replace(/\D/g,''),String(r[2]||''));
  const ctx=mart19_contexto_(ss),porMatricula=new Map(ctx.registros.map(v=>[String(v.matricula),v]));
  const indice=Telefones.criarIndice(ctx.registros,ctx.grupo.participantes,ctx.grupo.identificacoes);
  const result=vendedores.map(r=>{
    const matricula=String(r[0]).replace(/\D/g,''),v=porMatricula.get(matricula);
    const fones=v?Telefones.avaliar(v,ctx.registros,ctx.grupo.participantes,
      ctx.grupo.identificacoes,ctx.grupo.disponivel,indice):[];
    const statusTelefone=fones.some(f=>f.conflito)?'CONFLITO':
      fones.some(f=>f.validado)?'VALIDADO':
      fones.some(f=>f.estado==='titularidade_pendente')?'TITULARIDADE_PENDENTE':'PENDENTE';
    const link=porLink.get(matricula)||'';
    return {matricula,nome:String(r[1]||'').slice(0,160),
      ativo:String(r[7]||'').toUpperCase()!=='INATIVO',
      situacaoFuncional:String(r[6]||'').slice(0,80),
      eCommerce:link==='redirecionamento'?'LINK_VERIFICADO':link==='inativo'?'LINK_NAO_LOCALIZADO':'INCONCLUSIVO',
      statusTelefone,compartilhamentos:atividade.contagens.get(matricula)||0,
      ultimaAtividade:atividade.ultima.get(matricula)||0};
  });
  const locais=listarFiliaisV153_(ss);
  const local=locais.find(r=>mart20_filial_(r[0])===acesso.filial);
  const localidadeFilial=String(local?.[2]||local?.[1]||'');
  const dados={
    localidadeFilial,mes,campanha,atualizadoEm:new Date().toISOString(),
    campanhas:atividade.campanhas,truncado:atividade.truncado,
    totais:{vendedores:result.length,ativos:result.filter(v=>v.ativo).length,
      usando:result.filter(v=>v.compartilhamentos>0).length,
      compartilhamentos:result.reduce((n,v)=>n+v.compartilhamentos,0),
      ofertas:atividade.ofertas},
    vendedores:result.sort((a,b)=>b.compartilhamentos-a.compartilhamentos||a.nome.localeCompare(b.nome,'pt-BR'))
  };
  try{cache.put(chave,JSON.stringify(dados),90);}catch(_){}
  return {...dados,gerente:perfil(localidadeFilial)};
}

function mart20_listarSolicitacoesGerentes_(){
  const sh=mart20_aba_('Solicitacoes_Gerentes',MART20_SOLICITACOES_CAB,false);
  if(!sh||sh.getLastRow()<2)return {pedidos:[]};
  const n=Math.min(250,sh.getLastRow()-1);
  const rows=sh.getRange(sh.getLastRow()-n+1,1,n,MART20_SOLICITACOES_CAB.length).getDisplayValues();
  return {pedidos:rows.reverse().filter(r=>r[0]).map(r=>({
    id:r[0],criadoEm:r[1],gerenteMatricula:r[2],filial:r[4],matricula:r[5],
    nome:r[6],telefone:r[7],tipo:r[8],contratoTemporario:r[9]==='SIM',
    status:r[10],observacao:r[11],revision:r[12]
  }))};
}

function mart20_criarSolicitacaoGerente_(p,acesso){
  const matricula=String(p.matriculaVendedor||'').replace(/\D/g,'');
  const ct=p.contratoTemporario===true;
  // CT Temporário é apenas classificação para a equipe; não coleta telefone.
  const numero=ct?'':Telefones.numero(String(p.telefone||''));
  const tipo=ct?'':String(p.tipo||'').toLowerCase();
  if(!/^\d{3,8}$/.test(matricula))
    throw new Error('Informe a matrícula do vendedor.');
  if(!ct&&(!numero||!['pessoal','profissional'].includes(tipo)))
    throw new Error('Informe um celular com DDD válido e o tipo de telefone.');
  const observacao=ct?'':String(p.observacao||'').replace(/[\x00-\x1f\x7f]+/g,' ').trim().slice(0,300);
  if(/^[=+\-@]/.test(observacao))throw new Error('Observação inválida.');
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    const ss=obterPlanilhaVendedoresV153_();
    const matches=mart20_vendedoresFilial_(ss,acesso.filial).filter(r=>String(r[0])===matricula);
    if(matches.length!==1)throw new Error('Este vendedor não pertence à filial autorizada.');
    const sh=mart20_aba_('Solicitacoes_Gerentes',MART20_SOLICITACOES_CAB,false);
    if(!sh)throw new Error('Fila de solicitações indisponível; procure o administrador.');
    const n=sh.getLastRow()>1?Math.min(1000,sh.getLastRow()-1):0;
    const atuais=n?sh.getRange(sh.getLastRow()-n+1,1,n,MART20_SOLICITACOES_CAB.length).getDisplayValues():[];
    const abertas=atuais.filter(r=>['PENDENTE','CT_TEMPORARIO','EM_ANALISE'].includes(String(r[10]||'')));
    const duplicado=abertas.find(r=>String(r[5])===matricula&&
      (ct?String(r[9])==='SIM':String(r[9])!=='SIM'&&String(r[7])===numero&&r[8]===tipo));
    if(duplicado)return {registrado:false,duplicado:true,id:String(duplicado[0])};
    const hoje=Utilities.formatDate(new Date(),MART20_TZ,'yyyy-MM-dd');
    const totalDia=atuais.filter(r=>{
      if(r[2]!==acesso.matricula||r[3]!==acesso.email)return false;
      const ts=new Date(String(r[1]||''));
      return !isNaN(ts.getTime())&&Utilities.formatDate(ts,MART20_TZ,'yyyy-MM-dd')===hoje;
    }).length;
    if(totalDia>=40)throw new Error('Limite diário de solicitações atingido. Procure o administrador.');
    const agora=new Date().toISOString();
    const id=Utilities.getUuid();
    const row=[id,agora,acesso.matricula,acesso.email,acesso.filial,matricula,
      String(matches[0][1]||'').slice(0,160),numero,tipo,ct?'SIM':'NAO',
      ct?'CT_TEMPORARIO':'PENDENTE',observacao,agora,''];
    sh.getRange(sh.getLastRow()+1,1,1,MART20_SOLICITACOES_CAB.length)
      .setNumberFormat('@').setValues([row]);
    return {registrado:true,duplicado:false,id,status:row[10]};
  }finally{lock.releaseLock();}
}

function mart20_atualizarSolicitacaoGerente_(p,ator){
  const id=String(p.id||''),revision=String(p.revision||''),status=String(p.status||'');
  if(!/^[A-Za-z0-9-]{10,50}$/.test(id)||!['CONCLUIDO','REJEITADO'].includes(status))
    throw new Error('Pedido ou situação inválidos.');
  const lock=LockService.getScriptLock();lock.waitLock(15000);
  try {
    const sh=mart20_aba_('Solicitacoes_Gerentes',MART20_SOLICITACOES_CAB,false);
    if(!sh||sh.getLastRow()<2)throw new Error('Solicitação não encontrada.');
    const rows=sh.getRange(2,1,sh.getLastRow()-1,MART20_SOLICITACOES_CAB.length).getDisplayValues();
    const encontrados=rows.map((r,i)=>String(r[0])===id?i:-1).filter(i=>i>=0);
    if(encontrados.length!==1)throw new Error('Solicitação ausente ou duplicada.');
    const linha=rows[encontrados[0]];
    if(linha[12]!==revision||!['PENDENTE','CT_TEMPORARIO','EM_ANALISE'].includes(linha[10]))
      throw new Error('CONFLITO: solicitação modificada. Atualize a lista antes de continuar.');
    const agora=new Date().toISOString();
    sh.getRange(encontrados[0]+2,11,1,4).setNumberFormat('@').setValues([[status,linha[11],agora,ator]]);
    return {id,status,revision:agora};
  }finally{lock.releaseLock();}
}
