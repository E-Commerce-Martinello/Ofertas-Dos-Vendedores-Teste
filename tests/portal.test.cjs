const test=require('node:test'),assert=require('node:assert/strict');
const p=require('../shared/portal-preferencias.js');
const agora=new Date('2026-11-18T12:00:00Z');
const a={id:'a'},b={id:'b'},d={id:'d',destaqueDia:true,dataInicio:'2026-11-17',dataFim:'2026-11-20'};
test('seleção inicial: destaque, ranking, aleatória; nunca inativa',()=>{
 assert.equal(p.inicial([a,b,d],'b',a,false,agora).id,'d');
 assert.equal(p.inicial([a,b],'b',a,false,agora).id,'b');
 assert.equal(p.inicial([a,b],'fora',null,false,agora,()=>.9).id,'b');
 assert.equal(p.inicial([],'d',d,false,agora),null);
 assert.equal(p.destaque([{...d,destaqueFim:'2026-11-18T11:00:00Z'}],agora),null);
});
test('ranking tardio e snapshots preservam escolha manual válida',()=>{
 assert.equal(p.inicial([a,b,d],'b',a,true,agora).id,'a');
 assert.equal(p.inicial([b,d],'b',a,true,agora).id,'d');
 assert.equal(p.inicial([a,b],'',b,false,agora,()=>0).id,'b');
});
test('aviso diário por matrícula e ambiente; falha de armazenamento não bloqueia',()=>{
 const m=new Map(),storage={getItem:k=>m.get(k),setItem:(k,v)=>m.set(k,v)};
 assert.equal(p.deveAvisar(storage,'teste:123','2026-11-18'),true);
 assert.equal(p.deveAvisar(storage,'teste:123','2026-11-18'),false);
 assert.equal(p.deveAvisar(storage,'teste:124','2026-11-18'),true);
 assert.equal(p.deveAvisar(storage,'oficial:123','2026-11-18'),true);
 assert.equal(p.deveAvisar(storage,'teste:123','2026-11-19'),true);
 assert.equal(p.deveAvisar(null,'teste:123','2026-11-19'),true);
 assert.equal(p.dia(new Date('2026-11-19T01:00:00Z')),'2026-11-18');
});
