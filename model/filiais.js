// v1.6.18.1 — município completo + filtro pesquisável em UMA única caixa.
// O identificador de filial permanece num select interno compatível com os apresentadores.
const FiliaisUI = {
  fonte:{}, campos:new Map(),
  definir(fonte){this.fonte=fonte||{};this.ativarBuscas();},
  normalizar(x){return String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim();},
  // Exibe apenas o nome do município. A fonte preferida é a coluna C
  // "municipio" da aba Filiais. A coluna B "localidade" pode ter bairros,
  // regiões, siglas e descrições internas; não é fonte confiável por si só.
  municipio(codigo){
    let bruto=String(this.fonte[String(codigo)]||'').trim();
    if(!bruto)return '';
    bruto=bruto.replace(/\s+/g,' ').trim();
    // Limpa prefixos de unidade, códigos e campos de localização.
    bruto=bruto.replace(/^(?:filial|loja|unidade)\s*#?\d+\s*(?:[-–—:•]\s*)?/i,'')
               .replace(/^\d{1,6}\s*[-–—:•]\s*/,'')
               .trim();
    // Mantém apenas o município antes de divisores de bairro/loja/setor.
    bruto=bruto.split(/\s*(?:[-–—|•;\/])\s*/)[0].trim();
    bruto=bruto.replace(/\s*\([^)]*\)\s*$/,'').trim();
    // Remove identificadores de unidade, bairro e estado sem tocar no nome da cidade.
    for(let tentativa=0;tentativa<3;tentativa++){
      const anterior=bruto;
      bruto=bruto.replace(/\s+(?:\d+|(?:I|II|III|IV|V|VI|VII|VIII|IX|X))$/i,'')
                 .replace(/\s+(?:centro|matriz|bairro|regional|regi[aã]o|setor|shopping|anexo|loja|unidade)\s*$/i,'')
                 .replace(/\s+MT$/i,'').trim();
      if(bruto===anterior)break;
    }
    // Siglas conhecidas, sem inferir municípios a partir de siglas ambíguas.
    const apelidos={
      'LRV':'Lucas do Rio Verde',
      'L R V':'Lucas do Rio Verde',
      'LUCAS RV':'Lucas do Rio Verde',
      'LUCAS DO RIO VERDE':'Lucas do Rio Verde',
      'N MUTUM':'Nova Mutum',
      'NOVA MUTUM':'Nova Mutum',
      'CUIABA':'Cuiabá',
      'VARZEA GRANDE':'Várzea Grande',
      'RONDONOPOLIS':'Rondonópolis'
    };
    const identificador=this.normalizar(bruto).toUpperCase().replace(/[.]/g,'').replace(/\s+/g,' ').trim();
    const nome=apelidos[identificador]||bruto;
    // Não exibir siglas com pontos ou marcadores de setor como se fossem cidades.
    if(!nome || /^(?:filial|bairro|setor|regional|regi[aã]o|loja|unidade)\b/i.test(nome))return '';
    if(/[|/•]/.test(nome))return '';
    return nome.split(' ').map((palavra,i)=>{
      if(i>0 && /^(de|da|do|das|dos|e)$/i.test(palavra))return palavra.toLowerCase();
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
