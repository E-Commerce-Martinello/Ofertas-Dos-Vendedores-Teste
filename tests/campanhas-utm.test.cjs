/* Regressão de campanhas e URLs (somente código local; não conecta aos serviços). */
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.join(__dirname, '..');
const texto = arquivo => fs.readFileSync(path.join(raiz, arquivo), 'utf8');
function criar() {
  const portal = new Function(texto('model/campanhas.js')+'\nreturn CampanhasPortal;')();
  const links = new Function('CampanhasPortal', texto('model/link-track.js')+'\nreturn LinkTrack;')(portal);
  portal.geral = 'novembro_2026';
  portal.utmSource = 'grupo_zap';
  portal.utmId = 'vendedores_zap';
  return {portal,links};
}
const produto='https://www.martinello.com.br/ar-condicionado-12000-btus-split-midea-inverter-ai-ecomaster-inverter-42ezvcc-38ezvcc-220v-81579';
function destino(link,matricula=true) {
  const u=new URL(link);
  if(matricula) {
    assert.equal(u.pathname,'/parceiros/19000');
    const d=u.searchParams.get('redirect');
    assert.ok(d);
    return new URL(d);
  }
  assert.equal(u.pathname,'/');
  return u;
}
function verificar(url,cam,source='grupo_zap',id='vendedores_zap'){
  const query=url.searchParams;
  assert.equal(query.get('utm_source'),source);
  assert.equal(query.get('utm_campaign'),cam);
  assert.equal(query.get('utm_id'),id);
  assert.deepEqual([...query.keys()].filter(x=>x.startsWith('utm_')),
    ['utm_source','utm_campaign','utm_id']);
}

test('oferta antiga sem campanha individual usa a campanha geral', () => {
  const {links}=criar();
  verificar(destino(links.urlCompartilhavel({id:20,linkProduto:produto},'19000')),'novembro_2026');
});
test('campanha individual prevalece sobre a geral',()=>{
  const {links}=criar();
  verificar(destino(links.urlCompartilhavel({id:20,linkProduto:produto,campanha:'black_friday'},'19000')),'black_friday');
});
test('marcador antigo sem_campanha não prevalece sobre campanha geral',()=>{
  const {links}=criar();
  verificar(destino(links.urlCompartilhavel({id:20,linkProduto:produto,campanha:'sem_campanha'},'19000')),'novembro_2026');
});
test('configuração avançada altera source/id e preserva a campanha',()=>{
  const {links,portal}=criar();
  portal.utmSource='regional_zap'; portal.utmId='gerentes_zap';
  const url=links.urlCompartilhavel({id:20,linkProduto:produto},'19000');
  verificar(destino(url),'novembro_2026','regional_zap','gerentes_zap');
});
test('UTMs anteriores são substituídos, parâmetros de produto preservados',()=>{
  const {links}=criar();
  const antigo=produto+'?cor=branco&utm_source=outra&utm_medium=grupo&utm_campaign=antiga&utm_campaign=duplicada';
  const uri=destino(links.urlCompartilhavel({id:20,linkProduto:antigo},'19000'));
  verificar(uri,'novembro_2026');
  assert.equal(uri.searchParams.get('cor'),'branco');
  assert.equal(uri.searchParams.get('utm_medium'),null);
});
test('matrícula de não vendedor recebe o site padrão com três UTMs',()=>{
  const {links}=criar();
  verificar(destino(links.urlCompartilhavel({id:20,linkProduto:produto},'19000',false),false),'novembro_2026');
});
test('ausência de campanha bloqueia link em vez de emitir sem_campanha',()=>{
  const {links,portal}=criar();
  portal.geral='';
  assert.throws(()=>links.urlCompartilhavel({id:20,linkProduto:produto},'19000'),/Nenhuma campanha/);
});
test('domínio diferente não é usado como redirecionamento de parceiros',()=>{
  const {links}=criar();
  assert.throws(()=>links.urlCompartilhavel({id:20,linkProduto:'https://example.com/produto'},'19000'),/Martinello/);
});

test('alterar a geral atualiza ofertas antigas e novas sem gravar nelas',()=>{
  const {links,portal}=criar();const antiga={id:20,linkProduto:produto};
  verificar(destino(links.urlCompartilhavel(antiga,'19000')),'novembro_2026');
  portal.geral='natal_2026';
  for(const oferta of [antiga,{id:21,linkProduto:produto},{id:22,linkProduto:produto,campanha:'sem_campanha'}])
    verificar(destino(links.urlCompartilhavel(oferta,'19000')),'natal_2026');
  assert.equal(antiga.campanha,undefined);
  verificar(destino(links.urlCompartilhavel({...antiga,campanha:'individual'},'19000')),'individual');
});
test('marcador sem_campanha também é rejeitado na configuração geral',()=>{
  const {links,portal}=criar();portal.geral='sem_campanha';
  assert.throws(()=>links.urlCompartilhavel({id:20,linkProduto:produto},'19000'),/Nenhuma campanha/);
});
test('falha de atualização invalida cache e próxima tentativa consulta novamente',async()=>{
  const window={},scripts=[];
  const document={createElement:()=>({remove(){}}),head:{appendChild(s){scripts.push(s);queueMicrotask(()=>s.onerror());}}};
  const portal=new Function('window','document','CONFIG',texto('model/campanhas.js')+'\nreturn CampanhasPortal;')(window,document,{portalEventsApiUrl:'https://script.google.com/macros/s/test/exec'});
  portal.carregada=true;portal.consultadaEm=Date.now();portal.geral='antiga';
  await assert.rejects(portal.carregar(true),/atualizar a campanha/);
  assert.equal(portal.carregada,false);
  await assert.rejects(portal.carregar(),/atualizar a campanha/);
  assert.equal(scripts.length,2);
});
