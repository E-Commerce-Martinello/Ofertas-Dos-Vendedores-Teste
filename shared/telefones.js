/* Fonte única: navegador, testes e Apps Script (copiada pelo script de preparação). */
var Telefones = (() => {
  const ddds = new Set(('11 12 13 14 15 16 17 18 19 21 22 24 27 28 31 32 33 34 35 37 38 '+
    '41 42 43 44 45 46 47 48 49 51 53 54 55 61 62 63 64 65 66 67 68 69 '+
    '71 73 74 75 77 79 81 82 83 84 85 86 87 88 89 91 92 93 94 95 96 97 98 99').split(' '));
  function digitos(v) { return typeof v === 'string' ? v.replace(/\D/g, '') : ''; }
  function normalizar(v) {
    if (typeof v !== 'string' || /[^\d\s()+.\-]/.test(v)) return '';
    let n = digitos(v);
    if (n.length === 13 && n.startsWith('55')) n = n.slice(2);
    return n;
  }
  function erro(v, opcional = true) {
    if (typeof v !== 'string') return 'Informe o telefone como texto.';
    if (!v.trim()) return opcional ? '' : 'Informe o celular com DDD.';
    const n = normalizar(v);
    if (!/^\d{11}$/.test(n)) return 'Informe exatamente 11 dígitos, incluindo o DDD.';
    if (!ddds.has(n.slice(0, 2))) return 'Informe um DDD brasileiro válido.';
    if (n[2] !== '9') return 'O celular deve começar com 9 após o DDD.';
    if (/^(\d)\1{7}$/.test(n.slice(3)) || ['12345678','87654321','01234567','23456789','98765432','76543210'].includes(n.slice(3)))
      return 'Confira o número: sequência evidentemente fictícia.';
    return '';
  }
  function valido(v) { return !!String(v ?? '').trim() && !erro(v, false); }
  function numero(v) { return valido(v) ? normalizar(v) : ''; }
  function formato(v) {
    const n = normalizar(v);
    if (!n) return v && typeof v === 'string' ? v : '';
    // Não truncar entradas longas: devem permanecer inválidas, nunca virar outro número.
    if (n.length > 11) return n;
    if (n.length <= 2) return '(' + n;
    return '(' + n.slice(0,2) + ') ' + n[2] + (n.length > 3 ? ' ' + n.slice(3,7) : '') + (n.length > 7 ? '-' + n.slice(7) : '');
  }
  function campos(v) {
    const e = v.telefonesExtras || {};
    return [
      { tipo:'profissional', original:String(e.profissional || ''), status:e.statusProfissional },
      { tipo:'pessoal', original:String(e.pessoal || ''), status:e.statusPessoal },
      { tipo:'legado', original:String(v.numero || ''), status:v.statusTelefone }
    ].filter(f => f.original).map(f => ({...f, numero:numero(f.original)}));
  }
  function avaliar(v, base, participantes = [], identificacoes = [], listaDisponivel = true) {
    const matricula = String(v.matricula);
    return campos(v).map(f => {
      const n = f.numero;
      const grupo = listaDisponivel && !!n && participantes.some(p => numero(String(p.telefone || '')) === n);
      const outros = n ? base.filter(o => String(o.matricula) !== matricula && campos(o).some(x => x.numero === n)) : [];
      const manuais = identificacoes.filter(i => n && numero(String(i.telefone || '')) === n);
      const rubis = participantes.filter(p => n && numero(String(p.telefone || '')) === n)
        .map(p => (String(p.nome || '').match(/\((\d{3,5})\)/) || [])[1]).filter(Boolean);
      const divergencia = outros.length > 0 || manuais.some(i => i.tipo !== 'VENDEDOR' || String(i.matricula) !== matricula)
        || rubis.some(r => r !== matricula);
      const evidencia = f.status === 'VALIDADO' || manuais.some(i => i.tipo === 'VENDEDOR' && String(i.matricula) === matricula)
        || (grupo && rubis.includes(matricula));
      const validado = !!n && !divergencia && evidencia;
      const estado = !n ? 'invalido' : divergencia ? 'conflito' : grupo ? (validado ? 'grupo' : 'titularidade_pendente')
        : !listaDisponivel ? 'sem_dados' : validado ? 'fora' : 'pendente';
      const textos = {invalido:'Número histórico inválido — revisar',conflito:'Número divergente ou duplicado — revisar',
        grupo:'No grupo — contato validado',titularidade_pendente:'No grupo — titularidade pendente',
        sem_dados:'Lista do grupo indisponível',fora:'Fora da última lista — contato validado',pendente:'Titularidade pendente'};
      return {...f, noGrupo:grupo, validado, conflito:divergencia, estado, texto:textos[estado]};
    });
  }
  function preferido(fones) {
    return fones.filter(f => f.validado && !f.conflito).sort((a,b) => Number(b.noGrupo)-Number(a.noGrupo)
      || ({profissional:0,pessoal:1,legado:2}[a.tipo]-{profissional:0,pessoal:1,legado:2}[b.tipo]))[0] || null;
  }
  return {ddds, digitos, normalizar, erro, valido, numero, formato, campos, avaliar, preferido};
})();
if (typeof module !== 'undefined') module.exports = Telefones;
