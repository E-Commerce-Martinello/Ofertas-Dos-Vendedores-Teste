/** Coletor público v1.6.19, projeto Apps Script separado da API administrativa.
 * Script Properties obrigatória: MART_EVT_SHEET_ID.
 * Opcional para Cloudflare Pages: MART_EVT_PAGES_ORIGIN (origem HTTPS exata).
 * Registra apenas eventos e responde consultas limitadas sem dados pessoais.
 */
const MART_EVT_SHEET_ID = String(PropertiesService.getScriptProperties().getProperty('MART_EVT_SHEET_ID') || '').trim();
const MART_EVT_ABA = 'Eventos_Portal';
const MART_EVT_CABECALHOS = [
  'registro_id','registrado_em','iniciado_em_ms','oferta_id',
  'titulo_oferta','matricula','tipo'
];
const MART_EVT_MAX_DIARIO = 2000;

function configurarColetorEventosV1632() {
  // Executar UMA vez no editor, antes de implantar, com sua conta Google.
  if(!/^[A-Za-z0-9_-]{25,}$/.test(MART_EVT_SHEET_ID)) throw new Error('Defina MART_EVT_SHEET_ID nas Propriedades do script.');
  const aba = martEvtAba_();
  console.log('Coletor configurado: ' + aba.getName() + '. A planilha configurada está acessível.');
}

function doGet(e) {
  const p = e && e.parameter || {};
  if(String(p.action||'')==='consultarCampanha') return mart1614_consultarCampanha_(p);
  if(String(p.action||'')==='rankingOfertas') return mart171_consultarRanking_(p);
  if (String(p.action||'') === 'consultarMatricula') return mart1618_consultarMatricula_(p);
  if (String(p.action||'') !== 'consultarTelefone') {
    return ContentService.createTextOutput('Martinello: coletor de eventos e consulta limitada de status.');
  }
  // JSONP sem dados pessoais: retorna somente um booleano, jamais telefone ou nome.
  const rubi = String(p.matricula||'');
  const requestId = String(p.requestId||'');
  if (!/^\d{3,5}$/.test(rubi) || !/^q_[A-Za-z0-9_-]{8,48}$/.test(requestId)) {
    return ContentService.createTextOutput('/* consulta inválida */')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  let validado = false, disponivel=true;
  try { validado = martEvtTelefoneValidadoCadastro_(rubi); }
  catch (erro) { disponivel=false; console.warn('Consulta telefone indisponível:',String(erro)); }
  const dados = JSON.stringify({requestId,validado,disponivel});
  return ContentService.createTextOutput('window.MartinelloTelefoneReceber&&window.MartinelloTelefoneReceber('+dados+');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function doPost(e) {
  try {
    const p = (e && e.parameter) || {};
    if (p.action === 'registrarVisita') return martEvtRegistrarVisita_(p);
    if (p.action === 'registrarClique') return mart1614_registrarClique_(p);
    if (p.action === 'solicitarTelefone') return martEvtSolicitarTelefone_(p);
    if (p.action !== 'registrar') throw new Error('Acao nao permitida');
    // Este campo não autentica a origem, mas evita envios acidentais de outros sites.
    // Qualquer cliente pode falsificá-lo; jamais tratar os registros como prova de envio.
    if (!martEvtOrigemPermitida_(p.origem)) {
      throw new Error('Origem informada invalida');
    }
    const oferta = String(p.ofertaId || '').trim();
    const rubi = String(p.matricula || '').trim();
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(oferta)) throw new Error('Oferta invalida');
    if (!/^\d{3,5}$/.test(rubi)) throw new Error('Matricula invalida');
    const titulo = String(p.tituloOferta || 'Oferta').replace(/[\r\n\t\u0000-\u001f]/g, ' ').trim().slice(0, 100);
    const agora = new Date();
    const dia = Utilities.formatDate(agora, 'America/Sao_Paulo', 'yyyyMMdd');
    const dezMin = Math.floor(agora.getTime() / 600000);
    const cacheKey = ('ev_' + oferta + '_' + rubi + '_' + dezMin).slice(0, 240);
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(5000)) throw new Error('Coletor ocupado');
    try {
      const cache = CacheService.getScriptCache();
      if (cache.get(cacheKey)) return martEvtResposta_({ok:true, gravado:false, repetido:true});
      const props = PropertiesService.getScriptProperties();
      const dataAtual = props.getProperty('MART_EVT_DIA');
      const total = dataAtual === dia ? Number(props.getProperty('MART_EVT_TOTAL') || '0') : 0;
      if (total >= MART_EVT_MAX_DIARIO) throw new Error('Limite diario de eventos atingido');
      const sheet = martEvtAba_();
      const id = Utilities.getUuid();
      // Toda informação temporal é gerada no servidor. Evitar fórmulas nos campos texto.
      const tituloSeguro = /^[=+\-@]/.test(titulo) ? '\'' + titulo : titulo;
      sheet.appendRow([id, agora, agora.getTime(), oferta, tituloSeguro, '\'' + rubi, 'inicio_compartilhamento']);
      mart1614_registrarMeta_({id:id,agora:agora,tipo:'inicio_compartilhamento',oferta:oferta,rubi:rubi,
        campanha:mart1614_slug_(p.campanha)||mart1614_campanhaAtual_(),origem:'portal',titulo:titulo});
      cache.put(cacheKey, '1', 600);
      props.setProperties({MART_EVT_DIA:dia, MART_EVT_TOTAL:String(total+1)});
      return martEvtResposta_({ok:true, gravado:true});
    } finally { lock.releaseLock(); }
  } catch (err) {
    console.warn('Evento rejeitado: ' + String(err && err.message || err));
    return martEvtResposta_({ok:false, gravado:false});
  }
}

function martEvtAba_() {
  const ss = SpreadsheetApp.openById(MART_EVT_SHEET_ID);
  let aba = ss.getSheetByName(MART_EVT_ABA);
  if (!aba) {
    aba = ss.insertSheet(MART_EVT_ABA);
    aba.getRange(1,1,1,MART_EVT_CABECALHOS.length).setValues([MART_EVT_CABECALHOS]);
    aba.setFrozenRows(1);
    aba.getRange('D:G').setNumberFormat('@');
  } else {
    const cabecalho = aba.getRange(1,1,1,MART_EVT_CABECALHOS.length).getDisplayValues()[0];
    if (cabecalho.join('|') !== MART_EVT_CABECALHOS.join('|')) {
      throw new Error('Cabecalho de Eventos_Portal divergente; nenhuma gravacao foi feita');
    }
  }
  return aba;
}

function martEvtResposta_(dados) {
  return ContentService.createTextOutput(JSON.stringify(dados)).setMimeType(ContentService.MimeType.JSON);
}

// ================================================================
// v1.6.13 — status de telefone e solicitações PENDENTES.
// O portal não pode ler nomes, números ou cadastros.
// Nenhum pedido altera automaticamente a aba Vendedores.
// ================================================================
const MART_EVT_FONE_ABA = 'Solicitacoes_Telefone';
const MART_EVT_FONE_HEADERS = ['solicitacao_id','criado_em','matricula','telefone_informado','status','origem','tipo_telefone','declarado_no_grupo'];

function martEvtCelular_(n) { return Telefones.valido(n); }

function martEvtTelefoneValidadoCadastro_(rubi) {
  // A consulta pública retorna apenas um booleano. Cache curto evita leitura pesada
  // a cada abertura do portal e permite atualização após mudanças nos cadastros.
  const cache=CacheService.getScriptCache(),chave='mart19_fone_'+rubi;
  const salvo=cache.get(chave);
  if(salvo==='1'||salvo==='0')return salvo==='1';
  const ss=SpreadsheetApp.openById(MART_EVT_SHEET_ID);
  const ler=(nome,colunas)=>{
    const sh=ss.getSheetByName(nome);
    if(!sh||sh.getLastRow()<2)return [];
    if(sh.getLastRow()>20000)throw new Error('Base excede o limite seguro de consulta');
    return sh.getRange(2,1,sh.getLastRow()-1,Math.min(colunas,sh.getLastColumn())).getDisplayValues();
  };
  const rows=ler('Vendedores',13),extras=ler('Telefones_Vendedores',8);
  const entrada=rows.filter(r=>r[0]===rubi);
  if(entrada.length!==1)return false;
  const grupo=ler('WhatsApp_Atual',2).map(r=>({telefone:r[0],nome:r[1]}));
  const manuais=ler('Identificacoes_Manuais',4).map(r=>({telefone:r[0],tipo:r[2],matricula:r[3]}));
  const porMatricula=new Map(extras.map(r=>[r[0],r]));
  const base=rows.map(r=>{
    const f=porMatricula.get(r[0])||[];
    return {matricula:r[0],numero:r[4],statusTelefone:r[12],
      telefonesExtras:{pessoal:f[1]||'',statusPessoal:f[2],profissional:f[4]||'',statusProfissional:f[5]}};
  });
  let v=base.find(v=>v.matricula===rubi);
  let selecionado=Telefones.preferido(Telefones.avaliar(v,base,grupo,manuais));
  if(!selecionado){
    const pedidos=ler('Solicitacoes_Telefone',7).filter(r=>r[2]===rubi)
      .map(r=>({matricula:r[2],telefone:r[3],tipoTelefone:r[6]}));
    if(pedidos.length){
      const associados=Telefones.associarSolicitacoes(base,pedidos,grupo,manuais);
      v=associados.find(x=>x.matricula===rubi);
      selecionado=Telefones.preferido(Telefones.avaliar(v,associados,grupo,manuais));
    }
  }
  const aprovado=!!selecionado;
  cache.put(chave,aprovado?'1':'0',60);
  return aprovado;
}

function martEvtOrigemPermitida_(origem) {
  const valor=String(origem||'').trim();
  if(valor==='https://e-commerce-martinello.github.io')return true;
  const pages=String(PropertiesService.getScriptProperties().getProperty('MART_EVT_PAGES_ORIGIN')||'').trim().replace(/\/$/,'');
  return /^https:\/\/[a-z0-9-]+\.pages\.dev$/i.test(pages)&&valor===pages;
}

function martEvtAbaFone_() {
  const ss=SpreadsheetApp.openById(MART_EVT_SHEET_ID);
  let sh=ss.getSheetByName(MART_EVT_FONE_ABA);
  if(!sh){
    sh=ss.insertSheet(MART_EVT_FONE_ABA);
    sh.getRange(1,1,1,MART_EVT_FONE_HEADERS.length).setValues([MART_EVT_FONE_HEADERS]);
    sh.setFrozenRows(1);
    sh.getRange('C:D').setNumberFormat('@');
  } else {
    const got=sh.getRange(1,1,1,6).getDisplayValues()[0];
    if(got.join('|')!==MART_EVT_FONE_HEADERS.slice(0,6).join('|')) throw new Error('Cabecalho solicitacoes invalido');
    const novo=sh.getRange(1,7,1,2).getDisplayValues()[0];
    if(novo.every(x=>!x))sh.getRange(1,7,1,2).setValues([MART_EVT_FONE_HEADERS.slice(6)]);
    else if(novo.join('|')!==MART_EVT_FONE_HEADERS.slice(6).join('|'))throw new Error('Colunas extras divergentes');
  }
  return sh;
}

function martEvtSolicitarTelefone_(p) {
  if(!martEvtOrigemPermitida_(p.origem)) return martEvtResposta_({ok:false});
  const rubi=String(p.matricula||'').trim();
  const fone=Telefones.numero(String(p.telefone||''));
  const tipo=String(p.tipoTelefone||'');
  if(!['pessoal','profissional'].includes(tipo))return martEvtResposta_({ok:false});
  const declaraGrupo=String(p.declaraGrupo)==='true'?'SIM':'NAO';
  if(!/^\d{3,5}$/.test(rubi)||!martEvtCelular_(fone))return martEvtResposta_({ok:false});
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(5000))return martEvtResposta_({ok:false});
  try {
    // Vendedor já validado também pode solicitar um segundo número (pessoal/profissional).
    const agora=new Date(),dia=Utilities.formatDate(agora,'America/Sao_Paulo','yyyyMMdd');
    const props=PropertiesService.getScriptProperties(),cache=CacheService.getScriptCache();
    const chave='fone_'+rubi+'_'+fone;
    if(cache.get(chave))return martEvtResposta_({ok:true,repetido:true});
    const atual=props.getProperty('MART_EVT_FONE_DIA')===dia?Number(props.getProperty('MART_EVT_FONE_TOTAL')||'0'):0;
    if(atual>=250)throw new Error('Limite diario de solicitacoes');
    const sh=martEvtAbaFone_();
    const telefoneTexto='\''+fone, rubiTexto='\''+rubi;
    sh.appendRow([Utilities.getUuid(),agora,rubiTexto,telefoneTexto,'PENDENTE','portal',tipo,declaraGrupo]);
    cache.put(chave,'1',86400);
    props.setProperties({MART_EVT_FONE_DIA:dia,MART_EVT_FONE_TOTAL:String(atual+1)});
    return martEvtResposta_({ok:true,gravado:true});
  } catch(e){console.warn('Solicitacao recusada',String(e));return martEvtResposta_({ok:false});}
  finally {lock.releaseLock();}
}

function martEvtRegistrarVisita_(p) {
  if(!martEvtOrigemPermitida_(p.origem)) return martEvtResposta_({ok:false});
  const sessao=String(p.sessionId||'');
  if(!/^vis_[A-Za-z0-9_-]{8,38}$/.test(sessao)) return martEvtResposta_({ok:false});
  const fonte=['whatsapp_grupo','direto','outro'].includes(String(p.origemCampanha||''))?String(p.origemCampanha):'outro';
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(5000))return martEvtResposta_({ok:false});
  try {
    const agora=new Date(),dia=Utilities.formatDate(agora,'America/Sao_Paulo','yyyyMMdd');
    const cache=CacheService.getScriptCache(),chave='vis_'+sessao;
    if(cache.get(chave))return martEvtResposta_({ok:true,repetido:true});
    const props=PropertiesService.getScriptProperties();
    const count=props.getProperty('MART_EVT_VIS_DIA')===dia?Number(props.getProperty('MART_EVT_VIS_TOTAL')||0):0;
    if(count>=4000)throw new Error('Limite diario de visitas');
    const idVisita=Utilities.getUuid();
    martEvtAba_().appendRow([idVisita,agora,agora.getTime(),sessao,fonte,'','acesso_portal']);
    mart1614_registrarMeta_({id:idVisita,agora:agora,tipo:'acesso_portal',
      campanha:mart1614_slug_(p.campanha)||mart1614_campanhaAtual_(),origem:fonte});
    cache.put(chave,'1',1800);
    props.setProperties({MART_EVT_VIS_DIA:dia,MART_EVT_VIS_TOTAL:String(count+1)});
    return martEvtResposta_({ok:true,gravado:true});
  } catch(e){console.warn('Visita recusada',String(e));return martEvtResposta_({ok:false});}
  finally {lock.releaseLock();}
}


// ================================================================
// v1.6.14 — campanhas e cliques. O coletor continua público, com
// dados INDICATIVOS e limites separados. Não confirma vendas.
// ================================================================
const MART1614_META_ABA='Eventos_Campanhas';
const MART1614_META_HEADERS=['registro_id','registrado_em','iniciado_em_ms','tipo',
  'oferta_id','matricula','campanha','origem','titulo_oferta'];
function mart1614_slug_(valor) {
  const v=String(valor||'').trim().toLowerCase();
  return /^[a-z0-9][a-z0-9_-]{0,59}$/.test(v) ? v : '';
}
// A mesma planilha operacional da API administrativa deve estar configurada no coletor.
function mart1614_configRastreio_() {
  const defaults={campanha:'',utmSource:'grupo_zap',utmId:'vendedores_zap',disponivel:true};
  const cache=CacheService.getScriptCache(),key='camp_config_v2';
  const saved=cache.get(key);
  if(saved){try{return JSON.parse(saved);}catch(_){}}
  try{
    const ss=SpreadsheetApp.openById(MART_EVT_SHEET_ID),sh=ss.getSheetByName('Config_Campanhas');
    if(!sh||sh.getLastRow()<2)return defaults;
    if(sh.getLastRow()>1000)throw new Error('Campanhas: limite de linhas excedido.');
    const rows=sh.getRange(2,1,sh.getLastRow()-1,2).getDisplayValues();
    const result={...defaults};
    for(const r of rows){
      const k=String(r[0]||'').trim(),v=mart1614_slug_(r[1]);
      if(k==='campanha_geral')result.campanha=v;
      if(k==='utm_source'&&v)result.utmSource=v;
      if(k==='utm_id'&&v)result.utmId=v;
    }
    cache.put(key,JSON.stringify(result),30);
    return result;
  }catch(e){
    console.warn('Configuração de campanhas indisponível:',String(e&&e.name||'Erro'));
    return {...defaults,disponivel:false};
  }
}
function mart1614_campanhaAtual_() {return mart1614_configRastreio_().campanha;}
function mart1614_consultarCampanha_(p) {
  const id=String(p.requestId||'');
  if(!/^cp_[A-Za-z0-9_-]{8,48}$/.test(id))
    return ContentService.createTextOutput('/* consulta invalida */').setMimeType(ContentService.MimeType.JAVASCRIPT);
  const dados=JSON.stringify({requestId:id,...mart1614_configRastreio_()});
  return ContentService.createTextOutput('window.MartinelloCampanhaReceber&&window.MartinelloCampanhaReceber('+dados+');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}
function mart1614_metaAba_() {
  const ss=SpreadsheetApp.openById(MART_EVT_SHEET_ID);
  let sh=ss.getSheetByName(MART1614_META_ABA);
  if(!sh){
    sh=ss.insertSheet(MART1614_META_ABA);
    sh.getRange(1,1,1,MART1614_META_HEADERS.length).setValues([MART1614_META_HEADERS]);
    sh.setFrozenRows(1);sh.getRange('E:I').setNumberFormat('@');
  } else {
    const got=sh.getRange(1,1,1,MART1614_META_HEADERS.length).getDisplayValues()[0];
    if(got.join('|')!==MART1614_META_HEADERS.join('|'))throw new Error('Cabeçalho Eventos_Campanhas divergente');
  }
  return sh;
}
function mart1614_registrarMeta_(d) {
  const seguro=v => {const s=String(v||'').replace(/[\r\n\t\u0000-\u001f]/g,' ').slice(0,100);
    return /^[=+\-@]/.test(s)?"'"+s:s;};
  const linha=[d.id,d.agora,d.agora.getTime(),d.tipo,
    seguro(d.oferta),d.rubi?"'"+d.rubi:'',mart1614_slug_(d.campanha),
    seguro(d.origem),seguro(d.titulo)];
  mart1614_metaAba_().appendRow(linha);
}
function mart1614_registrarClique_(p) {
  if(!martEvtOrigemPermitida_(p.origem))return martEvtResposta_({ok:false});
  const oferta=String(p.ofertaId||''),rubi=String(p.matricula||'');
  if(!/^[A-Za-z0-9_-]{1,40}$/.test(oferta) || !/^\d{3,5}$/.test(rubi))
    return martEvtResposta_({ok:false});
  const session=String(p.clickId||'');
  if(!/^clk_[A-Za-z0-9_-]{8,48}$/.test(session))return martEvtResposta_({ok:false});
  const lock=LockService.getScriptLock();if(!lock.tryLock(5000))return martEvtResposta_({ok:false});
  try {
    const cache=CacheService.getScriptCache(),chave='clk_'+session;
    if(cache.get(chave))return martEvtResposta_({ok:true,repetido:true});
    const hoje=Utilities.formatDate(new Date(),'America/Sao_Paulo','yyyyMMdd');
    const props=PropertiesService.getScriptProperties();
    const total=props.getProperty('MART1614_CLICK_DIA')===hoje ? Number(props.getProperty('MART1614_CLICK_TOTAL')||0) : 0;
    if(total>=4000)throw new Error('Limite diario de cliques');
    const agora=new Date();
    mart1614_registrarMeta_({id:Utilities.getUuid(),agora:agora,tipo:'clique_link',oferta:oferta,
      rubi:rubi,campanha:mart1614_slug_(p.campanha)||mart1614_campanhaAtual_(),
      origem:'link_vendedor',titulo:String(p.tituloOferta||'')});
    cache.put(chave,'1',120);
    props.setProperties({MART1614_CLICK_DIA:hoje,MART1614_CLICK_TOTAL:String(total+1)});
    return martEvtResposta_({ok:true,gravado:true});
  }catch(e){console.warn('Clique rejeitado:',String(e));return martEvtResposta_({ok:false});}
  finally {lock.releaseLock();}
}


// ================================================================
// v1.6.17 — ranking publico limitado: ultimos 30 dias,
// retorna somente ID de uma oferta entre as ativas consultadas.
// Nunca retorna matriculas, telefones, totais nem linhas da planilha.
// ================================================================
function mart171_consultarRanking_(p) {
  const req=String(p.requestId||'');
  const ids=String(p.ids||'').split(',');
  if(!/^rk_[A-Za-z0-9_-]{8,48}$/.test(req) || ids.length<1 || ids.length>40 ||
    ids.some(id=> !/^[A-Za-z0-9_-]{1,40}$/.test(id)))
    return ContentService.createTextOutput('/* consulta invalida */')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  let lider='';
  try {
    const totais=mart171_resumo30Dias_();
    let maior=0;
    ids.sort().forEach(id=>{
      const n=Number(totais[id]||0);
      if(n>maior) {maior=n;lider=id;}
    });
  } catch(e) {console.warn('Ranking indisponivel:',String(e));}
  const dados=JSON.stringify({requestId:req,ofertaId:lider});
  return ContentService.createTextOutput('window.MartinelloRankingReceber&&window.MartinelloRankingReceber('+dados+');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}
function mart171_resumo30Dias_() {
  const cache=CacheService.getScriptCache(),chave='mart171_ranking_30d';
  const anterior=cache.get(chave);
  if(anterior) {
    try {return JSON.parse(anterior);} catch (_) {}
  }
  const sh=martEvtAba_(),mapa={},hoje=Date.now();
  const corte=hoje-30*24*60*60*1000;
  // Eventos_Portal eh append-only, ordenado por criado_em.
  // Leitura reversa por blocos evita carregar a planilha inteira em memoria.
  for(let fim=sh.getLastRow();fim>=2;) {
    const inicio=Math.max(2,fim-1999),n=fim-inicio+1;
    // C = iniciado_em_ms, D = oferta_id, G = tipo
    const linhas=sh.getRange(inicio,3,n,5).getValues();
    let encontrouAntigo=false;
    for(let i=linhas.length-1;i>=0;i--) {
      const linha=linhas[i];
      const ts=Number(linha[0]);
      if(Number.isFinite(ts) && ts>0 && ts<corte) {encontrouAntigo=true;break;}
      const id=String(linha[1]||'');
      if(ts>=corte && ts<=hoje && linha[4]==='inicio_compartilhamento' &&
         /^[A-Za-z0-9_-]{1,40}$/.test(id)) mapa[id]=(mapa[id]||0)+1;
    }
    if(encontrouAntigo)break;
    fim=inicio-1;
  }
  // Cache de 15 min. Nao impede registrar eventos novos.
  try {cache.put(chave,JSON.stringify(mapa),900);} catch (_) {}
  return mapa;
}


// Consulta publica binaria de matrícula. Sem nome, cargo, telefone ou filial.
// O portal usa resultado nulo/indisponível como NÃO VERIFICADO, jamais presume status ativo.
function mart1618_consultarMatricula_(p){
  const rubi=String(p.matricula||''); const req=String(p.requestId||'');
  if(!/^\d{3,5}$/.test(rubi)||!/^ma_[A-Za-z0-9_-]{8,48}$/.test(req))
    return ContentService.createTextOutput('/* consulta inválida */').setMimeType(ContentService.MimeType.JAVASCRIPT);
  let ativo=false,disponivel=true;
  try{
    const ss=SpreadsheetApp.openById(MART_EVT_SHEET_ID),sh=ss.getSheetByName('Vendedores');
    if(!sh)throw new Error('Base ausente');
    if(sh.getLastRow()>1){
      const lista=sh.getRange(2,1,sh.getLastRow()-1,1).createTextFinder(rubi).matchEntireCell(true).findAll();
      if(lista.length===1){
        const row=sh.getRange(lista[0].getRow(),1,1,13).getDisplayValues()[0];
        const situacao=String(row[6]||'').toUpperCase(); const cadastro=String(row[7]||'').toUpperCase();
        ativo=cadastro!=='INATIVO'&&!/INATIV|DESLIG|DEMIT|REMOVID|PENDENTE_VALIDACAO/.test(situacao);
      }
    }
  }catch(e){disponivel=false;console.warn('Consulta matrícula indisponível',String(e));}
  const dados=JSON.stringify({requestId:req,ativo,disponivel});
  return ContentService.createTextOutput('window.MartinelloMatriculaReceber&&window.MartinelloMatriculaReceber('+dados+');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}
