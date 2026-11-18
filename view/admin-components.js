/* Componentes administrativos leves; não altera a vitrine pública. */
const EdicaoSegura={
  alterados:new Set(),conflitos:new Set(),
  grupos:{vendedor:['editarMatricula','editarNomeVendedor','editarFilialVendedor','editarTelefoneProfissional','editarTelefonePessoal','editarAtivoVendedor','editarObservacoesVendedor'],
    convite:['contatosLinkGrupo','contatosConviteModelo'],campanha:['campanhaGeral'],
    aparencia:['tituloPadrao','mensagemPadrao','fileLogoPortal','filePadrao'],
    whatsapp:['whatsappTipoPessoa','whatsappMatricula','whatsappObservacao'],oferta:['tituloPagina','textoOferta','linkProduto','dataInicio','dataFim','fileInput']},
  sujo(g){return this.alterados.has(g);},
  marcar(g){this.alterados.add(g);},
  limpar(g){this.alterados.delete(g);this.conflitos.delete(g);const el=document.getElementById('edicaoAviso_'+g);if(el){el.textContent='';el.hidden=true;}},
  conflito(g,texto){this.conflitos.add(g);let el=document.getElementById('edicaoAviso_'+g);if(!el){const primeiro=document.getElementById(this.grupos[g]?.[0]);if(!primeiro)return;el=document.createElement('p');el.id='edicaoAviso_'+g;el.className='admin-aviso';el.setAttribute('role','status');primeiro.closest('.form-group')?.before(el);}el.textContent=texto;el.hidden=false;},
  init(){
    for(const evento of ['input','change'])document.addEventListener(evento,e=>{
      for(const [g,ids]of Object.entries(this.grupos))if(ids.includes(e.target.id))this.marcar(g);
    });
    window.addEventListener('beforeunload',e=>{if(this.alterados.size){e.preventDefault();e.returnValue='';}});
  }
};
const AdminComponents={
  combos:new Map(),modalAtual:null,focoAnterior:null,
  erroCampo(id,mensagem){
    const campo=document.getElementById(id);if(!campo)return;
    let el=document.getElementById(id+'Erro');
    if(!el){el=document.createElement('small');el.id=id+'Erro';el.className='campo-erro';campo.after(el);}
    el.textContent=mensagem;campo.setAttribute('aria-invalid',mensagem?'true':'false');
    campo.setAttribute('aria-describedby',el.id);campo.setCustomValidity?.(mensagem);
  },
  validarTelefone(campo){const msg=Telefones.erro(campo.value);this.erroCampo(campo.id,msg);return !msg;},
  mascara(campo){
    const pos=campo.selectionStart,antes=campo.value,digitosAntes=antes.slice(0,pos).replace(/\D/g,'').length;
    campo.value=Telefones.formato(antes);
    let i=0,count=0;while(i<campo.value.length&&count<digitosAntes){if(/\d/.test(campo.value[i]))count++;i++;}
    if(pos===antes.length)i=campo.value.length;
    campo.setSelectionRange(i,i);this.erroCampo(campo.id,'');
    VendedoresPresenter.atualizarIndicadoresTelefone?.();
  },
  combo(select){
    if(this.combos.has(select.id)||select.multiple)return;
    const antigo=document.getElementById('busca'+select.id);if(antigo)antigo.remove();
    const wrapper=document.createElement('div');wrapper.className='admin-combo';
    const input=document.createElement('input');input.type='text';input.autocomplete='off';input.id=select.id+'Busca';
    input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-expanded','false');
    input.setAttribute('aria-label',select.getAttribute('aria-label')||document.querySelector('label[for="'+select.id+'"]')?.textContent||'Selecionar opção');
    const list=document.createElement('div');list.id=select.id+'Opcoes';list.className='admin-combo-lista';list.setAttribute('role','listbox');list.hidden=true;
    input.setAttribute('aria-controls',list.id);select.before(wrapper);wrapper.append(input,list,select);
    select.hidden=true;select.tabIndex=-1;select.classList.add('admin-select-fonte');
    let options=[],ativo=-1;
    const fechar=()=>{list.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');};
    const refletir=()=>{if(document.activeElement!==input||list.hidden)input.value=select.selectedOptions[0]?.textContent||'';input.disabled=select.disabled;};
    const escolher=i=>{const o=options[i];if(!o||o.disabled)return;select.value=o.value;input.value=o.textContent;fechar();select.dispatchEvent(new Event('change',{bubbles:true}));input.focus();};
    const destacar=i=>{ativo=i;[...list.children].forEach((el,j)=>el.setAttribute('aria-selected',String(j===i)));if(i>=0&&options[i]&&list.children[i]){input.setAttribute('aria-activedescendant',list.children[i].id);list.children[i].scrollIntoView({block:'nearest'});}};
    const abrir=(filtrar=false)=>{
      const termo=FiliaisUI.normalizar(filtrar?input.value:'');
      options=[...select.options].filter(o=>!o.disabled&&(!termo||FiliaisUI.normalizar(o.textContent+' '+o.value).includes(termo)));
      list.replaceChildren();ativo=-1;
      options.forEach((o,i)=>{const el=document.createElement('div');el.id=list.id+'_'+i;el.role='option';el.textContent=o.textContent;el.setAttribute('aria-selected',String(o.value===select.value));el.addEventListener('mousedown',e=>e.preventDefault());el.addEventListener('click',()=>escolher(i));list.append(el);});
      if(!options.length){const el=document.createElement('p');el.textContent='Nenhuma opção encontrada';list.append(el);}
      list.hidden=false;input.setAttribute('aria-expanded','true');
    };
    input.addEventListener('focus',()=>abrir());input.addEventListener('input',()=>abrir(true));
    input.addEventListener('blur',()=>{fechar();refletir();});
    input.addEventListener('keydown',e=>{
      if(e.key==='Escape'){e.preventDefault();e.stopPropagation();fechar();refletir();}
      else if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(list.hidden)abrir();destacar(Math.max(0,Math.min(options.length-1,ativo+(e.key==='ArrowDown'?1:-1))));}
      else if(e.key==='Enter'&&!list.hidden){e.preventDefault();if(ativo>=0)escolher(ativo);}
    });
    select.addEventListener('change',refletir);new MutationObserver(()=>{if(list.hidden)refletir();else abrir(true);}).observe(select,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled']});
    document.querySelector('label[for="'+select.id+'"]')?.setAttribute('for',input.id);
    this.combos.set(select.id,{input,refletir,fechar});refletir();
  },
  atualizarCombos(){this.combos.forEach(c=>c.refletir());},
  init(){
    EdicaoSegura.init();
    document.querySelectorAll('input[type="tel"]').forEach(c=>{
      c.inputMode='tel';c.autocomplete='tel-national';c.placeholder='(DD) 9 1234-5678';
      c.addEventListener('input',()=>this.mascara(c));c.addEventListener('blur',()=>this.validarTelefone(c));
    });
    // Switches apenas para configurações booleanas; seleção múltipla continua checkbox.
    for(const id of ['rascunhoOferta','destaqueDiaOferta','editarAtivoVendedor']){
      const c=document.getElementById(id);if(c){c.classList.add('admin-switch');c.setAttribute('role','switch');}
    }
    for(const id of ['filtroFilialVendedor','filtroFilialLinks','linksDashboardFilial','contatosFilial','contatosOferta','dashboardFiltroOferta','dashboardFiltroCampanha','editarFilialVendedor']){
      const s=document.getElementById(id);if(s?.tagName==='SELECT')this.combo(s);
    }
    const dialogs=[...document.querySelectorAll('[role="dialog"],.vendor-modal')];
    const observar=()=>{
      const modal=dialogs.find(m=>!m.hidden&&getComputedStyle(m).display!=='none');
      if(modal===this.modalAtual)return;
      if(modal){this.focoAnterior=document.activeElement;this.modalAtual=modal;modal.setAttribute('aria-modal','true');
        modal.querySelector('input:not([type="hidden"]),button,select,textarea')?.focus();document.body.classList.add('admin-modal-aberto');
      }else{this.modalAtual=null;document.body.classList.remove('admin-modal-aberto');this.focoAnterior?.focus();}
    };
    dialogs.forEach(m=>new MutationObserver(observar).observe(m,{attributes:true,attributeFilter:['style','hidden']}));
    document.addEventListener('keydown',e=>{
      const m=this.modalAtual;if(!m||e.key!=='Tab')return;
      const f=[...m.querySelectorAll('button,input,select,textarea,a[href],[tabindex="0"]')].filter(x=>!x.disabled&&x.getClientRects().length);
      if(!f.length)return;
      if(e.shiftKey&&document.activeElement===f[0]){e.preventDefault();f.at(-1).focus();}
      else if(!e.shiftKey&&document.activeElement===f.at(-1)){e.preventDefault();f[0].focus();}
    });
    document.addEventListener('keydown',e=>{if(e.key!=='Escape'||!this.modalAtual)return;
      if(this.modalAtual.id==='modalEditarVendedor')VendedoresPresenter.fecharEdicao();
      if(this.modalAtual.id==='whatsappModal')WhatsAppPresenter.fechar();
    });
  }
};
window.addEventListener('DOMContentLoaded',()=>AdminComponents.init());
