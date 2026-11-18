/**
 * Cloudflare Pages — build de prévia ISOLADA da homologação.
 * Não publica infrastructure/, scripts/, tests/ ou documentos.
 * Nunca habilitar produção por padrão: configurar explicitamente outro plano.
 * Cloudflare Pages: build command "node scripts/build-pages-preview.cjs", output "dist".
 */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const raiz=path.resolve(__dirname,'..');
const destino=path.join(raiz,'dist');
const origemGitHub=path.join(raiz,'shared','config.js');
const caminho=['index.html','admin.html','img','model','presenter','shared','view'];
const frase='const MART_AMBIENTE = MART_escolherAmbiente(window.location.hostname,window.location.pathname);';
if (process.env.MART_PAGES_ENV !== 'TESTE') {
  throw new Error('Prévia Pages bloqueada: configure MART_PAGES_ENV=TESTE no projeto de homologação. Nunca usar os dados oficiais.');
}
if (!fs.existsSync(origemGitHub)) throw new Error('Configuração cliente ausente.');
const config=fs.readFileSync(origemGitHub,'utf8');
if(config.split(frase).length!==2) throw new Error('shared/config.js mudou: revise a estratégia de seleção do ambiente antes do build.');
fs.rmSync(destino,{recursive:true,force:true});
fs.mkdirSync(destino,{recursive:true});
for(const nome of caminho){
  const src=path.join(raiz,nome);
  if(!fs.existsSync(src)) throw new Error('Arquivo de site ausente: '+nome);
  fs.cpSync(src,path.join(destino,nome),{recursive:true});
}
const configFinal=config.replace(frase,"const MART_AMBIENTE = 'TESTE'; // Apenas na distribuição isolada do Cloudflare Pages");
fs.writeFileSync(path.join(destino,'shared','config.js'),configFinal,'utf8');
const proibidos=['infrastructure','scripts','tests','docs','.git','.env'];
for(const nome of proibidos)if(fs.existsSync(path.join(destino,nome)))throw new Error('Artefato privado não pode integrar a publicação: '+nome);
console.log('Prévia Cloudflare Pages: site TESTE isolado em dist/. Nenhum backend ou dado foi implantado.');
