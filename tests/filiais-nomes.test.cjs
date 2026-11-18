const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function carregar(){
  const codigo = fs.readFileSync(path.join(__dirname, '../model/filiais.js'), 'utf8');
  return vm.runInNewContext(codigo + '\nFiliaisUI', {});
}
test('filiais mantêm apenas um código e município completo após importações repetidas',()=>{
  const f=carregar();
  f.definir({'118':'118 • 118 • Alto Araguaia'});
  assert.equal(f.nome('118'),'118 • Alto Araguaia');
  f.definir({'17':'17 • Nova Olímpia'});
  assert.equal(f.nome('17'),'17 • Nova Olímpia');
  f.definir({'30':'Filial 30 - 30 • Várzea Grande MT'});
  assert.equal(f.nome('30'),'30 • Várzea Grande');
});
test('duas filiais na mesma cidade recebem I e II sem duplicar rótulo',()=>{
  const f=carregar();
  f.definir({'1':'1 · 1 · Lucas do Rio Verde I','4':'4 • Lucas do Rio Verde II'});
  assert.equal(f.nome('1'),'1 • Lucas do Rio Verde I');
  assert.equal(f.nome('4'),'4 • Lucas do Rio Verde II');
});
