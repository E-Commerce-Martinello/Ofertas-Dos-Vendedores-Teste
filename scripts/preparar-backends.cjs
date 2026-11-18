const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const code=fs.readFileSync(path.join(root,'shared/telefones.js'),'utf8');
for(const p of ['admin','coletor'])fs.writeFileSync(path.join(root,'infrastructure/apps-script',p,'Telefones.gs'),code);
console.log('Validador compartilhado copiado para os dois projetos Apps Script.');
