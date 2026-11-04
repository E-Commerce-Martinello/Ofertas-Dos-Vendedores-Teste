// Martinello 1.6.4 — leitura local e classificação assistida do grupo.
// Não altera cadastro nem telefone da aba Vendedores.
const GrupoWhatsAppModel = {
  digitos(v) { return String(v ?? '').replace(/\D/g, ''); },
  telefone(v) {
    let n = this.digitos(v);
    if ([10,11].includes(n.length)) n = '55' + n;
    return /^55\d{10,11}$/.test(n) ? n : '';
  },
  rubiNoNome(nome) {
    const match = String(nome || '').match(/\((\d{2,8})\)/);
    return match ? match[1] : '';
  },
  analisarTexto(texto) {
    const linhas = String(texto || '').replace(/^\uFEFF/,'').split(/\r?\n/);
    const validos = [], erros = [], conhecidos = new Set();
    let duplicados = 0;
    linhas.forEach((linha, idx) => {
      if (!linha.trim()) return;
      let colunas = linha.includes('\t') ? linha.split('\t') : linha.includes(';') ? linha.split(';') : linha.split(',');
      if (colunas.length < 2) { erros.push(`Linha ${idx+1}: use Nome;Telefone.`); return; }
      const a = String(colunas[0] || '').trim();
      const b = colunas.slice(1).join(' ').trim();
      if (/^(nome|nome exibido|participante)$/i.test(a) && /^(telefone|n[uú]mero|celular)$/i.test(b)) return;
      const fa = this.telefone(a), fb = this.telefone(b);
      const fone = fb || fa;
      const nome = fb ? a : b;
      if (!fone || !nome || /^[=+@-]/.test(nome)) { erros.push(`Linha ${idx+1}: nome ou telefone inválido.`); return; }
      if (conhecidos.has(fone)) { duplicados++; return; }
      conhecidos.add(fone);
      validos.push({ telefone:fone, nome:nome.slice(0,180) });
    });
    return { registros: validos, erros, duplicados };
  },
  classificar(participante, vendedores, manuais) {
    const telefone = this.telefone(participante.telefone);
    const nomeGrupo = String(participante.nome || '');
    const manual = manuais.find(v => this.telefone(v.telefone) === telefone);
    const porMatricula = new Map(vendedores.map(v => [this.digitos(v.matricula),v]));
    const rubi = this.rubiNoNome(nomeGrupo);
    const oficiais = vendedores.filter(v => v.ativo && v.statusTelefone === 'VALIDADO' && this.telefone(v.numero) === telefone);
    if (manual && ['GERENTE','FUNCIONARIO','OUTRO'].includes(manual.tipo)) {
      return { situacao:'identificado', tipo:manual.tipo, matricula:'', vendedor:null, motivo:'Identificação manual preservada' };
    }
    if (oficiais.length > 1) {
      return { situacao:'revisar', tipo:'REVISAR', matricula:'', vendedor:null, motivo:'Telefone validado em mais de um cadastro' };
    }
    const rubiAtribuido = manual?.tipo === 'VENDEDOR' ? this.digitos(manual.matricula) : rubi;
    const vendedorRubi = rubiAtribuido ? porMatricula.get(rubiAtribuido) : null;
    if (rubiAtribuido && !vendedorRubi) {
      return { situacao:'revisar', tipo:'REVISAR', matricula:rubiAtribuido, vendedor:null, motivo:'Matrícula no nome ou cadastro manual não existe na base' };
    }
    if (vendedorRubi) {
      if (oficiais.length === 1 && oficiais[0].matricula !== vendedorRubi.matricula) {
        return { situacao:'revisar', tipo:'REVISAR', matricula:rubiAtribuido, vendedor:vendedorRubi, motivo:'Rubi e telefone validado apontam para vendedores diferentes' };
      }
      if (vendedorRubi.statusTelefone === 'VALIDADO' && this.telefone(vendedorRubi.numero) !== telefone) {
        return { situacao:'revisar', tipo:'REVISAR', matricula:rubiAtribuido, vendedor:vendedorRubi, motivo:'Rubi reconhecido, mas telefone diferente do validado' };
      }
      if (!vendedorRubi.ativo) {
        return { situacao:'revisar', tipo:'REVISAR', matricula:rubiAtribuido, vendedor:vendedorRubi, motivo:'Matrícula identificada, mas cadastro inativo' };
      }
      return { situacao:'vendedor', tipo:'VENDEDOR', matricula:vendedorRubi.matricula, vendedor:vendedorRubi,
        motivo: vendedorRubi.statusTelefone==='VALIDADO' ? 'Rubi e telefone conferem' : 'Identificado pelo Rubi — telefone ainda pendente no cadastro' };
    }
    if (oficiais.length === 1) {
      return { situacao:'vendedor', tipo:'VENDEDOR', matricula:oficiais[0].matricula, vendedor:oficiais[0], motivo:'Telefone validado corresponde à base' };
    }
    if (/(?:^|\s|-)GERENTE(?:\s|$)/i.test(nomeGrupo)) {
      return { situacao:'identificado', tipo:'GERENTE', matricula:'', vendedor:null, motivo:'Cargo identificado no nome (automático)' };
    }
    return { situacao:'desconhecido', tipo:'NÃO IDENTIFICADO', matricula:'', vendedor:null, motivo:'Sem Rubi ou telefone validado correspondente' };
  }
};
