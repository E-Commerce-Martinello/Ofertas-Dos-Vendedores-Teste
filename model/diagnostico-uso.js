/* Medições locais da sessão. Não armazena payloads, pessoas, tokens ou URLs. */
const DiagnosticoUso={
  inicio:Date.now(),grupos:{},eventosFirebase:0,ultimoFirebase:null,estadoSync:'aguardando',ultimaConferencia:null,tamanhoOfertas:null,
  registrar(grupo,ms,ok){
    if(!['sheets-leitura','sheets-gravacao','sheets-sync','firebase-leitura'].includes(grupo))return;
    const g=this.grupos[grupo]||(this.grupos[grupo]={total:0,falhas:0,somaMs:0,maxMs:0,ultimaMs:0});
    const tempo=Math.max(0,Number(ms)||0);g.total++;if(!ok)g.falhas++;g.somaMs+=tempo;g.maxMs=Math.max(g.maxMs,tempo);g.ultimaMs=tempo;
    this.renderizar();
  },
  async medir(grupo,operacao){const inicio=performance.now();try{const r=await operacao();this.registrar(grupo,performance.now()-inicio,true);return r;}catch(e){this.registrar(grupo,performance.now()-inicio,false);throw e;}},
  firebaseRecebido(){this.eventosFirebase++;this.ultimoFirebase=Date.now();this.renderizar();},
  sincronizacao(estado){this.estadoSync=['atualizado','atualizando','pausado','erro','incompativel','indisponivel'].includes(estado)?estado:'aviso';if(estado==='atualizado')this.ultimaConferencia=Date.now();this.renderizar();},
  resumo(){return {versao:1,ambiente:typeof CONFIG==='undefined'?'desconhecido':CONFIG.environment,inicio:new Date(this.inicio).toISOString(),capturadoEm:new Date().toISOString(),grupos:Object.fromEntries(Object.entries(this.grupos).map(([k,g])=>[k,{total:g.total,falhas:g.falhas,mediaMs:Math.round(g.somaMs/g.total),maxMs:Math.round(g.maxMs),ultimaMs:Math.round(g.ultimaMs)}])),eventosFirebase:this.eventosFirebase,ultimoFirebase:this.ultimoFirebase,estadoSync:this.estadoSync,ultimaConferencia:this.ultimaConferencia,tamanhoLogicoOfertasBytes:this.tamanhoOfertas};},
  medirTamanho(){
    // Somente os dados que já estão em memória; não faz download do banco.
    const ofertas=typeof AdminPresenter==='undefined'?[]:AdminPresenter.ofertas;
    if(!Array.isArray(ofertas))return;
    this.tamanhoOfertas=new TextEncoder().encode(JSON.stringify(ofertas)).length;this.renderizar();
  },
  exportar(){const blob=new Blob([JSON.stringify(this.resumo(),null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='diagnostico-portal-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},
  renderizar(){
    if(typeof document==='undefined')return;
    const lista=document.getElementById('diagnosticoMetricas');if(!lista)return;
    const nomes={'sheets-leitura':'Sheets / API — leituras','sheets-gravacao':'Sheets / API — gravações','sheets-sync':'Sheets / API — sincronização','firebase-leitura':'Firebase — leitura de ofertas'};
    lista.replaceChildren();
    for(const [k,nome]of Object.entries(nomes)){
      const g=this.resumo().grupos[k],card=document.createElement('article');card.className='central-item';
      const h=document.createElement('h3'),p=document.createElement('p');h.textContent=nome;
      p.textContent=g?`${g.total} operações · ${g.falhas} falhas · média ${g.mediaMs} ms · máxima ${g.maxMs} ms · última ${g.ultimaMs} ms`:'Aguardando operações nesta sessão.';card.append(h,p);lista.append(card);
    }
    const data=t=>t?new Date(t).toLocaleTimeString('pt-BR'):'ainda não registrada';
    document.getElementById('diagnosticoEstado').textContent=`Sincronização: ${this.estadoSync}. Última conferência aplicada: ${data(this.ultimaConferencia)}. Eventos do listener de ofertas: ${this.eventosFirebase}; último às ${data(this.ultimoFirebase)}.`;
    document.getElementById('diagnosticoTamanho').textContent=this.tamanhoOfertas===null?'Tamanho lógico das ofertas: ainda não medido.':`Ofertas carregadas nesta sessão: ${(this.tamanhoOfertas/1024).toFixed(1)} KiB de JSON. Não representa o armazenamento total nem o tráfego cobrado.`;
  }
};
if(typeof module!=='undefined')module.exports=DiagnosticoUso;
if(typeof document!=='undefined')document.addEventListener('DOMContentLoaded',()=>DiagnosticoUso.renderizar());
