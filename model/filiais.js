// v1.6.18.1 — município completo + filtro pesquisável em UMA única caixa.
// O identificador de filial permanece num select interno compatível com os apresentadores.
const FiliaisUI = {
  fonte:{}, campos:new Map(),
  definir(fonte){this.fonte=fonte||{};this.ativarBuscas();},
  normalizar(x){return String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim();},
  municipio(codigo){
    const bruto=String(this.fonte[String(codigo)]||'').trim();
    if(!bruto)return '';
    const semFilial=bruto.replace(/^filial\s*\d+\s*[-–—]?\s*/i,'').trim();
    const semSetor=semFilial.split(/\s+[–—-]\s+/)[0].trim();
    const apelidos={LRV:'Lucas do Rio Verde'};
    const abreviacao=semSetor.toUpperCase().replace(/[^A-Z]/g,'');
    const inteiro=apelidos[abreviacao] || (/^LRV\b/i.test(semSetor)?'Lucas do Rio Verde':semSetor);
    return inteiro.replace(/\s+/g,' ').split(' ').map((palavra,i)=>{
      if(i>0 && /^(de|da|do|das|dos)$/i.test(palavra))return palavra.toLowerCase();
      return palavra.charAt(0).toLocaleUpperCase('pt-BR')+palavra.slice(1).toLocaleLowerCase('pt-BR');
    }).join(' ');
  },
  romano(n){const m=[[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']];let s='';for(const [v,t]of m){while(n>=v){s+=t;n-=v;}}return s;},
  nome(codigo){
    const id=String(codigo||'').trim(),cidade=this.municipio(id);
    if(!id)return 'Não identificado';
    if(!cidade)return `${id} • Município não cadastrado`;
    const pares=Object.keys(this.fonte).filter(k=>this.normalizar(this.municipio(k))===this.normalizar(cidade))
      .sort((a,b)=>Number(a)-Number(b));
    const pos=pares.indexOf(id);
    return `${id} • ${cidade}${pares.length>1 && pos>=0?' '+this.romano(pos+1):''}`;
  },
  _lista(select,input){
    const id='listaBuscaFilial'+select.id;
    let lista=document.getElementById(id);
    if(!lista){lista=document.createElement('datalist');lista.id=id;input.insertAdjacentElement('afterend',lista);}
    input.setAttribute('list',id);
    const valores=[...select.options];
    lista.replaceChildren(...valores.map(o=>new Option(o.textContent.trim(),o.textContent.trim())));
    const selecionada=valores.find(o=>o.value===select.value);
    if(document.activeElement!==input || !input.value.trim()) input.value=selecionada?.value ? selecionada.textContent.trim() : '';
  },
  ativarBuscas(){
    document.querySelectorAll('input[id^="busca"]').forEach(input=>{
      const id=input.id.slice(5),select=document.getElementById(id);
      if(!select||select.tagName!=='SELECT')return;
      select.classList.add('filial-select-interno');
      input.classList.add('filial-combo');
      input.placeholder='Todas as filiais — digite código ou município';
      if(!this.campos.has(id)){
        const atualizar=()=>this._lista(select,input);
        const observer=new MutationObserver(atualizar);
        observer.observe(select,{childList:true,subtree:true,characterData:true});
        select.addEventListener('change',()=>{
          if(document.activeElement===input)return;
          const option=[...select.options].find(o=>o.value===select.value);
          input.value=option?.value ? option.textContent.trim() : '';
        });
        this.campos.set(id,{observer});
      }
      this._lista(select,input);
    });
  },
  buscar(id){
    const input=document.getElementById('busca'+id),select=document.getElementById(id);
    if(!input||!select)return;
    const termo=this.normalizar(input.value);
    const match=[...select.options].find(o=>this.normalizar(o.textContent)===termo || (termo && this.normalizar(o.value)===termo));
    // Enquanto digita, as sugestões filtram localmente; somente a escolha exata ativa o filtro.
    if(!termo || match){
      select.value=termo ? match.value : '';
      select.dispatchEvent(new Event('change',{bubbles:true}));
    }
  },
  limparCache(id){
    const input=document.getElementById('busca'+id);
    if(input)input.value='';
    // As opções serão reconstruídas no datalist quando o select for repopulado.
  }
};
