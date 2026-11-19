/* Coordenador testável: uma requisição em voo, pausa, backoff e sinais agrupados. */
class CoordenadorSync {
  constructor({ler,aplicar,status=()=>{},ativo=()=>true,agendar=(fn,ms)=>setTimeout(fn,ms),cancelar=id=>clearTimeout(id),agora=()=>Date.now(),aleatorio=Math.random}) {
    Object.assign(this,{ler,aplicar,status,ativo,agendar,cancelar,agora,aleatorio});
    this.revisions={};this.timer=null;this.emVoo=null;this.parado=true;this.geracao=0;this.falhas=0;this.ultimo=0;this.pendente=false;
  }
  iniciar(){this.parado=false;return this.verificar();}
  parar(){this.parado=true;this.geracao++;this.cancelar(this.timer);this.timer=null;this.revisions={};}
  sinal(){if(this.parado)return;this.pendente=true;this.programar(Math.max(1500,30000-(this.agora()-this.ultimo)));}
  programar(ms){this.cancelar(this.timer);if(!this.parado)this.timer=this.agendar(()=>this.verificar(),ms);}
  async verificar(){
    if(this.parado)return;
    if(this.emVoo){this.pendente=true;return this.emVoo;}
    if(!this.ativo()){this.status('pausado');this.programar(90000);return;}
    const geracao=this.geracao;this.pendente=false;this.ultimo=this.agora();this.status('atualizando');
    this.emVoo=(async()=>{
      try{
        const r=await this.ler(this.revisions);
        if(this.parado||geracao!==this.geracao)return;
        await this.aplicar(r);
        if(this.parado||geracao!==this.geracao)return;
        this.revisions=r.revisions;this.falhas=0;this.status('atualizado',r.verificadoEm);
      }catch(e){if(!this.parado&&geracao===this.geracao){this.falhas++;this.status('erro',e.message);}}
      finally{
        this.emVoo=null;
        if(!this.parado&&geracao===this.geracao){
          const espera=this.falhas?Math.min(900000,90000*2**this.falhas):this.pendente?30000:90000+Math.floor(this.aleatorio()*15000);
          this.programar(espera);
        }
      }
    })();
    return this.emVoo;
  }
}
if(typeof module!=='undefined')module.exports=CoordenadorSync;

const AdminSync = {
  capacidades:null,coordenador:null,pararPush:null,pararAparencia:null,
  status(estado,detalhe=''){
    if(typeof DiagnosticoUso!=='undefined')DiagnosticoUso.sincronizacao(estado);
    const el=document.getElementById('adminSyncStatus');if(!el)return;
    const textos={atualizando:'Conferindo atualizações…',atualizado:'Dados administrativos atualizados',
      pausado:navigator.onLine?'Atualização pausada nesta aba':'Sem conexão — dados podem estar desatualizados',
      erro:'Conexão indisponível — nova tentativa automática',indisponivel:'Não foi possível verificar o backend — edição bloqueada; confira a conexão e entre novamente',incompativel:'Atualização do backend pendente — edição de cadastros bloqueada'};
    el.dataset.estado=estado;el.textContent=textos[estado]||estado;
    el.title=estado==='atualizado'?'Última conferência: '+new Date(detalhe).toLocaleString('pt-BR'):detalhe;
  },
  async iniciar(){
    this.parar();
    this._iniciarAparencia();
    try{
      this.capacidades=(await GoogleSheetsService._post('consultarCapacidades')).resultado;
      if(!this.capacidades?.sincronizacao)throw new Error('Backend sem suporte v1.6.19.');
    }catch(e){this.capacidades=null;const incompatibilidade=/Backend sem suporte|[Aa]ção não reconhecida|[Oo]peração desconhecida/.test(e.message);this.status(incompatibilidade?'incompativel':'indisponivel',e.message);return false;}
    this.coordenador=new CoordenadorSync({
      ler:async revisions=>(await GoogleSheetsService._post('sincronizarAdmin',{revisions})).resultado,
      aplicar:r=>this.aplicar(r),status:(...a)=>this.status(...a),
      ativo:()=>!document.hidden&&navigator.onLine&&AdminPresenter._autorizado
    });
    this._acordar=()=>this.coordenador?.sinal();
    this._mudou=()=>this.coordenador?.sinal();
    document.addEventListener('visibilitychange',this._acordar);window.addEventListener('online',this._acordar);
    window.addEventListener('offline',this._acordar);window.addEventListener('mart:gravado',this._mudou);
    if(this.capacidades.push){
      const ref=database.ref('adminSync'+sufixoAmbiente);
      const cb=()=>this.coordenador?.sinal();ref.on('value',cb,()=>{this.status('Notificações indisponíveis — conferência periódica ativa');});
      this.pararPush=()=>ref.off('value',cb);
    }
    await this.coordenador.iniciar();return true;
  },
  parar(){
    this.coordenador?.parar();this.coordenador=null;this.capacidades=null;
    this.pararPush?.();this.pararPush=null;this.pararAparencia?.();this.pararAparencia=null;
    document.removeEventListener('visibilitychange',this._acordar);window.removeEventListener('online',this._acordar);
    window.removeEventListener('offline',this._acordar);window.removeEventListener('mart:gravado',this._mudou);
    GoogleSheetsService._leituras?.clear();GoogleSheetsService._snapshots?.clear();
  },
  exigirEdicao(){
    if(!this.capacidades?.edicaoCompleta)throw new Error('A edição segura depende do backend v1.6.19. Instale e valide a API de homologação antes de salvar.');
  },
  async aplicar(r){
    if(!r||r.versao!=='1.6.19'||!r.revisions||!r.dados)throw new Error('Resposta de sincronização inválida.');
    const d=r.dados,guardar=(acao,resultado)=>GoogleSheetsService._snapshots.set(acao,{ok:true,resultado});
    // Memória da sessão, nunca localStorage ou cache de rede.
    if(d.core){
      const c=d.core;
      guardar('listarVendedores',{linhas:c.linhas,filiais:c.filiais});guardar('listarVerificacoesLinks',{resultados:c.links});
      guardar('listarTelefonesExtras',{registros:c.extras});guardar('listarWhatsApp',c.grupo);
      guardar('listarSolicitacoesTelefone',{pedidos:c.pedidos});
      if(c.solicitacoesGerentes && typeof GerentesSolicitacoesPresenter!=='undefined')
        GerentesSolicitacoesPresenter.definir(c.solicitacoesGerentes);
      VendedoresPresenter.revisoes=c.revisoes;
      WhatsAppPresenter.revisoes=c.revisoesIdentificacoes||{};
      await VendedoresPresenter._carregar(GoogleSheetsService.obterUrl(),null,true);
      await WhatsAppPresenter.carregar(true);
      VendedoresPresenter.verificarConflitoEdicao();
      if(document.getElementById('painelCadastroGerentes')?.open && typeof CadastroGerentesPresenter!=='undefined')
        await CadastroGerentesPresenter.carregar();
      if(AdminPresenter.abaAtual==='vendedores')await VendedoresPresenter.carregarSolicitacoesTelefone();
    }
    if(d.contatos){
      guardar('listarConfigContatos',d.contatos.config);guardar('listarContatosRecentes',{contatos:d.contatos.contatos});
      ContatosPresenter.contatosRecentes=d.contatos.contatos;ContatosPresenter.contatosCarregados=true;
      if(!EdicaoSegura.sujo('convite')){ContatosPresenter.configCarregada=false;await ContatosPresenter.carregarConfig();}
      else if(ContatosPresenter.revision!==d.contatos.config.revision)EdicaoSegura.conflito('convite','O convite mudou em outra sessão. Seu texto foi mantido.');
      ContatosPresenter.renderizarFila();
    }
    if(d.campanhas){
      guardar('listarCampanhas',d.campanhas);
      if(!EdicaoSegura.sujo('campanha'))await CampanhasPresenter.carregar();
      else if(CampanhasPresenter.config.revision!==d.campanhas.revision)EdicaoSegura.conflito('campanha','A campanha geral mudou. Revise antes de salvar.');
    }
    if(d.acessos){guardar('listarAdministradores',d.acessos);if(AdminPresenter.abaAtual==='acessos')await GerenciarAcessosPresenter.carregar();}
    if(d.dashboard){this.dashboardPendente=true;if(AdminPresenter.abaAtual==='dashboard'){await DashboardPresenter.atualizar();this.dashboardPendente=false;}}
    if(d.auditoria){this.auditoriaPendente=true;if(AdminPresenter.abaAtual==='configuracoes'&&AdminPresenter.ehPrincipal){await SegurancaPresenter.carregarAuditoria();this.auditoriaPendente=false;}}
  },
  _iniciarAparencia(){
    const ref=AparenciaPortal.referencia;
    const cb=snap=>{
      const bruto=snap.val(),cfg=AparenciaPortal._normalizar(bruto||AparenciaPortal.padrao),revision=JSON.stringify(bruto);
      if(EdicaoSegura.sujo('aparencia')){
        if(this.aparenciaBase!==revision)EdicaoSegura.conflito('aparencia','A aparência mudou em outra sessão. Reabra esta área após guardar suas alterações.');return;
      }
      this.aparenciaBase=revision;AparenciaPortal.dados=bruto?cfg:null;
      document.getElementById('tituloPadrao').value=cfg.titulo;document.getElementById('mensagemPadrao').value=cfg.mensagem;
      document.getElementById('previewPadrao').src=cfg.imagem;document.getElementById('previewLogoPortal').src=cfg.logo;
    };
    ref.on('value',cb,()=>EdicaoSegura.conflito('aparencia','Não foi possível sincronizar a aparência.'));
    this.pararAparencia=()=>ref.off('value',cb);
  }
};
