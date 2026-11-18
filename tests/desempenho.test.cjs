const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const T=require('../shared/telefones.js');
function presenter(){const c=vm.createContext({Telefones:T,CONFIG:{environment:'TESTE'},WhatsAppPresenter:{participantes:[],identificacoes:[]}});vm.runInContext(fs.readFileSync('presenter/vendors-presenter.js','utf8')+';this.presenter=VendedoresPresenter;',c);return {p:c.presenter,grupo:c.WhatsAppPresenter};}
test('índice preserva presença, titularidade, duplicatas e editor fora da base',()=>{
 const base=[{matricula:'19000',numero:'65981234670',statusTelefone:'VALIDADO'}, {matricula:'20000',numero:'11973485620'}, {matricula:'21000',numero:'11973485620'}, {matricula:'22000',numero:'000'}, {matricula:'23000',telefonesExtras:{pessoal:'65987654320'}}];
 const grupo=[{telefone:'65981234670',nome:'(19000) Ana'},{telefone:'65987654320',nome:'Contato'},{telefone:'11973485620',nome:'(20000) Beto'}];
 const manual=[{telefone:'11973485620',tipo:'GERENTE'}];const indice=T.criarIndice(base,grupo,manual);
 for(const disponivel of [true,false])for(const v of [...base,{matricula:'24000',numero:'65981234670'}])assert.deepEqual(T.avaliar(v,base,grupo,manual,disponivel,indice),T.avaliar(v,base,grupo,manual,disponivel));
});
test('6000 vendedores: indicadores repetidos não voltam a percorrer toda a base',()=>{
 let leituras=0;const base=Array.from({length:6000},(_,i)=>({matricula:String(19000+i),get numero(){leituras++;return '659'+String(20000000+i);},statusTelefone:'VALIDADO'}));
 const {p}=presenter();p.registros=base;p.grupoCarregado=true;
 const inicio=performance.now();for(let round=0;round<4;round++)for(const v of base){p._fonesValidados(v);p._numeroPreferido(v);p._situacaoGrupo(v);}
 assert.ok(leituras<=base.length*3,`Varreduras repetidas: ${leituras}`);
 console.log(JSON.stringify({vendedores:6000,rodadas:4,leiturasTelefone:leituras,tempoMs:Math.round(performance.now()-inicio)}));
});
test('cache invalida com novo snapshot, nova lista, disponibilidade e correção local',()=>{
 const {p,grupo}=presenter();const v={matricula:'19000',numero:'65981234670'};p.registros=[v];p.grupoCarregado=true;
 assert.equal(p._avaliarTelefones(v)[0].estado,'pendente');
 grupo.participantes=[{telefone:v.numero,nome:'(19000) Ana'}];assert.equal(p._avaliarTelefones(v)[0].estado,'grupo');
 p.registros=[v,{matricula:'20000',numero:v.numero}];assert.equal(p._avaliarTelefones(v)[0].estado,'conflito');
 p.registros=[v];p.grupoCarregado=false;assert.equal(p._avaliarTelefones(v)[0].estado,'sem_dados');
 v.statusTelefone='VALIDADO';p._invalidarTelefones();assert.equal(p._avaliarTelefones(v)[0].validado,true);
});
test('filiais mantêm municípios, ordem romana e atualização de fonte',()=>{
 const c=vm.createContext({document:{querySelectorAll:()=>[]}});vm.runInContext(fs.readFileSync('model/filiais.js','utf8')+';this.filiais=FiliaisUI;',c);const f=c.filiais;
 f.definir({'2':'Lucas do Rio Verde','1':'Lucas do Rio Verde','3':'Nova Mutum'});assert.equal(f.nome('1'),'1 • Lucas do Rio Verde I');assert.equal(f.nome('2'),'2 • Lucas do Rio Verde II');
 f.definir({'1':'Nova Mutum'});assert.equal(f.nome('1'),'1 • Nova Mutum');assert.equal(f.nome('2'),'2 • Município não cadastrado');
});
