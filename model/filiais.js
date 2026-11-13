// v1.6.18 — apresentação de filiais; código oficial nunca é alterado.
const FiliaisUI = {
  fonte:{}, opcoes:new WeakMap(),
  definir(fonte){this.fonte=fonte||{};},
  municipio(codigo){
    const raw=String(this.fonte[String(codigo)]||'').trim();
    if(!raw)return '';
    // Remove bairro, unidade, setor e região só se estiverem claramente após separador.
    return raw.split(/\s+[–—-]\s+/)[0].replace(/^filial\s*\d+\s*[-–—]?\s*/i,'').trim();
  },
  romano(n){const m=[[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']];
    let s='';for(const [v,t] of m){while(n>=v){s+=t;n-=v;}}return s;},
  nome(codigo){
    const id=String(codigo||'').trim(),cidade=this.municipio(id);
    if(!id)return 'Não identificado';
    if(!cidade)return id+' • Município não cadastrado';
    const normal=x=>x.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    const pares=Object.keys(this.fonte).filter(k=>normal(this.municipio(k))===normal(cidade))
      .sort((a,b)=>Number(a)-Number(b));
    const i=pares.indexOf(id);
    return `${id} • ${cidade}${pares.length>1&&i>=0?' '+this.romano(i+1):''}`;
  },
  buscar(id){
    const input=document.getElementById('busca'+id),select=document.getElementById(id);
    if(!select||!input)return;
    if(!this.opcoes.has(select))this.opcoes.set(select,[...select.options].map(o=>({v:o.value,t:o.textContent})));
    const orig=this.opcoes.get(select),termo=input.value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
    const anterior=select.value;
    select.replaceChildren(...orig.filter(o=>!o.v||o.t.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(termo))
      .map(o=>new Option(o.t,o.v)));
    if([...select.options].some(o=>o.value===anterior))select.value=anterior;
    else select.value='';
    select.dispatchEvent(new Event('change'));
  },
  limparCache(id){const el=document.getElementById(id);if(el){this.opcoes.delete(el);const i=document.getElementById('busca'+id);if(i)i.value='';}}
};
