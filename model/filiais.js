// v1.6.18.1 — município completo + filtro pesquisável em UMA única caixa.
// O identificador de filial permanece num select interno compatível com os apresentadores.
const FiliaisUI = {
  fonte:{}, campos:new Map(),
  definir(fonte){
    this.fonte=fonte||{};this.nomes=new Map();
    const grupos=new Map();
    for(const id of Object.keys(this.fonte).sort((a,b)=>Number(a)-Number(b))){
      const cidade=this.municipio(id),chave=this.normalizar(cidade);
      if(!cidade){this.nomes.set(id,`${id} • Município não cadastrado`);continue;}
      if(!grupos.has(chave))grupos.set(chave,[]);
      grupos.get(chave).push({id,cidade});
    }
    for(const lista of grupos.values())lista.forEach(({id,cidade},i)=>this.nomes.set(id,`${id} • ${cidade}${lista.length>1?' '+this.romano(i+1):''}`));
    this.ativarBuscas();
  },
  normalizar(x){return String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim();},
  // Exibe apenas o nome do município. A fonte preferida é a coluna C
  // "municipio" da aba Filiais. A coluna B "localidade" pode ter bairros,
  // regiões, siglas e descrições internas; não é fonte confiável por si só.
  municipio(codigo){
    let bruto=String(this.fonte[String(codigo)]||'').trim();
    if(!bruto)return '';
    bruto=bruto.replace(/\s+/g,' ').trim();
    // Um campo pode já conter o código ou tê-lo sido prefixado mais de uma vez
    // por importações antigas. Remova TODOS os prefixos repetidos, não só o primeiro.
    // Ex.: "118 • 118 • Alto Araguaia" -> "Alto Araguaia".
    for (let i=0;i<5;i++){
      const anterior=bruto;
      bruto=bruto.replace(/^(?:(?:filial|loja|unidade)\s*#?\s*)?\d{1,6}\s*(?:[-–—:•·.]\s*)/i,'')
                 .trim();
      if (bruto===anterior)break;
    }
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
    return this.nomes?.get(id)||`${id} • ${cidade}`;
  },
  ativarBuscas(){
    if(typeof AdminComponents==='undefined')return;
    document.querySelectorAll('input[id^="busca"]').forEach(input=>{const select=document.getElementById(input.id.slice(5));if(select?.tagName==='SELECT')AdminComponents.combo(select);});
  },
  buscar(){},
  limparCache(){if(typeof AdminComponents!=='undefined')AdminComponents.atualizarCombos();}
};
