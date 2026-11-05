// Portal 1.6.13 — consulta leve e opcional de cadastro validado.
// A consulta pública devolve apenas true/false; não expõe dados pessoais.
// Novos números são PEDIDOS de revisão, sem alterar o cadastro oficial.
const TelefonePortal = {
  ddds: new Set(('11 12 13 14 15 16 17 18 19 21 22 24 27 28 31 32 33 34 35 37 38 '+
    '41 42 43 44 45 46 47 48 49 51 53 54 55 61 62 63 64 65 66 67 68 69 '+
    '71 73 74 75 77 79 81 82 83 84 85 86 87 88 89 91 92 93 94 95 96 97 98 99').split(' ')),
  _pending: new Map(),
  _resolucao: null,

  numero(val) { return String(val || '').replace(/\D/g, ''); },
  valido(val) {
    const n = this.numero(val);
    return /^\d{11}$/.test(n) && this.ddds.has(n.slice(0,2)) && n[2] === '9' &&
      !/^(\d)\1{7}$/.test(n.slice(3)) && !['12345678','87654321'].includes(n.slice(3));
  },
  formato(valor) {
    const n = this.numero(valor).slice(0, 11);
    if (!n) return '';
    if (n.length <= 2) return `(${n}`;
    if (n.length === 3) return `(${n.slice(0,2)}) ${n[2]}`;
    if (n.length <= 7) return `(${n.slice(0,2)}) ${n[2]} ${n.slice(3)}`;
    return `(${n.slice(0,2)}) ${n[2]} ${n.slice(3,7)}-${n.slice(7)}`;
  },
  formatarCampo() {
    const campo = document.getElementById('portalTelefoneNumero');
    if (campo) campo.value = this.formato(campo.value);
    this._erro('');
  },
  _erro(msg) {
    const el = document.getElementById('portalTelefoneErro');
    if (el) el.textContent = msg;
  },
  _cache(rubi) {
    try {
      const dados=JSON.parse(localStorage.getItem('martTelefoneStatus_TESTE_'+rubi)||'null');
      if (dados && ['validado','solicitado'].includes(dados.tipo) &&
          Date.now()-dados.quando < (dados.tipo==='validado' ? 7*86400000 : 86400000)) return dados.tipo;
    } catch(_) {}
    return '';
  },
  _marcar(rubi,tipo) {
    try { localStorage.setItem('martTelefoneStatus_TESTE_'+rubi,JSON.stringify({tipo,quando:Date.now()})); }catch(_){}
  },
  _endpoint() {
    const url=String(CONFIG.portalEventsApiUrl||'').trim();
    return /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url) ? url : '';
  },
  // Consulta por JSONP sem CORS. O servidor só devolve o booleano "validado".
  // A query é executada UMA vez por matrícula neste navegador enquanto houver cache.
  consultar(rubi) {
    const url=this._endpoint();
    if (!url) return Promise.resolve(null);
    const requestId=`q_${Date.now()}_${Math.random().toString(36).slice(2,12)}`;
    return new Promise(resolve=>{
      const s=document.createElement('script');s.async=true;
      const timer=setTimeout(()=>terminar(null),10000);
      const terminar=(v)=>{
        clearTimeout(timer);
        this._pending.delete(requestId);
        s.remove();resolve(v);
      };
      this._pending.set(requestId,terminar);
      s.onerror=()=>terminar(null);
      const qs=new URLSearchParams({action:'consultarTelefone',matricula:rubi,requestId});
      s.src=`${url}?${qs}`;
      document.head.appendChild(s);
    });
  },
  receber(dados) {
    const resolve=this._pending.get(String(dados?.requestId||''));
    if (resolve) resolve(dados.disponivel===false?null:dados.validado===true);
  },
  async garantir(matricula) {
    const rubi=String(matricula||'').replace(/\D/g,'');
    const cache=this._cache(rubi);
    if (cache==='validado' || cache==='solicitado') return true;
    const estado=await this.consultar(rubi);
    if (estado===true) {this._marcar(rubi,'validado');return true;}
    if (estado===null) {
      // Queda do coletor ou bloqueio do JSONP não pode impedir um vendedor validado
      // de gerar ofertas. Em modo degradado, preservamos o fluxo anterior.
      console.warn('Consulta de telefone indisponível; oferta liberada sem validação.');
      return true;
    }
    return this.solicitar(rubi);
  },
  solicitar(rubi) {
    if (this._resolucao) return Promise.resolve(false);
    return new Promise(resolve=>{
      this._resolucao={resolve,rubi};
      const el=document.getElementById('portalTelefoneModal');
      if (!el) {this.fechar(false);return;}
      document.getElementById('portalTelefoneNumero').value='';
      document.getElementById('portalTelefoneRubi').textContent=rubi;
      this._erro('');el.hidden=false;
      document.getElementById('portalTelefoneNumero').focus();
    });
  },
  fechar(sucesso=false) {
    const modal=document.getElementById('portalTelefoneModal');if (modal) modal.hidden=true;
    const anterior=this._resolucao;this._resolucao=null;
    if (anterior) anterior.resolve(sucesso);
  },
  async enviar() {
    if (!this._resolucao) return;
    const rubi=this._resolucao.rubi;
    const numero=this.numero(document.getElementById('portalTelefoneNumero')?.value);
    if (!this.valido(numero)) {
      this._erro('Informe os 11 dígitos: DDD brasileiro válido + 9 + 8 dígitos.');return;
    }
    const url=this._endpoint();
    if(!url) {this._erro('Coletor não configurado; avise o administrador.');return;}
    const botao=document.getElementById('portalTelefoneSalvar');
    if (botao) {botao.disabled=true;botao.textContent='ENVIANDO...';}
    try {
      const campos=new URLSearchParams({action:'solicitarTelefone',matricula:rubi,telefone:numero,
        origem:location.origin,requestId:`fone_${Date.now()}_${Math.random().toString(36).slice(2,9)}`});
      // Sem CORS: resposta opaca indica despacho, não prova de gravação.
      await fetch(url,{method:'POST',mode:'no-cors',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},
        body:campos.toString(),keepalive:true,cache:'no-store'});
      this._marcar(rubi,'solicitado');
      this.fechar(true);
    } catch(e) {
      this._erro('Não foi possível encaminhar o pedido. Confira sua conexão e tente novamente.');
    } finally {if(botao){botao.disabled=false;botao.textContent='ENVIAR PARA ANÁLISE E CONTINUAR';}}
  }
};
window.MartinelloTelefoneReceber = dados => TelefonePortal.receber(dados);
