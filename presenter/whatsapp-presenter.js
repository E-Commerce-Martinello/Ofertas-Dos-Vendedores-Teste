const WhatsAppPresenter = {
  participantes: [], identificacoes: [], previa: null, tipoPrevia:'colar',
  arquivo:null, importando:false, origemPrevia:'',
  pagina:1, porPagina:15, editando:'', carregando:false, grupoCarregado:false,
  _esc(v) { return VendedoresPresenter._escapar(v); },
  _status(txt,tipo='') { const e=document.getElementById('whatsappStatus'); if(e){e.className='vendor-status '+tipo; e.textContent=txt;} },
  async carregar() {
    if (this.carregando) return;
    this.carregando=true; this._status('Consultando participantes no Google Sheets...');
    try {
      if (!VendedoresPresenter.registros.length && !VendedoresPresenter.carregando) await VendedoresPresenter.atualizar();
      if (!VendedoresPresenter.registros.length) throw new Error('Aguarde o carregamento da base de vendedores e tente novamente.');
      const dados=await GoogleSheetsService.listarWhatsApp();
      this.participantes=dados.participantes||[];
      this.grupoCarregado = true;
      this.identificacoes=dados.identificacoes||[];
      this.pagina=1;
      this.renderizar();
      VendedoresPresenter.atualizarGrupo();
      this._status(`${this.participantes.length} participantes na lista atual. Telefones exibidos em DDD + 9 + 8 dígitos.`, 'ok');
    } catch(e) { this._status(e.message,'error'); }
    finally {this.carregando=false;}
  },
  agendarBusca() {
    clearTimeout(this._timerBusca);
    this._timerBusca=setTimeout(()=>{this.pagina=1;this.renderizar();},160);
  },
  selecionarArquivo(input) {
    this.arquivo = input?.files?.[0] || null;
    this.previa = null;
    document.getElementById('whatsappPrevia').hidden = true;
    const info = document.getElementById('whatsappArquivoInfo');
    if (info) info.textContent = this.arquivo
      ? `${this.arquivo.name} — ${(this.arquivo.size / 1024).toFixed(1)} KB`
      : 'Nenhum arquivo selecionado.';
    this._status(this.arquivo ? 'Arquivo selecionado. Clique em ANÁLISE DO ARQUIVO.' : 'Selecione o relatório exportado do WhatsApp.');
  },
  async preverArquivo() {
    if (!this.arquivo) { this._status('Selecione o arquivo de participantes primeiro.', 'error'); return; }
    if (this.arquivo.size > 8 * 1024 * 1024) { this._status('O arquivo excede 8 MB.', 'error'); return; }
    const botao = document.getElementById('whatsappAnalisarArquivo');
    if (botao) botao.disabled=true;
    this._status('Lendo o arquivo no navegador, sem enviar a planilha inteira...');
    try {
      await PlanilhaLoader.garantir();
      const bytes = await this.arquivo.arrayBuffer();
      const workbook = XLSX.read(bytes, { type:'array', cellText:true, cellFormula:false, cellHTML:false });
      const resultado = GrupoWhatsAppModel.analisarWorkbook(workbook);
      if (!resultado.registros.length) throw new Error('Nenhum participante válido encontrado. Confira se o arquivo possui displayName e mobile.');
      if (resultado.registros.length > 1500) throw new Error('A importação aceita até 1.500 participantes por vez.');
      this.previa=resultado.registros;
      this.tipoPrevia='arquivo';
      this.origemPrevia=`Arquivo ${this.arquivo.name}`;
      this._mostrarPrevia(resultado.registros.length, resultado.ignorados + resultado.duplicados, this.origemPrevia);
      if (resultado.avisos.length) {
        const nota = document.getElementById('whatsappPreviaAvisos');
        if (nota) nota.textContent = `${resultado.avisos.length} linha(s) sem nome ou telefone válido foram ignoradas. Ex.: ${resultado.avisos.slice(0,3).join(' | ')}`;
      }
    } catch(e) {
      this.previa=null;
      document.getElementById('whatsappPrevia').hidden=true;
      this._status(e.message || 'Não foi possível ler o arquivo.', 'error');
    } finally { if (botao) botao.disabled=false; }
  },
  preverTexto() {
    const texto=document.getElementById('whatsappColar').value;
    const r=GrupoWhatsAppModel.analisarTexto(texto);
    if (!r.registros.length || r.erros.length) {
      this.previa=null;
      this._status(r.erros.length?`Existem ${r.erros.length} linhas inválidas. ${r.erros.slice(0,3).join(' ')}`:'Cole ao menos uma linha Nome;Telefone.','error');
      document.getElementById('whatsappPrevia').hidden=true;
      return;
    }
    this.previa=r.registros; this.tipoPrevia='colar'; this.origemPrevia='Texto colado'; this._mostrarPrevia(r.registros.length,r.duplicados, 'Texto colado');
  },
  _mostrarPrevia(total, ignorados, origem) {
    const p=document.getElementById('whatsappPrevia'); p.hidden=false;
    document.getElementById('whatsappPreviaTexto').textContent=`${origem}: ${total} números únicos; ${ignorados} linhas ignoradas ou repetidas. A lista anterior será substituída; identificações manuais serão preservadas.`;
    const nota=document.getElementById('whatsappPreviaAvisos'); if (nota) nota.textContent='';
    const amostra=document.getElementById('whatsappPreviaAmostra');
    if (amostra) amostra.textContent = (this.previa || []).slice(0,3)
      .map(r => `${r.nome} · telefone final ${String(r.telefone).slice(-4)}`).join(' | ');
    this._status('Prévia pronta. Confira a quantidade antes de substituir.');
  },
  async importar() {
    if (!this.previa?.length || this.importando) return;
    const anteriores=this.participantes.length;
    const reducao=anteriores>=20 && this.previa.length<anteriores*0.7;
    const detalhe=reducao?' ATENÇÃO: a nova lista é mais de 30% menor do que a anterior.':'';
    if (!confirm(`Substituir a lista atual (${anteriores}) por ${this.previa.length} participantes?${detalhe}\nOs cadastros oficiais e as identificações manuais NÃO serão alterados.`)) return;
    if (reducao && !confirm('Confirma novamente a redução significativa da lista de participantes?')) return;
    this.importando=true;
    const btn=document.getElementById('whatsappConfirmarImportacao');
    if (btn) btn.disabled=true;
    this._status('Atualizando a lista do grupo no Sheets...');
    try {
      const resposta=await GoogleSheetsService.importarWhatsApp({
        origem:'colar',
        registros:this.previa,
        confirmado:true, aceitarReducao:reducao
      });
      if (!Number.isInteger(Number(resposta.total)) || Number(resposta.total)!==this.previa.length) {
        throw new Error('A API não confirmou a quantidade esperada. Confira a lista no Google Sheets antes de repetir.');
      }
      this.previa=null;
      document.getElementById('whatsappPrevia').hidden=true;
      await this.carregar();
      this._status(`${resposta.total} participantes gravados no Sheets. Telefones dos vendedores preservados.`, 'ok');
    } catch(e) {this._status(e.message,'error');}
    finally { this.importando=false; if (btn) btn.disabled=false; }
  },
  async normalizarExistentes() {
    if (this.importando) return;
    try {
      const previa = await GoogleSheetsService.normalizarWhatsApp({simular:true});
      if (previa.invalidos?.length || previa.conflitos?.length) {
        throw new Error(`Há ${previa.invalidos?.length||0} número(s) inválido(s) e ${previa.conflitos?.length||0} associação(ões) conflitante(s). Nada foi alterado. Revise a planilha.`);
      }
      const resumo = `Lista atual: ${previa.participantes} participantes; ${previa.alteracoesGrupo} chaves a ajustar. ` +
        `Identificações: ${previa.identificacoes}; ${previa.alteracoesManuais} chaves a ajustar. ` +
        `${previa.duplicadosGrupo} possível(is) duplicata(s) consolidadas.\n` +
        'A operação preservará números originais e os telefones oficiais dos vendedores. Deseja confirmar?';
      if (!confirm(resumo)) return;
      this.importando=true;
      this._status('Padronizando os números já existentes na planilha...');
      const r=await GoogleSheetsService.normalizarWhatsApp({confirmado:true});
      await this.carregar();
      this._status(`Padronização concluída: ${r.alteracoesGrupo} participantes e ${r.alteracoesManuais} identificações atualizadas.`, 'ok');
    } catch(e) { this._status(e.message||'Falha ao padronizar.', 'error'); }
    finally { this.importando=false; }
  },
  _registrosClassificados() {
    const base=VendedoresPresenter.registros || [];
    return this.participantes.map(p=>({...p, classificacao:GrupoWhatsAppModel.classificar(p,base,this.identificacoes)}));
  },
  renderizar() {
    const lista = this._registrosClassificados();
    const totais = {vendedor:0,identificado:0,revisar:0,inativo:0,desconhecido:0};
    lista.forEach(p => { totais[p.classificacao.situacao] = (totais[p.classificacao.situacao] || 0) + 1; });
    for (const [id,n] of [['whatsappTotal',lista.length],['whatsappVendedores',totais.vendedor],['whatsappRevisar',totais.revisar],['whatsappInativos',totais.inativo],['whatsappDesconhecidos',totais.desconhecido]]) {
      const el = document.getElementById(id); if (el) el.textContent = String(n);
    }
    // Os vendedores identificados estão na lista única acima. Esta seção trata apenas de exceções e pessoas externas.
    const estado = document.getElementById('whatsappFiltro')?.value || '';
    const busca = (document.getElementById('whatsappBusca')?.value || '').toLocaleLowerCase('pt-BR').trim();
    const vistos = lista.filter(p => p.classificacao.situacao !== 'vendedor' &&
      (!estado || p.classificacao.situacao === estado) &&
      (!busca || [p.nome,p.telefone,p.classificacao.matricula,p.classificacao.vendedor?.nome]
         .some(v => String(v || '').toLocaleLowerCase('pt-BR').includes(busca))));
    const paginas = Math.max(1, Math.ceil(vistos.length / this.porPagina));
    this.pagina = Math.min(Math.max(this.pagina,1),paginas);
    const atual = vistos.slice(0,this.pagina*this.porPagina);
    const statusNome = { identificado:'GERENTE / OUTRO', revisar:'REVISAR', inativo:'INATIVO · AVALIAR REMOÇÃO DO GRUPO', desconhecido:'NÃO IDENTIFICADO' };
    const classe = { identificado:'success', revisar:'review', inativo:'inactive', desconhecido:'unknown' };
    const corpo = document.getElementById('whatsappLinhas');
    corpo.innerHTML = atual.map(p => {
      const c = p.classificacao;
      return `<article class="vendor-entry" role="listitem">
        <div class="vendor-entry-main"><span class="vendor-entry-name">${this._esc(p.nome)}</span><small>Participante da lista do grupo</small></div>
        <div class="vendor-entry-field"><span class="field-label">Telefone do grupo</span><strong>${this._esc(VendedoresPresenter._exibirTelefone(p.telefone))}</strong></div>
        <div class="vendor-entry-field"><span class="field-label">Identificação</span><span class="vendor-badge ${classe[c.situacao] || 'unknown'}">${statusNome[c.situacao] || 'REVISAR'}</span>
          <small>${this._esc(c.vendedor?.nome || c.matricula || '—')}</small></div>
        <div class="vendor-entry-field"><span class="field-label">Motivo</span><small>${this._esc(c.motivo)}</small></div>
        <div class="vendor-entry-actions"><button type="button" class="vendor-small-btn primary" data-tel="${this._esc(p.telefone)}">IDENTIFICAR</button></div>
      </article>`;
    }).join('') || '<p class="vendor-empty">Nenhum participante externo ou pendente encontrado.</p>';
    corpo.querySelectorAll('[data-tel]').forEach(b => b.addEventListener('click', () => this.abrirIdentificacao(b.dataset.tel)));
    document.getElementById('whatsappPagina').textContent = `Exibindo ${atual.length} de ${vistos.length} participantes para revisão`;
    document.getElementById('whatsappAnterior').disabled = this.pagina <= 1;
    document.getElementById('whatsappProxima').disabled = this.pagina >= paginas;
  },
  mover(n) {this.pagina=Math.max(1,this.pagina+n);this.renderizar();if(n<0)document.getElementById('whatsappLinhas')?.scrollIntoView({block:'start',behavior:'smooth'});},
  abrirIdentificacao(telefone) {
    const participante=this.participantes.find(v=>GrupoWhatsAppModel.telefone(v.telefone)===GrupoWhatsAppModel.telefone(telefone));
    if (!participante) return;
    const manual=this.identificacoes.find(v=>GrupoWhatsAppModel.telefone(v.telefone)===GrupoWhatsAppModel.telefone(telefone));
    this.editando=telefone;
    document.getElementById('whatsappEditando').textContent=`${participante.nome} · ${participante.telefone}`;
    const classificado=GrupoWhatsAppModel.classificar(participante, VendedoresPresenter.registros||[], this.identificacoes);
    document.getElementById('whatsappTipoPessoa').value=manual?.tipo||(classificado.situacao==='vendedor'?'VENDEDOR':'GERENTE');
    document.getElementById('whatsappMatricula').value=manual?.matricula||classificado.matricula||'';
    document.getElementById('whatsappObservacao').value=manual?.observacao||'';
    this.mostrarMatricula();
    this.mostrarComparacao();
    document.getElementById('whatsappModal').style.display='flex';
  },
  mostrarMatricula() {
    const vendedor = document.getElementById('whatsappTipoPessoa').value === 'VENDEDOR';
    document.getElementById('whatsappMatriculaBloco').hidden = !vendedor;
    document.getElementById('whatsappAtualizarTelefone').hidden = !vendedor;
    this.mostrarComparacao();
  },
  mostrarComparacao() {
    const painel=document.getElementById('whatsappComparacao');
    if (!painel) return;
    if (document.getElementById('whatsappTipoPessoa').value !== 'VENDEDOR') {
      painel.textContent='Essa classificação não modifica cadastros de vendedores.';
      return;
    }
    const matricula=String(document.getElementById('whatsappMatricula').value||'').replace(/\D/g,'');
    const vendedor=VendedoresPresenter.registros.find(v=>String(v.matricula).replace(/\D/g,'')===matricula);
    const telefone=GrupoWhatsAppModel.telefone(this.editando);
    if (!vendedor) { painel.textContent='Informe um Rubi válido para comparar com o cadastro oficial.'; return; }
    const antigo=GrupoWhatsAppModel.telefone(vendedor.numero);
    const status=vendedor.statusTelefone||'PENDENTE';
    painel.textContent=`${vendedor.nome} (Rubi ${matricula}) • telefone atual: ${antigo||'não informado'} (${status}) • telefone do grupo: ${telefone||'inválido'}. ` +
      (antigo===telefone?'Os números coincidem.':'A atualização substituirá o telefone oficial somente se você escolher essa ação e confirmar.');
  },
  fechar() {document.getElementById('whatsappModal').style.display='none';},
  async salvar(remover=false, atualizarTelefone=false) {
    const tipo=remover?'REMOVER':document.getElementById('whatsappTipoPessoa').value;
    const matricula=document.getElementById('whatsappMatricula').value;
    const observacao=document.getElementById('whatsappObservacao').value;
    const oficial=VendedoresPresenter.registros.find(v=>String(v.matricula).replace(/\D/g,'')===String(matricula).replace(/\D/g,''));
    const novo=GrupoWhatsAppModel.telefone(this.editando);
    if (atualizarTelefone) {
      if (tipo!=='VENDEDOR' || !oficial) { UI.erro('Escolha um vendedor cadastrado antes de alterar o telefone.'); return; }
      const anterior=GrupoWhatsAppModel.telefone(oficial.numero);
      const aviso=`Confirmar atualização da base OFICIAL?\n\n${oficial.nome} (Rubi ${matricula})\n` +
        `Telefone anterior: ${anterior || 'não informado'}\nNovo telefone: ${novo}\n\n` +
        'O número será marcado como VALIDADO e a alteração será registrada na auditoria.';
      if (!confirm(aviso)) return;
    }
    const btn=document.getElementById('whatsappSalvar');
    const btnAtualizar=document.getElementById('whatsappAtualizarTelefone');
    btn.disabled=true; btnAtualizar.disabled=true;
    try {
      const r=await GoogleSheetsService.salvarIdentificacaoWhatsApp({
        telefone:this.editando,tipo,matricula,observacao,
        atualizarTelefone,confirmarSubstituicao:atualizarTelefone
      });
      this.fechar();
      if (r.telefoneAtualizado) await VendedoresPresenter.atualizar();
      await this.carregar();
      UI.ok(remover?'Identificação manual removida.':r.telefoneAtualizado?'Associação e telefone oficial atualizados com sucesso.':'Identificação salva. Telefone oficial preservado.');
    } catch(e) { UI.erro(e.message); }
    finally {btn.disabled=false;btnAtualizar.disabled=false;}
  }
};
