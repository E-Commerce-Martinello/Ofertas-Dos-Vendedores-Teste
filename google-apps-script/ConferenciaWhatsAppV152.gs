/**
 * Martinello Ofertas — conferência automática de participantes WhatsApp (v1.5.2)
 *
 * Adicione este arquivo ao Apps Script VINCULADO À PLANILHA DE TESTE.
 * Depende de obterPlanilhaTesteV15_() e normalizarTelefoneV15_() do arquivo
 * PrepararBaseV15.gs.
 *
 * Regras:
 * - A matrícula entre parênteses no nome do WhatsApp é o identificador principal.
 * - O nome e a filial do WhatsApp são informativos e podem estar desatualizados.
 * - A comparação do telefone apenas aponta se ele confere com o número validado
 *   na aba Banco de Dados. Nunca atualiza o telefone oficial automaticamente.
 * - Sem matrícula, o cargo GERENTE identifica gerente; outros cargos ficam visíveis
 *   para conferência, sem presumir que a pessoa é vendedor ou funcionário.
 * - Correspondências por telefone (exato/últimos 8 dígitos) são apenas candidatas.
 * - Nenhuma aba antiga é apagada ou modificada. A saída é Conferencia_WhatsApp.
 */

const MART_V152_ABA_CONFERENCIA = 'Conferencia_WhatsApp';
const MART_V152_CABECALHOS = [
  'telefone_normalizado',
  'telefone_whatsapp',
  'nomes_whatsapp',
  'matriculas_identificadas',
  'cargos_identificados',
  'classificacao_automatica',
  'matricula_encontrada',
  'nome_oficial',
  'filial_oficial',
  'telefone_oficial_validado',
  'comparacao_telefone_ou_candidato',
  'candidatos_por_telefone',
  'origem_identificacao',
  'detalhe_conferencia',
  'presente_na_lista_atual',
  'verificado_em'
];

/**
 * Gera uma conferência nova usando matrícula/cargo nos nomes e os telefones
 * já limpos e validados em Banco de Dados!G.
 */
function gerarConferenciaWhatsAppV152() {
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    const ss = obterPlanilhaTesteV15_();
    const banco = ss.getSheetByName('Banco de Dados');
    const parametros = ss.getSheetByName('Parâmetros de Dados');
    if (!banco || !parametros) {
      throw new Error('Não encontrei as abas Banco de Dados e/ou Parâmetros de Dados. Nenhuma informação foi alterada.');
    }

    const vendedores = martV152CriarIndiceVendedores_(banco);
    const participantes = martV152LerParticipantes_(parametros);
    const identificacoes = ss.getSheetByName('Identificacoes_Manuais');
    const manuais = identificacoes ? martV152LerIdentificacoesManuais_(identificacoes) : new Map();
    const destino = martV152ObterAbaConferencia_(ss);
    const agora = new Date();
    const linhas = [];
    const contagem = {
      participantes: participantes.length,
      vendedorMatriculaTelefoneConfere: 0,
      vendedorMatriculaTelefoneDivergente: 0,
      vendedorSemTelefoneValidado: 0,
      matriculaNaoEncontrada: 0,
      gerente: 0,
      manual: 0,
      candidatosExatos: 0,
      candidatosUltimos8: 0,
      semIdentificacao: 0,
      conflitos: 0,
      matriculasDuplicadasNaBase: 0,
      multiplasMatriculasNoNome: 0,
      vendedoresInativos: 0,
      vendedoresSemSituacao: 0,
      vendedoresSemMatriculaNoNome: 0
    };

    participantes.forEach(function(p) {
      const analise = martV152AnalisarParticipante_(p, vendedores, manuais);
      const v = analise.vendedor || null;
      const telStatus = analise.comparacaoTelefone || '';
      switch (analise.classificacao) {
        case 'VENDEDOR_IDENTIFICADO_TELEFONE_CONFERE': contagem.vendedorMatriculaTelefoneConfere++; break;
        case 'VENDEDOR_IDENTIFICADO_TELEFONE_DIVERGENTE': contagem.vendedorMatriculaTelefoneDivergente++; break;
        case 'VENDEDOR_IDENTIFICADO_SEM_TELEFONE_VALIDADO': contagem.vendedorSemTelefoneValidado++; break;
        case 'MATRICULA_NAO_ENCONTRADA': contagem.matriculaNaoEncontrada++; break;
        case 'MATRICULA_DUPLICADA_NA_BASE': contagem.matriculasDuplicadasNaBase++; break;
        case 'CONFLITO_MULTIPLAS_MATRICULAS_NO_NOME': contagem.multiplasMatriculasNoNome++; break;
        case 'MATRICULA_ENCONTRADA_VENDEDOR_INATIVO': contagem.vendedoresInativos++; break;
        case 'MATRICULA_ENCONTRADA_SEM_SITUACAO': contagem.vendedoresSemSituacao++; break;
        case 'VENDEDOR_SEM_MATRICULA_NO_NOME': contagem.vendedoresSemMatriculaNoNome++; break;
        case 'GERENTE_SINALIZADO_PELO_CARGO': contagem.gerente++; break;
        case 'IDENTIFICADO_POR_REGISTRO_MANUAL': contagem.manual++; break;
        case 'CANDIDATO_POR_TELEFONE_EXATO_PENDENTE':
        case 'VARIOS_CANDIDATOS_POR_TELEFONE_EXATO': contagem.candidatosExatos++; break;
        case 'POSSIVEL_CANDIDATO_ULTIMOS_8':
        case 'VARIOS_POSSIVEIS_CANDIDATOS_ULTIMOS_8': contagem.candidatosUltimos8++; break;
        case 'PARTICIPANTE_NAO_IDENTIFICADO': contagem.semIdentificacao++; break;
        case 'CONFLITO_MATRICULA_E_IDENTIFICACAO_MANUAL': contagem.conflitos++; break;
      }

      linhas.push([
        p.telefoneNormalizado,
        p.telefoneOriginal,
        p.nomes.join(' / '),
        analise.matriculas.join(', '),
        analise.cargos.join(' / '),
        analise.classificacao,
        v ? v.matricula : '',
        v ? v.nome : '',
        v ? v.filial : '',
        v ? v.telefone : '',
        telStatus,
        analise.candidatosTexto || '',
        analise.origem,
        analise.detalhe || '',
        'SIM',
        agora
      ]);
    });

    martV152ValidarCabecalho_(destino);
    const ultima = destino.getLastRow();
    if (ultima > 1) destino.getRange(2, 1, ultima - 1, MART_V152_CABECALHOS.length).clearContent();
    if (linhas.length) destino.getRange(2, 1, linhas.length, MART_V152_CABECALHOS.length).setValues(linhas);
    martV152FormatarAba_(destino);

    const mensagem = [
      'Conferência automática concluída na aba ' + MART_V152_ABA_CONFERENCIA + '.',
      '',
      'Participantes únicos: ' + contagem.participantes,
      'Vendedores identificados pela matrícula, com telefone conferindo: ' + contagem.vendedorMatriculaTelefoneConfere,
      'Vendedores identificados pela matrícula, com telefone divergente: ' + contagem.vendedorMatriculaTelefoneDivergente,
      'Vendedores identificados pela matrícula, sem telefone validado na base: ' + contagem.vendedorSemTelefoneValidado,
      'Matrículas não encontradas na base: ' + contagem.matriculaNaoEncontrada,
      'Matrículas duplicadas na base: ' + contagem.matriculasDuplicadasNaBase,
      'Nomes com mais de uma matrícula: ' + contagem.multiplasMatriculasNoNome,
      'Matrículas de vendedores inativos: ' + contagem.vendedoresInativos,
      'Matrículas sem situação funcional informada: ' + contagem.vendedoresSemSituacao,
      'Cargos de vendedor sem Rubi no nome: ' + contagem.vendedoresSemMatriculaNoNome,
      'Gerentes identificados pelo cargo: ' + contagem.gerente,
      'Identificações manuais aplicadas: ' + contagem.manual,
      'Candidatos por telefone exato, sem matrícula no nome: ' + contagem.candidatosExatos,
      'Possíveis candidatos pelos últimos 8 dígitos: ' + contagem.candidatosUltimos8,
      'Participantes ainda sem identificação: ' + contagem.semIdentificacao,
      'Conflitos entre matrícula e identificação manual: ' + contagem.conflitos,
      '',
      'Importante: a conferência não alterou Banco de Dados, Parâmetros de Dados, telefones oficiais ou fórmulas.'
    ].join('\n');
    Logger.log(mensagem);
    SpreadsheetApp.getUi().alert('Conferência automática pronta', mensagem, SpreadsheetApp.getUi().ButtonSet.OK);
    return contagem;
  } finally {
    lock.releaseLock();
  }
}

function martV152AnalisarParticipante_(participante, indice, manuais) {
  const nomes = participante.nomes || [];
  const matriculasSet = new Set();
  const cargosSet = new Set();
  nomes.forEach(function(nome) {
    const parsed = martV152InterpretarNome_(nome);
    parsed.matriculas.forEach(function(m) { matriculasSet.add(m); });
    if (parsed.cargo) cargosSet.add(parsed.cargo);
  });
  const matriculas = Array.from(matriculasSet);
  const cargos = Array.from(cargosSet);
  const telefone = participante.telefoneNormalizado;
  const manual = manuais.get(telefone);

  if (matriculas.length > 1) {
    return martV152Resultado_('CONFLITO_MULTIPLAS_MATRICULAS_NO_NOME', null, '', 'NOME_WHATSAPP', matriculas, cargos, 'O mesmo telefone aparece com mais de uma matrícula nos nomes extraídos.');
  }

  if (matriculas.length === 1) {
    const matricula = matriculas[0];
    const registros = indice.porMatricula.get(matricula) || [];
    if (registros.length === 0) {
      return martV152Resultado_('MATRICULA_NAO_ENCONTRADA', null, '', 'MATRICULA_NO_NOME', matriculas, cargos, 'A matrícula foi lida do nome do WhatsApp, mas não existe na base atual.');
    }
    if (registros.length > 1) {
      return martV152Resultado_('MATRICULA_DUPLICADA_NA_BASE', null, '', 'MATRICULA_NO_NOME', matriculas, cargos, 'A matrícula aparece mais de uma vez em Banco de Dados; revisar a base antes de associar.');
    }
    const vendedor = registros[0];
    if (manual && manual.tipoPessoa === 'VENDEDOR' && manual.matricula && manual.matricula !== matricula) {
      return martV152Resultado_('CONFLITO_MATRICULA_E_IDENTIFICACAO_MANUAL', vendedor, '', 'MATRICULA_NO_NOME_X_REGISTRO_MANUAL', matriculas, cargos, 'O Rubi no nome do WhatsApp difere da matrícula da identificação manual. Nenhum dado foi alterado.');
    }
    const comparacao = martV152CompararTelefone_(telefone, vendedor.telefone);
    if (vendedor.situacao.toUpperCase() !== 'OK') {
      const classeSituacao = vendedor.situacao ? 'MATRICULA_ENCONTRADA_VENDEDOR_INATIVO' : 'MATRICULA_ENCONTRADA_SEM_SITUACAO';
      const detalheSituacao = vendedor.situacao ? 'A matrícula existe, mas a situação atual na base não é OK (' + vendedor.situacao + ').' : 'A matrícula existe, mas a situação funcional está vazia na base.';
      return martV152Resultado_(classeSituacao, vendedor, comparacao, 'MATRICULA_NO_NOME', matriculas, cargos, detalheSituacao);
    }
    if (comparacao === 'TELEFONE_CONFERE') {
      return martV152Resultado_('VENDEDOR_IDENTIFICADO_TELEFONE_CONFERE', vendedor, comparacao, 'MATRICULA_NO_NOME', matriculas, cargos, 'Matrícula oficial localizada e telefone igual ao número validado no Banco de Dados.');
    }
    if (comparacao === 'SEM_TELEFONE_VALIDADO') {
      return martV152Resultado_('VENDEDOR_IDENTIFICADO_SEM_TELEFONE_VALIDADO', vendedor, comparacao, 'MATRICULA_NO_NOME', matriculas, cargos, 'Matrícula localizada, mas o cadastro oficial não tem telefone validado. O telefone do WhatsApp não foi copiado para a base.');
    }
    return martV152Resultado_('VENDEDOR_IDENTIFICADO_TELEFONE_DIVERGENTE', vendedor, comparacao, 'MATRICULA_NO_NOME', matriculas, cargos, 'Matrícula oficial localizada, mas o telefone do WhatsApp difere do telefone validado. Conferir manualmente.');
  }

  // Sem matrícula no nome: uma identificação manual já aprovada tem prioridade.
  if (manual) {
    if (manual.tipoPessoa === 'VENDEDOR' && manual.matricula) {
      const registrosManuais = indice.porMatricula.get(manual.matricula) || [];
      if (registrosManuais.length === 1) {
        const vendedorManual = registrosManuais[0];
        const comparacaoManual = martV152CompararTelefone_(telefone, vendedorManual.telefone);
        return martV152Resultado_('IDENTIFICADO_POR_REGISTRO_MANUAL', vendedorManual, comparacaoManual, 'IDENTIFICACAO_MANUAL', matriculas, cargos, 'Associação manual previamente registrada; não houve atualização do telefone oficial.');
      }
      return martV152Resultado_('IDENTIFICACAO_MANUAL_SEM_VENDEDOR_ATUAL', null, '', 'IDENTIFICACAO_MANUAL', matriculas, cargos, 'A associação manual aponta para uma matrícula que não foi localizada de forma única na base.');
    }
    return martV152Resultado_('IDENTIFICADO_POR_REGISTRO_MANUAL', null, '', 'IDENTIFICACAO_MANUAL_' + manual.tipoPessoa, matriculas, cargos, 'Participante já classificado manualmente como ' + manual.tipoPessoa + '.');
  }

  if (martV152EhGerente_(cargos)) {
    return martV152Resultado_('GERENTE_SINALIZADO_PELO_CARGO', null, '', 'CARGO_NO_NOME', matriculas, cargos, 'Cargo GERENTE/SUBGERENTE identificado. Não foi criada matrícula de vendedor.');
  }

  if (martV152CargoIndicaVendedor_(cargos)) {
    const candidatosVendedor = martV152CandidatosTelefone_(telefone, indice);
    return martV152Resultado_('VENDEDOR_SEM_MATRICULA_NO_NOME', null, martV152StatusCandidatoTelefone_(candidatosVendedor), 'CARGO_E_TELEFONE', matriculas, cargos, 'O cargo indica vendedor, mas não há Rubi no nome. A identificação permanece pendente.', candidatosVendedor);
  }

  const candidatos = martV152CandidatosTelefone_(telefone, indice);
  if (candidatos.tipo === 'EXATO') {
    const status = candidatos.lista.length === 1 ? 'CANDIDATO_POR_TELEFONE_EXATO_PENDENTE' : 'VARIOS_CANDIDATOS_POR_TELEFONE_EXATO';
    return martV152Resultado_(status, null, martV152StatusCandidatoTelefone_(candidatos), 'TELEFONE_VALIDADO_COMO_CANDIDATO', matriculas, cargos, 'Correspondência por telefone sem matrícula no nome; precisa de confirmação.', candidatos);
  }
  if (candidatos.tipo === 'ULTIMOS_8') {
    const status8 = candidatos.lista.length === 1 ? 'POSSIVEL_CANDIDATO_ULTIMOS_8' : 'VARIOS_POSSIVEIS_CANDIDATOS_ULTIMOS_8';
    return martV152Resultado_(status8, null, martV152StatusCandidatoTelefone_(candidatos), 'ULTIMOS_8_DIGITOS', matriculas, cargos, 'Coincidência parcial de telefone; não associar automaticamente.', candidatos);
  }
  return martV152Resultado_('PARTICIPANTE_NAO_IDENTIFICADO', null, 'SEM_CANDIDATO', 'SEM_MATRICULA_CARGO_OU_TELEFONE', matriculas, cargos, 'Nenhum Rubi, cargo reconhecido, identificação manual ou candidato por telefone encontrado.');
}

function martV152Resultado_(classificacao, vendedor, comparacao, origem, matriculas, cargos, detalhe, candidatos) {
  let candidatosTexto = '';
  if (candidatos && candidatos.lista && candidatos.lista.length) {
    candidatosTexto = candidatos.lista.map(function(v) {
      return v.matricula + ' | ' + v.nome + ' | Filial: ' + v.filial + ' | Tel. validado: ' + v.telefone;
    }).join('\n');
  }
  return {
    classificacao: classificacao,
    vendedor: vendedor,
    comparacaoTelefone: comparacao || '',
    origem: origem,
    matriculas: matriculas || [],
    cargos: cargos || [],
    candidatosTexto: candidatosTexto,
    detalhe: detalhe
  };
}

function martV152InterpretarNome_(nome) {
  const texto = String(nome || '').trim();
  const matriculas = [];
  const regex = /\(\s*(\d{1,10})\s*\)/g;
  let match;
  while ((match = regex.exec(texto)) !== null) {
    const m = match[1];
    if (m && matriculas.indexOf(m) === -1) matriculas.push(m);
  }
  const partes = texto.split(/\s+-\s+/);
  const cargo = partes.length >= 2 ? partes[partes.length - 1].trim() : '';
  return { matriculas: matriculas, cargo: cargo };
}

function martV152EhGerente_(cargos) {
  return (cargos || []).some(function(cargo) {
    const normalizado = martV152SemAcentos_(cargo).toUpperCase();
    return /(^|[^A-Z])GERENTE([^A-Z]|$)/.test(normalizado) || /SUBGERENTE/.test(normalizado);
  });
}

function martV152CargoIndicaVendedor_(cargos) {
  return (cargos || []).some(function(cargo) {
    const normalizado = martV152SemAcentos_(cargo).toUpperCase();
    return /VENDEDOR/.test(normalizado);
  });
}

function martV152SemAcentos_(valor) {
  return String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function martV152CriarIndiceVendedores_(aba) {
  const ultima = aba.getLastRow();
  const linhas = ultima >= 2 ? aba.getRange(2, 1, ultima - 1, 7).getDisplayValues() : [];
  const porMatricula = new Map();
  const exatos = new Map();
  const finais8 = new Map();
  linhas.forEach(function(r) {
    const matriculaBruta = String(r[2] || '').replace(/\D/g, '');
    const matricula = matriculaBruta;
    const nome = String(r[3] || '').trim();
    if (!matricula || !nome) return;
    const telefone = normalizarTelefoneV15_(r[6]);
    const vendedor = {
      matricula: matricula,
      nome: nome,
      filial: String(r[0] || '').trim(),
      situacao: String(r[4] || '').trim(),
      telefone: telefone
    };
    if (!porMatricula.has(matricula)) porMatricula.set(matricula, []);
    porMatricula.get(matricula).push(vendedor);
    // A lista foi limpa manualmente: somente telefones ainda preenchidos são candidatos validados.
    if (telefone) {
      martV152AdicionarIndice_(exatos, telefone, vendedor);
      if (telefone.length >= 8) martV152AdicionarIndice_(finais8, telefone.slice(-8), vendedor);
    }
  });
  return { porMatricula: porMatricula, exatos: exatos, finais8: finais8 };
}

function martV152AdicionarIndice_(mapa, chave, vendedor) {
  if (!mapa.has(chave)) mapa.set(chave, []);
  const lista = mapa.get(chave);
  if (!lista.some(function(v) { return v.matricula === vendedor.matricula; })) lista.push(vendedor);
}

function martV152LerParticipantes_(aba) {
  const ultima = aba.getLastRow();
  const linhas = ultima >= 2 ? aba.getRange(2, 1, ultima - 1, 3).getDisplayValues() : [];
  const mapa = new Map();
  linhas.forEach(function(r) {
    const telefoneOriginal = String(r[1] || r[2] || '').trim();
    const telefone = normalizarTelefoneV15_(r[1]) || normalizarTelefoneV15_(r[2]);
    if (!telefone) return;
    const nome = String(r[0] || '').trim();
    if (!mapa.has(telefone)) mapa.set(telefone, { telefoneNormalizado: telefone, telefoneOriginal: telefoneOriginal, nomes: [] });
    if (nome && mapa.get(telefone).nomes.indexOf(nome) === -1) mapa.get(telefone).nomes.push(nome);
  });
  return Array.from(mapa.values());
}

function martV152LerIdentificacoesManuais_(aba) {
  const mapa = new Map();
  const ultima = aba.getLastRow();
  if (ultima < 2) return mapa;
  const dados = aba.getRange(2, 1, ultima - 1, 8).getDisplayValues();
  dados.forEach(function(r) {
    const telefone = normalizarTelefoneV15_(r[0]);
    if (!telefone) return;
    mapa.set(telefone, {
      tipoPessoa: martV152SemAcentos_(r[2]).trim().toUpperCase(),
      matricula: String(r[3] || '').replace(/\D/g, '')
    });
  });
  return mapa;
}

function martV152CandidatosTelefone_(telefone, indice) {
  const exatos = indice.exatos.get(telefone) || [];
  if (exatos.length) return { tipo: 'EXATO', lista: exatos };
  const final8 = telefone.length >= 8 ? telefone.slice(-8) : '';
  const parciais = final8 ? (indice.finais8.get(final8) || []) : [];
  if (parciais.length) return { tipo: 'ULTIMOS_8', lista: parciais };
  return { tipo: 'NENHUM', lista: [] };
}

function martV152CompararTelefone_(telefoneParticipante, telefoneOficial) {
  if (!telefoneOficial) return 'SEM_TELEFONE_VALIDADO';
  return telefoneParticipante === telefoneOficial ? 'TELEFONE_CONFERE' : 'TELEFONE_DIVERGENTE';
}

function martV152StatusCandidatoTelefone_(candidatos) {
  return candidatos && candidatos.tipo ? candidatos.tipo : '';
}

function martV152ObterAbaConferencia_(ss) {
  let aba = ss.getSheetByName(MART_V152_ABA_CONFERENCIA);
  if (!aba) {
    aba = ss.insertSheet(MART_V152_ABA_CONFERENCIA);
    aba.getRange(1, 1, 1, MART_V152_CABECALHOS.length).setValues([MART_V152_CABECALHOS]);
  }
  martV152ValidarCabecalho_(aba);
  return aba;
}

function martV152ValidarCabecalho_(aba) {
  const atual = aba.getRange(1, 1, 1, MART_V152_CABECALHOS.length).getDisplayValues()[0];
  const ok = MART_V152_CABECALHOS.every(function(c, i) { return String(atual[i] || '').trim() === c; });
  if (!ok) throw new Error('A aba Conferencia_WhatsApp existe com cabeçalho diferente do esperado. Ela foi preservada; não vou sobrescrevê-la.');
}

function martV152FormatarAba_(aba) {
  aba.setFrozenRows(1);
  aba.getRange(1, 1, 1, MART_V152_CABECALHOS.length)
    .setBackground('#51217A').setFontColor('#FFFFFF').setFontWeight('bold').setWrap(true);
  const larguras = [155, 145, 320, 150, 190, 285, 125, 230, 180, 165, 190, 390, 230, 360, 145, 155];
  larguras.forEach(function(largura, i) { aba.setColumnWidth(i + 1, largura); });
  const ultima = aba.getLastRow();
  if (ultima > 1) {
    const filtro = aba.getFilter();
    if (filtro) filtro.remove();
    aba.getRange(1, 1, ultima, MART_V152_CABECALHOS.length).createFilter();
    [3, 12, 14].forEach(function(col) { aba.getRange(2, col, ultima - 1, 1).setWrap(true); });
  }
}
