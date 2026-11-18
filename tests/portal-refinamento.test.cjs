// Regressões da vitrine pública sem acesso a Firebase ou dados reais.
'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
const source=name=>fs.readFileSync(path.join(root,name),'utf8');
const P=vm.runInNewContext(source('shared/portal-preferencias.js')+';PortalPreferencias;');
function criar(){
  const agora=new Date(2026,10,18,10);
  const doc={addEventListener(){}};
  const presenter=vm.runInNewContext(source('presenter/index-presenter.js')+';IndexPresenter;',{
    document:doc,PortalPreferencias:P,RankingOfertas:{liderAtivas:()=>''},
    getHorarioBrasilia:()=>agora,isOfertaAtiva:()=>true
  });
  presenter._renderCatalogo=()=>{};presenter._renderOferta=()=>{};presenter._atualizarRanking=()=>{};
  return presenter;
}
const periodo={dataInicio:'2026-11-01T00:00',dataFim:'2026-12-01T23:59'};
const oferta=(id,extra={})=>({id,tituloPagina:id,...periodo,...extra});
test('Brasília é o padrão da virada do dia',()=>{
  assert.equal(P.dia(new Date('2026-11-18T02:00:00.000Z')),'2026-11-17');
});
test('escolha manual permanece após atualização normal',()=>{
  const p=criar(),a=oferta('a'),b=oferta('b');
  p._aplicarOfertas([a,b]);
  p.ofertaAtual=b;p._selecaoManual=true;
  p._aplicarOfertas([a,b]);
  assert.equal(p.ofertaAtual.id,'b');
  assert.equal(p._selecaoManual,true);
});
test('novo destaque assume prioridade; nova escolha manual é respeitada',()=>{
  const p=criar(),a=oferta('a'),b=oferta('b'),c=oferta('c',{destaqueDia:true});
  p._aplicarOfertas([a,b]);p.ofertaAtual=b;p._selecaoManual=true;
  p._aplicarOfertas([a,b,c]);
  assert.equal(p.ofertaAtual.id,'c');assert.equal(p._selecaoManual,false);
  p.ofertaAtual=b;p._selecaoManual=true;p._aplicarOfertas([a,b,c]);
  assert.equal(p.ofertaAtual.id,'b');
});
test('sem novo destaque, atualização do ranking não força outra oferta',()=>{
  const p=criar(),a=oferta('a'),b=oferta('b',{destaqueDia:true});
  p._aplicarOfertas([a,b]);p.ofertaAtual=a;p._selecaoManual=true;
  p._aplicarOfertas([a,b]);
  assert.equal(p.ofertaAtual.id,'a');
});
