const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),path=require('path');
test('scripts do navegador e Apps Script têm sintaxe válida',()=>{for(const dir of ['model','presenter','view','shared','infrastructure/apps-script/admin','infrastructure/apps-script/coletor'])for(const f of fs.readdirSync(dir))if(/\.(js|gs)$/.test(f))assert.doesNotThrow(()=>new vm.Script(fs.readFileSync(path.join(dir,f),'utf8'),{filename:dir+'/'+f}));});
test('HTML usa arquivos existentes, IDs únicos e dois campos editáveis de telefone',()=>{
 for(const file of ['admin.html','index.html']){const html=fs.readFileSync(file,'utf8'),ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,new Set(ids).size,file);for(const m of html.matchAll(/<script[^>]+src="([^"?]+)[^"]*"/g)){if(!m[1].startsWith('https:'))assert.ok(fs.existsSync(m[1]),m[1]);}}
 const html=fs.readFileSync('admin.html','utf8'),modal=html.split('id="modalEditarVendedor"')[1].split('id="whatsappModal"')[0];assert.equal([...modal.matchAll(/type="tel"/g)].length,2);assert.ok(!html.includes('id="editarTelefoneVendedor"'));
});
test('destinos de ambiente permanecem idênticos à base sincronizada',()=>{
 const {execFileSync}=require('child_process');assert.equal(fs.readFileSync('shared/config.js','utf8'),execFileSync('git',['show','43a0b2693ebb5d82b1608f5f57da3f8e031307f2:shared/config.js'],{encoding:'utf8'}));
});
