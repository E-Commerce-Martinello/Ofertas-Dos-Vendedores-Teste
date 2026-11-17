const {test} = require('node:test');
const assert = require('node:assert/strict');
const T = require('../shared/telefones.js');
const n = '65981234670', outro = '11973485620';
test('DDD, comprimento, nono dígito e números fictícios', () => {
  assert.equal(T.numero('(65) 9 8123-4670'), n);
  assert.equal(T.numero('+55 (65) 9 8123-4670'), n);
  for (const v of ['20981234670','6581234670','65881234670','65911111111','65912345678',n+'1','abc'+n,Number(n)]) assert.equal(T.valido(v), false, String(v));
  assert.equal(T.erro(''), ''); assert.ok(T.erro('',false));
  assert.equal(T.formato(n),'(65) 9 8123-4670');
  assert.equal(T.valido(T.formato(n+'1')),false);
});
test('grupo não prova titularidade e declaração não valida', () => {
  const v={matricula:'19000',telefonesExtras:{pessoal:n,grupoPessoal:true}};
  assert.equal(T.avaliar(v,[v],[{telefone:n,nome:'Contato'}])[0].estado,'titularidade_pendente');
  assert.equal(T.avaliar(v,[v],[])[0].validado,false);
});
test('matrícula exata valida; colisão pendente ou identificação divergente bloqueia', () => {
  const v={matricula:'19000',numero:n};
  const ps=[{telefone:n,nome:'1 - (19000) Nome - Vendedor'}];
  assert.equal(T.avaliar(v,[v],ps)[0].validado,true);
  assert.equal(T.avaliar(v,[v,{matricula:'20000',telefonesExtras:{pessoal:n}}],ps)[0].estado,'conflito');
  assert.equal(T.avaliar(v,[v],ps,[{telefone:n,tipo:'GERENTE'}])[0].estado,'conflito');
});
test('prioridade de grupo e profissional; legado não é reclassificado', () => {
  const v={matricula:'19000',numero:n,statusTelefone:'VALIDADO',telefonesExtras:{profissional:outro,statusProfissional:'VALIDADO'}};
  assert.equal(T.preferido(T.avaliar(v,[v],[{telefone:n,nome:'Contato'}])).tipo,'legado');
  assert.equal(T.preferido(T.avaliar(v,[v],[])).tipo,'profissional');
  assert.equal(v.numero,n); assert.equal(v.telefonesExtras.pessoal,undefined);
  assert.equal(T.avaliar({...v,numero:'6581234670'},[v],[]).find(f=>f.tipo==='legado').original,'6581234670');
});
test('solicitação associa apenas tipo explícito com evidência independente, sem sobrescrever',()=>{
 const base=[{matricula:'19000',numero:'6581234670',telefonesExtras:{profissional:outro}}];
 const pedidos=[{matricula:'19000',telefone:n,tipoTelefone:'pessoal'}];
 assert.equal(T.associarSolicitacoes(base,pedidos,[{telefone:n,nome:'Contato'}],[])[0].telefonesExtras.pessoal,undefined);
 const result=T.associarSolicitacoes(base,pedidos,[{telefone:n,nome:'(19000) Nome'}],[]);
 assert.equal(result[0].telefonesExtras.pessoal,n);assert.equal(result[0].numero,'6581234670');assert.equal(base[0].telefonesExtras.pessoal,undefined);
 assert.equal(T.associarSolicitacoes(base,[{...pedidos[0],tipoTelefone:'profissional'}],[{telefone:n,nome:'(19000) Nome'}],[])[0].telefonesExtras.profissional,outro);
});
test('cópias dos backends são idênticas à fonte compartilhada',()=>{
 const fs=require('fs'),path=require('path'),source=fs.readFileSync(path.join(__dirname,'../shared/telefones.js'),'utf8');
 for(const p of ['admin','coletor'])assert.equal(fs.readFileSync(path.join(__dirname,'../infrastructure/apps-script',p,'Telefones.gs'),'utf8'),source);
});
test('duas identificações para o mesmo número não ocultam divergência',()=>{
 const v={matricula:'19000',numero:n,statusTelefone:'VALIDADO'};
 assert.equal(T.avaliar(v,[v],[{telefone:n,nome:'(19000) Nome'},{telefone:n,nome:'(20000) Outro'}])[0].estado,'conflito');
 assert.equal(T.avaliar(v,[v],[{telefone:n,nome:'Nome'}],[{telefone:n,tipo:'VENDEDOR',matricula:'19000'},{telefone:n,tipo:'VENDEDOR',matricula:'20000'}])[0].validado,false);
});
