// Martinello 1.6.5 — números de celulares brasileiros no formato DDD + 9 + 8 dígitos.
// Identificação não altera o vendedor sem autorização explícita do administrador.
const GrupoWhatsAppModel = {
  digitos(v) { return String(v ?? '').replace(/\D/g, ''); },
  telefone(v) {
    let n = this.digitos(v);
    // O número exportado pode ter 55 e/ou omitir o nono dígito.
    if ((n.length === 12 || n.length === 13) && n.startsWith('55')) n = n.slice(2);
    if (/^[1-9][0-9][6-9]\d{7}$/.test(n)) n = n.slice(0, 2) + '9' + n.slice(2);
    // Evita classificar telefones fixos e números sem DDD como celulares.
    return /^[1-9][0-9]9\d{8}$/.test(n) ? n : '';
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
      validos.push({ telefone:fone, telefoneOriginal: (fb ? b : a).slice(0,35), nome:nome.slice(0,180) });
    });
    return { registros: validos, erros, duplicados };
  },
  analisarWorkbook(workbook) {
    if (!workbook?.SheetNames?.length) throw new Error('A planilha não possui abas legíveis.');
    const registros=[], avisos=[];
    let duplicados=0, ignorados=0, encontrouCabecalho=false;
    const vistos=new Set();
    const normalizaCab = v => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/gi,'').toLowerCase();
    workbook.SheetNames.forEach(aba => {
      const linhas = XLSX.utils.sheet_to_json(workbook.Sheets[aba], {header:1, defval:'', raw:false, blankrows:false});
      let cab=null;
      for (let i=0;i<Math.min(linhas.length,25);i++) {
        const h=(linhas[i] || []).map(normalizaCab);
        const fone=h.findIndex(v=>['mobile','phone','phone1value','telefone','numero','celular','whatsapp'].includes(v));
        const nome=h.findIndex(v=>['displayname','nomeexibido','nomecompleto','nome','participante','name'].includes(v));
        const first=h.findIndex(v=>['firstname','primeironome'].includes(v));
        const last=h.findIndex(v=>['lastname','sobrenome'].includes(v));
        if (fone>=0 && (nome>=0 || first>=0)) { cab={linha:i,fone,nome,first,last}; break; }
      }
      if (!cab) return;
      encontrouCabecalho=true;
      for (let i=cab.linha+1; i<linhas.length; i++) {
        const r=linhas[i]||[];
        if (!r.some(v=>String(v??'').trim())) continue;
        const rawPhone=String(r[cab.fone]??'').trim();
        const telefone=this.telefone(rawPhone);
        const nomeBruto=cab.nome>=0 ? String(r[cab.nome]??'').trim() : '';
        const fallback=[cab.first>=0?r[cab.first]:'',cab.last>=0?r[cab.last]:'']
          .map(x=>String(x??'').trim()).filter(Boolean).join(' ');
        const nome=(nomeBruto || fallback).replace(/[\x00-\x1f\x7f]/g,' ').trim();
        if (!telefone || !nome || /^[=+@-]/.test(nome)) {
          ignorados++;
          if (avisos.length<20) avisos.push(`aba ${aba}, linha ${i+1}`);
          continue;
        }
        if (vistos.has(telefone)) {duplicados++; continue;}
        vistos.add(telefone);
        registros.push({telefone,telefoneOriginal:rawPhone.slice(0,35),nome:nome.slice(0,180)});
      }
    });
    if (!encontrouCabecalho) throw new Error('Não encontrei as colunas displayName e mobile (ou Nome e Telefone).');
    return {registros, ignorados, duplicados, avisos};
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
