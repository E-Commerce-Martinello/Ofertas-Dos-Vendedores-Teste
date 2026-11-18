/* Regras públicas puras; nenhuma matrícula é transmitida por este módulo. */
const PortalPreferencias = (()=>{
  function destaque(ativas,agora){return [...ativas].filter(o=>o.destaqueDia===true&&agora>=new Date(o.destaqueInicio||o.dataInicio)&&agora<=new Date(o.destaqueFim||o.dataFim)).sort((a,b)=>String(b.destaqueInicio||b.dataInicio||'').localeCompare(String(a.destaqueInicio||a.dataInicio||'')))[0]||null;}
  function inicial(ativas,lider,atual,manual,agora,aleatorio=Math.random){
    const existente=ativas.find(o=>String(o.id)===String(atual?.id));
    if(manual&&existente)return existente;
    return destaque(ativas,agora)||ativas.find(o=>String(o.id)===String(lider))||existente||ativas[Math.floor(aleatorio()*ativas.length)]||null;
  }
  function dia(data=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(data);}
  function deveAvisar(storage,chave,hoje){try{if(storage.getItem(chave)===hoje)return false;storage.setItem(chave,hoje);}catch(_){}return true;}
  return {destaque,inicial,dia,deveAvisar};
})();
if(typeof module!=='undefined')module.exports=PortalPreferencias;
