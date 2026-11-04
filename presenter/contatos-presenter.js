// Martinello 1.6.7 — filas de contato manual. Não envia WhatsApp sem confirmação.
// Cadastro e identificação permanecem no Google Sheets; nenhuma lista pessoal é persistida no navegador.
const ContatosPresenter = {
  selecionados: new Set(),
  carregando: false,
  registros: [],
  maximo: 20,
  contatosRecentes: [],
  contatosCarregados: false,
  _esc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c])); },
  _rubi(v) { return String(v ?? '').replace(/\D/g, ''); },
  _status(msg, sucesso=false) {
    const box = document.getElementById('contatosAviso');
    if (!box) return;
    box.className = `vendor-status ${sucesso ? 'ok' : ''}`;
    box.textContent = msg;
  },
  _oferta() {
    const id = document.getElementById('contatosOferta')?.value || '';
    return (AdminPresenter.ofertas || []).find(o => String(o.id) === id && isOfertaAtiva(o, getHorarioBrasilia()));
  },
  _candidatos() {
    if (!VendedoresPresenter.grupoCarregado) return [];
    return VendedoresPresenter.registros.filter(v => {
      if (!v.ativo || v.statusTelefone !== 'VALIDADO') return false;
      const n = GrupoWhatsAppModel.telefone(v.numero);
      return n && VendedoresPresenter._situacaoGrupo(v).codigo === 'fora';
    });
  },
  _atualizarOfertas() {
    const select = document.getElementById('contatosOferta');
    const atual = select.value;
    select.replaceChildren(new Option('Selecione uma oferta ativa', ''));
    (AdminPresenter.ofertas || []).filter(o => isOfertaAtiva(o, getHorarioBrasilia()))
      .forEach(o => select.add(new Option(o.tituloPagina || `Oferta ${o.id}`, String(o.id))));
    if ([...select.options].some(op=>op.value === atual)) select.value = atual;
    else if (select.options.length === 2) select.selectedIndex = 1;
  },
  _atualizarFiliais() {
    const select = document.getElementById('contatosFilial');
    const atual = select.value;
    const filiais = [...new Set(this._candidatos().map(v => v.filial))].filter(Boolean)
      .sort((a,b) => String(a).localeCompare(String(b),'pt-BR',{numeric:true}));
    select.replaceChildren(new Option('Todas as filiais', ''));
    filiais.forEach(f=> select.add(new Option(`Filial ${f}${VendedoresPresenter.filiais[f]?' — '+VendedoresPresenter.filiais[f]:''}`, f)));
    if (filiais.includes(atual)) select.value = atual;
  },
  init() {
    if (!this.contatosCarregados && !this.carregando && Auth.usuarioAtual()) {
      this.carregando=true;
      GoogleSheetsService.listarContatosRecentes().then(res => {
        this.contatosRecentes = res.contatos || [];
        this.contatosCarregados=true;
        this.renderizarFila();
      }).catch(e=>console.warn('Histórico de contatos não disponível:',e))
        .finally(()=>{this.carregando=false;});
    }
    this._atualizarOfertas();
    this._atualizarFiliais();
    this.renderizar();
  },
  _filtrados() {
    const filial = document.getElementById('contatosFilial').value;
    const termo = document.getElementById('contatosBuscar').value.trim().toLocaleLowerCase('pt-BR');
    return this._candidatos().filter(v => (!filial || String(v.filial) === filial)
      && (!termo || (v.nome+' '+v.matricula).toLocaleLowerCase('pt-BR').includes(termo)));
  },
  renderizar() {
    const candidatos = this._candidatos();
    const elegiveis = new Set(candidatos.map(v => this._rubi(v.matricula)));
    [...this.selecionados].forEach(id => { if (!elegiveis.has(id)) this.selecionados.delete(id); });
    const lista = this._filtrados();
    if (!VendedoresPresenter.registros.length) this._status('Aguardando carregar o cadastro de vendedores.');
    else if (!VendedoresPresenter.grupoCarregado) this._status('Aguarde carregar a lista de participantes do WhatsApp. Sem ela, não é seguro identificar quem está fora do grupo.');
    else this._status(`${candidatos.length} vendedores elegíveis: ativos, telefone validado, sem número repetido e fora do grupo.`, true);
    document.getElementById('contatosContador').textContent = `${this.selecionados.size} de ${this.maximo} selecionados`;
    const destino = document.getElementById('contatosElegiveis');
    destino.innerHTML = lista.slice(0,120).map(v => {
      const id=this._rubi(v.matricula);
      return `<label class="contatos-linha" role="listitem"><input type="checkbox" data-selecionar="${id}" ${this.selecionados.has(id)?'checked':''}>
        <span class="contatos-conteudo"><strong>${this._esc(v.nome)}</strong><small>Rubi ${this._esc(id)} · Filial ${this._esc(v.filial)} · ${this._esc(VendedoresPresenter._exibirTelefone(v.numero))}</small></span></label>`;
    }).join('') || '<p class="vendor-empty">Nenhum vendedor elegível com esse filtro. Revise os telefones e a lista de participantes.</p>';
    if (lista.length > 120) destino.insertAdjacentHTML('beforeend', `<p class="vendor-subtext">Exibindo os primeiros 120 de ${lista.length} resultados. Use a pesquisa ou a filial para refinar.</p>`);
    destino.querySelectorAll('[data-selecionar]').forEach(el=>el.addEventListener('change',()=>{
      if (el.checked && this.selecionados.size >= this.maximo) {
        el.checked = false; UI.erro(`Selecione no máximo ${this.maximo} vendedores por lote.`); return;
      }
      if (el.checked) this.selecionados.add(el.dataset.selecionar);
      else this.selecionados.delete(el.dataset.selecionar);
      this.renderizarFila();
      document.getElementById('contatosContador').textContent = `${this.selecionados.size} de ${this.maximo} selecionados`;
    }));
    this.renderizarFila();
  },
  selecionarAte20() {
    for (const v of this._filtrados()) {
      if (this.selecionados.size>=this.maximo) break;
      this.selecionados.add(this._rubi(v.matricula));
    }
    this.renderizar();
  },
  limparSelecao() { this.selecionados.clear(); this.renderizar(); },
  abrirVendedor(rubi) {
    AdminPresenter.mostrarAba('contatos');
    const id = this._rubi(rubi);
    if (this._candidatos().some(v=>this._rubi(v.matricula)===id)) {
      if (this.selecionados.size >= this.maximo && !this.selecionados.has(id)) this.selecionados.delete(this.selecionados.values().next().value);
      this.selecionados.add(id);
      this.renderizar();
      document.getElementById('contatosFila').scrollIntoView({behavior:'smooth',block:'nearest'});
    } else UI.erro('Este vendedor não atende aos critérios de contato seguro. Confira o cadastro e o grupo.');
  },
  atualizarOferta() { this.renderizarFila(); },
  _linkGrupo() {
    const url = document.getElementById('contatosLinkGrupo').value.trim();
    return /^https:\/\/chat\.whatsapp\.com\/[a-zA-Z0-9]+(?:\?[a-zA-Z0-9_=&%-]+)?$/.test(url) ? url : '';
  },
  _mensagens(v, oferta) {
    const n = GrupoWhatsAppModel.telefone(v.numero);
    if (!n) return null;
    const link = `${CONFIG.urlBase}${this._rubi(v.matricula)}?redir=${encodeURIComponent(oferta.linkProduto || '')}`;
    const ofertaTexto = formatarTexto(String(oferta.textoOferta || ''), link, this._rubi(v.matricula));
    const conviteModelo = document.getElementById('contatosConviteModelo').value;
    const grupo = this._linkGrupo();
    const conviteTexto = conviteModelo.replace(/\[(NOME|RUBI|FILIAL|LINK_GRUPO)\]/g, (_,k)=>({
      NOME:v.nome, RUBI:this._rubi(v.matricula), FILIAL:v.filial, LINK_GRUPO:grupo
    })[k]);
    return { n, ofertaTexto, conviteTexto, grupo, imagem: oferta.urlImagem || 'img/produto.png' };
  },
  renderizarFila() {
    const destino = document.getElementById('contatosFila');
    const oferta = this._oferta();
    const participantes = [...this.selecionados].map(id => VendedoresPresenter.registros.find(v => this._rubi(v.matricula)===id)).filter(Boolean);
    if (!participantes.length) { destino.innerHTML='<p class="vendor-empty">Selecione vendedores para preparar as mensagens.</p>';return; }
    if (!oferta) { destino.innerHTML='<p class="vendor-empty">Selecione uma oferta ativa para preparar a fila.</p>';return; }
    destino.innerHTML = participantes.map(v => {
      const rubi=this._rubi(v.matricula);
      const linkGrupoOk=!!this._linkGrupo();
      const hoje=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Cuiaba',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
      const abordadoHoje = this.contatosRecentes.some(c => c.matricula === rubi && String(c.ofertaId) === String(oferta.id)
        && c.status === 'MARCADO_PELO_OPERADOR' && c.confirmadoEm
        && new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Cuiaba',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(c.confirmadoEm)) === hoje);
      return `<article class="contatos-linha" role="listitem"><div class="contatos-conteudo"><strong>${this._esc(v.nome)}</strong>
        <small>Rubi ${rubi} · ${this._esc(VendedoresPresenter._exibirTelefone(v.numero))} · ${linkGrupoOk?'Convite configurado':'Informe o link do grupo para habilitar o convite'}</small>
        <small>O WhatsApp abre com texto preenchido; anexe o banner separadamente.</small></div>
        <div class="contatos-acoes">
          <button type="button" class="btn-outline" data-acao="copiar" data-rubi="${rubi}">COPIAR OFERTA</button>
          <button type="button" class="btn-outline" data-acao="imagem" data-rubi="${rubi}">COPIAR BANNER</button>
          <button type="button" class="btn-outline" data-acao="abrirImagem" data-rubi="${rubi}">ABRIR BANNER</button>
          <button type="button" class="btn-primary" data-acao="oferta" data-rubi="${rubi}">ABRIR OFERTA</button>
          <button type="button" class="btn-outline" data-acao="convite" data-rubi="${rubi}" ${linkGrupoOk?'':'disabled'}>ABRIR CONVITE</button>
          <button type="button" class="btn-outline" data-acao="registrar" data-rubi="${rubi}" ${abordadoHoje?'disabled':''}>${abordadoHoje?'ABORDADO HOJE':'MARCAR ABORDADO'}</button>
        </div></article>`;
    }).join('');
    destino.querySelectorAll('button[data-acao]').forEach(b => b.addEventListener('click',()=>this.executar(b)));
  },
  async executar(botao) {
    const rubi=botao.dataset.rubi;
    const acao=botao.dataset.acao;
    const v=VendedoresPresenter.registros.find(x=>this._rubi(x.matricula)===rubi);
    const oferta=this._oferta();
    if (!v || !oferta || !this._candidatos().some(x=>this._rubi(x.matricula)===rubi)) {
      UI.erro('Atualize a base e confira a oferta e o telefone antes de continuar.');return;
    }
    const msgs=this._mensagens(v,oferta);
    if (!msgs) { UI.erro('Telefone não está válido.');return; }
    if (acao==='oferta' || acao==='convite') {
      if (acao==='convite' && !msgs.grupo) { UI.erro('Informe um link válido de convite do WhatsApp.');return; }
      // O clique gera uma única conversa; o envio nunca é automatizado.
      const texto = acao==='oferta' ? msgs.ofertaTexto : msgs.conviteTexto;
      window.open(`https://wa.me/55${msgs.n}?text=${encodeURIComponent(texto)}`,'_blank','noopener,noreferrer');
      return;
    }
    if (acao==='copiar') {
      try { await navigator.clipboard.writeText(msgs.ofertaTexto); UI.ok('Texto da oferta copiado.'); }
      catch(_) { UI.erro('O navegador não permitiu copiar o texto.'); }
      return;
    }
    if (acao==='abrirImagem') {
      if (msgs.imagem.startsWith('data:')) {
        try {
          const [cab,conteudo]=msgs.imagem.split(',',2);
          const mime=(cab.match(/^data:([^;]+);base64$/)||[])[1];
          if (!mime) throw new Error('Imagem inválida');
          const dados=atob(conteudo);
          const bytes=Uint8Array.from(dados,c=>c.charCodeAt(0));
          const ref=URL.createObjectURL(new Blob([bytes],{type:mime}));
          window.open(ref,'_blank','noopener,noreferrer');
          setTimeout(()=>URL.revokeObjectURL(ref),5*60*1000);
        } catch(e) { UI.erro('Não foi possível abrir o banner.'); }
      } else window.open(msgs.imagem,'_blank','noopener,noreferrer');
      return;
    }
    if (acao==='imagem') {
      try {
        if (!navigator.clipboard?.write || typeof ClipboardItem==='undefined') throw new Error('Clipboard não disponível');
        const r = await fetch(msgs.imagem);
        if (!r.ok) throw new Error('Imagem indisponível');
        let blob=await r.blob();
        if (blob.type!=='image/png') {
          const bitmap=await createImageBitmap(blob);
          const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;
          canvas.getContext('2d').drawImage(bitmap,0,0);
          blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
          bitmap.close?.();
        }
        if (!blob) throw new Error('Imagem indisponível');
        await navigator.clipboard.write([new ClipboardItem({'image/png':blob})]);
        UI.ok('Banner copiado. Cole a imagem na conversa do WhatsApp.');
      } catch (err) {
        // Fallback transparente: abrir a imagem não envia nada automaticamente.
        UI.erro('Não foi possível copiar a imagem. Utilize o botão ABRIR BANNER para compartilhá-la manualmente.');
      }
      return;
    }
    if (acao==='registrar') {
      if (!confirm(`Você já realizou o contato manual com ${v.nome}? Registrar essa confirmação na planilha?`)) return;
      botao.disabled=true;
      try {
        const result = await GoogleSheetsService.registrarContatoRealizado(rubi, String(oferta.id));
        if (result.duplicado) UI.ok('Esse contato já foi marcado hoje na planilha.');
        else UI.ok('Contato marcado manualmente e registrado em Historico_Contatos.');
        this.contatosRecentes.push({ matricula:rubi, ofertaId:String(oferta.id), status:'MARCADO_PELO_OPERADOR', confirmadoEm:new Date().toISOString() });
        this.renderizarFila();
      } catch(e) { botao.disabled=false;UI.erro(e.message||'Não foi possível registrar o contato.'); }
    }
  },
  limpar() {
    this.selecionados.clear();
    this.contatosRecentes=[];
    this.contatosCarregados=false;
    const a=document.getElementById('contatosLinkGrupo');if(a)a.value='';
    const b=document.getElementById('contatosBuscar');if(b)b.value='';
  }
};
