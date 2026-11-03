/**
 * Martinello Ofertas — revisão manual de participantes WhatsApp (v1.5.1)
 *
 * Adicione este arquivo ao Apps Script VINCULADO À PLANILHA DE TESTE.
 * Depende das funções obterPlanilhaTesteV15_(), somenteDigitosV15_() e
 * normalizarTelefoneV15_() existentes em PrepararBaseV15.gs.
 *
 * Segurança operacional:
 * - Usa somente a planilha de TESTE validada pelo ID fixo.
 * - Considera os telefones não vazios de Banco de Dados!G como validados,
 *   conforme a limpeza manual feita pelo usuário.
 * - Nunca associa um participante automaticamente.
 * - Não altera Banco de Dados, Parâmetros de Dados ou fórmulas antigas.
 * - A consolidação grava apenas Identificacoes_Manuais e o resultado da revisão.
 */

const MART_V15_REVISAO_ABA = 'Revisao_WhatsApp';
const MART_V15_REVISAO_CABECALHOS = [
  'telefone_normalizado',
  'telefone_participante',
  'nome_exibido',
  'tipo_correspondencia',
  'quantidade_candidatos',
  'candidatos',
  'decisao',
  'matricula_confirmada',
  'tipo_pessoa',
  'observacao',
  'presente_na_lista_atual',
  'gerado_em',
  'processado_em',
  'resultado'
];

/** Adiciona um menu simples para executar as duas operações na planilha. */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Martinello — Revisão')
    .addItem('Gerar/atualizar revisão WhatsApp', 'gerarRevisaoWhatsAppV15')
    .addItem('Consolidar decisões revisadas', 'consolidarRevisoesWhatsAppV15')
    .addItem('Gerar conferência automática WhatsApp', 'gerarConferenciaWhatsAppV152')
    .addToUi();
}

/**
 * Gera uma linha por número participante, agregando todos os candidatos.
 * Preserva decisões e observações já digitadas, inclusive quando o script
 * for executado novamente após a atualização do relatório do WhatsApp.
 */
function gerarRevisaoWhatsAppV15() {
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    const ss = obterPlanilhaTesteV15_();
    const banco = ss.getSheetByName('Banco de Dados');
    const parametros = ss.getSheetByName('Parâmetros de Dados');
    if (!banco || !parametros) {
      throw new Error('Não encontrei as abas Banco de Dados e/ou Parâmetros de Dados. Nenhuma informação foi alterada.');
    }

    const revisao = martV15ObterAbaRevisao_(ss);
    const indice = martV15CriarIndiceVendedores_(banco);
    const participantes = martV15LerParticipantes_(parametros);
    const antigas = martV15LerDecisoesExistentes_(revisao);
    const agora = new Date();
    const novasLinhas = [];
    const telefonesAtuais = new Set();
    let exatas = 0;
    let possiveis = 0;
    let semCandidato = 0;
    let multiplas = 0;

    participantes.forEach(function(p) {
      const fone = p.telefoneNormalizado;
      telefonesAtuais.add(fone);
      const exatos = indice.exatos.get(fone) || [];
      let candidatos = exatos;
      let tipo = '';

      if (exatos.length) {
        tipo = exatos.length === 1 ? 'EXATA_UNICA' : 'EXATA_MULTIPLA';
        exatas++;
      } else {
        const final8 = fone.length >= 8 ? fone.slice(-8) : '';
        candidatos = final8 ? (indice.finais8.get(final8) || []) : [];
        if (candidatos.length) {
          tipo = candidatos.length === 1 ? 'ULTIMOS_8_UNICA' : 'ULTIMOS_8_MULTIPLA';
          possiveis++;
        } else {
          tipo = 'SEM_CANDIDATO';
          semCandidato++;
        }
      }
      if (candidatos.length > 1) multiplas++;

      const anterior = antigas.get(fone);
      const candidatosTexto = candidatos.map(function(v) {
        return v.matricula + ' | ' + v.nome + ' | Filial: ' + v.filial + ' | Tel.: ' + v.telefone;
      }).join('\n');

      novasLinhas.push([
        fone,
        p.telefoneOriginal,
        p.nomeExibido,
        tipo,
        candidatos.length,
        candidatosTexto,
        anterior ? anterior.decisao : 'PENDENTE',
        anterior ? anterior.matriculaConfirmada : '',
        anterior ? anterior.tipoPessoa : '',
        anterior ? anterior.observacao : '',
        'SIM',
        agora,
        anterior ? anterior.processadoEm : '',
        anterior ? anterior.resultado : ''
      ]);
    });

    // Mantém no histórico os participantes que desapareceram da extração atual.
    antigas.forEach(function(a, telefone) {
      if (!telefonesAtuais.has(telefone)) {
        const linha = a.linha.slice();
        linha[10] = 'NÃO';
        linha[11] = agora;
        novasLinhas.push(linha);
      }
    });

    martV15ValidarCabecalhoRevisao_(revisao);
    const ultima = revisao.getLastRow();
    if (ultima > 1) revisao.getRange(2, 1, ultima - 1, MART_V15_REVISAO_CABECALHOS.length).clearContent();
    if (novasLinhas.length) {
      revisao.getRange(2, 1, novasLinhas.length, MART_V15_REVISAO_CABECALHOS.length).setValues(novasLinhas);
      martV15AplicarValidacoesRevisao_(revisao, novasLinhas.length);
    }
    martV15FormatarAbaRevisao_(revisao);

    const mensagem = [
      'Revisão WhatsApp atualizada na aba ' + MART_V15_REVISAO_ABA + '.',
      '',
      'Participantes únicos: ' + participantes.length,
      'Correspondências exatas (aguardam confirmação): ' + exatas,
      'Possíveis correspondências pelos últimos 8 dígitos: ' + possiveis,
      'Participantes sem candidato: ' + semCandidato,
      'Participantes com mais de um candidato: ' + multiplas,
      '',
      'Nenhuma associação foi confirmada automaticamente. Decisões e observações anteriores foram preservadas.'
    ].join('\n');
    Logger.log(mensagem);
    SpreadsheetApp.getUi().alert('Revisão gerada', mensagem, SpreadsheetApp.getUi().ButtonSet.OK);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Consolida somente as decisões preenchidas manualmente.
 * CONFIRMAR_VENDEDOR exige matrícula que esteja entre os candidatos atuais.
 * NAO_E_VENDEDOR exige tipo_pessoa GERENTE, FUNCIONARIO ou OUTRO.
 * REJEITAR_CORRESPONDENCIA apenas registra a rejeição na fila.
 */
function consolidarRevisoesWhatsAppV15() {
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    const ss = obterPlanilhaTesteV15_();
    const revisao = ss.getSheetByName(MART_V15_REVISAO_ABA);
    const banco = ss.getSheetByName('Banco de Dados');
    const identificacoes = ss.getSheetByName('Identificacoes_Manuais');
    const auditoria = ss.getSheetByName('Auditoria');
    if (!revisao || !banco || !identificacoes || !auditoria) {
      throw new Error('Faltam abas necessárias. Execute primeiro prepararEstruturaV15() e gerarRevisaoWhatsAppV15().');
    }
    martV15ValidarCabecalhoRevisao_(revisao);
    martV15ValidarCabecalhoIdentificacoes_(identificacoes);
    martV15ValidarCabecalhoAuditoria_(auditoria);

    const ultima = revisao.getLastRow();
    if (ultima < 2) {
      SpreadsheetApp.getUi().alert('Não há participantes para revisar.');
      return;
    }
    const linhas = revisao.getRange(2, 1, ultima - 1, MART_V15_REVISAO_CABECALHOS.length).getValues();
    const indice = martV15CriarIndiceVendedores_(banco);
    const indiceIdentificacoes = martV15IndiceIdentificacoes_(identificacoes);
    const email = Session.getActiveUser().getEmail() || Session.getEffectiveUser().getEmail() || 'Execução manual no Google Sheets';
    const agora = new Date();
    let confirmados = 0;
    let identificadosNaoVendedores = 0;
    let rejeitados = 0;
    let ignorados = 0;
    let erros = 0;

    linhas.forEach(function(linha, i) {
      const telefone = String(linha[0] || '').trim();
      const decisao = String(linha[6] || '').trim().toUpperCase();
      const jaProcessado = String(linha[12] || '').trim();
      if (!telefone || !decisao || decisao === 'PENDENTE' || jaProcessado) {
        ignorados++;
        return;
      }

      try {
        if (String(linha[10] || '').toUpperCase() !== 'SIM') {
          throw new Error('Participante não está na extração atual. Gere a revisão novamente antes de decidir.');
        }

        if (decisao === 'CONFIRMAR_VENDEDOR') {
          const matricula = String(linha[7] || '').replace(/\D/g, '');
          if (!matricula) throw new Error('Informe a matrícula confirmada na coluna H.');
          const candidatos = martV15CandidatosDoParticipante_(telefone, indice);
          const vendedor = candidatos.find(function(v) { return v.matricula === matricula; });
          if (!vendedor) throw new Error('A matrícula informada não está entre os candidatos atuais desse telefone.');

          martV15SalvarIdentificacao_(identificacoes, indiceIdentificacoes, {
            telefone: telefone,
            nomeExibido: String(linha[2] || '').trim(),
            tipoPessoa: 'VENDEDOR',
            matricula: matricula,
            observacao: String(linha[9] || '').trim() || 'Correspondência confirmada manualmente na aba Revisao_WhatsApp.',
            usuario: email,
            agora: agora
          });
          martV15RegistrarAuditoria_(auditoria, agora, email, 'ASSOCIAR_PARTICIPANTE_VENDEDOR', telefone, { matricula: matricula, nome: vendedor.nome });
          linha[12] = agora;
          linha[13] = 'Associação de vendedor salva em Identificacoes_Manuais.';
          confirmados++;
        } else if (decisao === 'NAO_E_VENDEDOR') {
          const tipoPessoa = martV15NormalizarTipoPessoa_(linha[8]);
          if (!tipoPessoa) throw new Error('Selecione GERENTE, FUNCIONARIO ou OUTRO na coluna I.');
          martV15SalvarIdentificacao_(identificacoes, indiceIdentificacoes, {
            telefone: telefone,
            nomeExibido: String(linha[2] || '').trim(),
            tipoPessoa: tipoPessoa,
            matricula: '',
            observacao: String(linha[9] || '').trim() || 'Participante classificado manualmente como não vendedor.',
            usuario: email,
            agora: agora
          });
          martV15RegistrarAuditoria_(auditoria, agora, email, 'IDENTIFICAR_NAO_VENDEDOR', telefone, { tipo_pessoa: tipoPessoa });
          linha[12] = agora;
          linha[13] = 'Participante classificado como ' + tipoPessoa + ' em Identificacoes_Manuais.';
          identificadosNaoVendedores++;
        } else if (decisao === 'REJEITAR_CORRESPONDENCIA') {
          martV15RegistrarAuditoria_(auditoria, agora, email, 'REJEITAR_ASSOCIACAO_WHATSAPP', telefone, { decisao: decisao });
          linha[12] = agora;
          linha[13] = 'Possível associação rejeitada; nenhum vínculo foi criado.';
          rejeitados++;
        } else {
          ignorados++;
        }
      } catch (erro) {
        linha[13] = 'PENDÊNCIA: ' + erro.message;
        erros++;
      }
      linhas[i] = linha;
    });

    revisao.getRange(2, 1, linhas.length, MART_V15_REVISAO_CABECALHOS.length).setValues(linhas);
    const mensagem = [
      'Consolidação finalizada.',
      '',
      'Vendedores associados: ' + confirmados,
      'Não vendedores identificados: ' + identificadosNaoVendedores,
      'Correspondências rejeitadas: ' + rejeitados,
      'Ignorados ou já processados: ' + ignorados,
      'Pendências com erro: ' + erros,
      '',
      'Os cadastros oficiais da aba Banco de Dados não foram alterados.'
    ].join('\n');
    Logger.log(mensagem);
    SpreadsheetApp.getUi().alert('Consolidação concluída', mensagem, SpreadsheetApp.getUi().ButtonSet.OK);
  } finally {
    lock.releaseLock();
  }
}

function martV15ObterAbaRevisao_(ss) {
  let aba = ss.getSheetByName(MART_V15_REVISAO_ABA);
  if (!aba) {
    aba = ss.insertSheet(MART_V15_REVISAO_ABA);
    aba.getRange(1, 1, 1, MART_V15_REVISAO_CABECALHOS.length).setValues([MART_V15_REVISAO_CABECALHOS]);
  }
  martV15ValidarCabecalhoRevisao_(aba);
  return aba;
}

function martV15ValidarCabecalhoRevisao_(aba) {
  const atual = aba.getRange(1, 1, 1, MART_V15_REVISAO_CABECALHOS.length).getDisplayValues()[0];
  const correto = MART_V15_REVISAO_CABECALHOS.every(function(v, i) { return String(atual[i] || '').trim() === v; });
  if (!correto) throw new Error('A aba Revisao_WhatsApp possui cabeçalho diferente do esperado. Ela foi preservada; não vou sobrescrevê-la.');
}

function martV15ValidarCabecalhoAuditoria_(aba) {
  const esperado = ['data_hora', 'usuario', 'acao', 'entidade', 'chave_registro', 'antes_json', 'depois_json', 'resultado'];
  const atual = aba.getRange(1, 1, 1, esperado.length).getDisplayValues()[0];
  if (!esperado.every(function(v, i) { return String(atual[i] || '').trim() === v; })) {
    throw new Error('O cabeçalho da aba Auditoria não corresponde ao esquema v1.5. Nada foi gravado.');
  }
}

function martV15RegistrarAuditoria_(aba, dataHora, usuario, acao, chave, depois) {
  aba.appendRow([dataHora, usuario, acao, 'Identificacoes_Manuais', chave, '', JSON.stringify(depois || {}), 'OK']);
}

function martV15ValidarCabecalhoIdentificacoes_(aba) {
  const esperado = ['telefone_normalizado', 'nome_exibido', 'tipo_pessoa', 'matricula_associada', 'observacao', 'criado_por', 'criado_em', 'atualizado_em'];
  const atual = aba.getRange(1, 1, 1, esperado.length).getDisplayValues()[0];
  if (!esperado.every(function(v, i) { return String(atual[i] || '').trim() === v; })) {
    throw new Error('O cabeçalho de Identificacoes_Manuais não corresponde ao esquema v1.5. Nada foi gravado.');
  }
}

function martV15CriarIndiceVendedores_(aba) {
  const last = aba.getLastRow();
  const linhas = last >= 2 ? aba.getRange(2, 1, last - 1, 7).getDisplayValues() : [];
  const exatos = new Map();
  const finais8 = new Map();
  const porMatricula = new Map();
  linhas.forEach(function(r) {
    const matricula = String(r[2] || '').replace(/\D/g, '');
    const nome = String(r[3] || '').trim();
    const telefone = normalizarTelefoneV15_(r[6]);
    if (!matricula || !nome || !telefone) return; // Telefones em branco foram retirados na limpeza manual.
    const vendedor = { matricula: matricula, nome: nome, filial: String(r[0] || '').trim(), telefone: telefone };
    porMatricula.set(matricula, vendedor);
    martV15AdicionarIndice_(exatos, telefone, vendedor);
    if (telefone.length >= 8) martV15AdicionarIndice_(finais8, telefone.slice(-8), vendedor);
  });
  return { exatos: exatos, finais8: finais8, porMatricula: porMatricula };
}

function martV15AdicionarIndice_(mapa, chave, vendedor) {
  if (!mapa.has(chave)) mapa.set(chave, []);
  const lista = mapa.get(chave);
  if (!lista.some(function(v) { return v.matricula === vendedor.matricula; })) lista.push(vendedor);
}

function martV15LerParticipantes_(aba) {
  const last = aba.getLastRow();
  const linhas = last >= 2 ? aba.getRange(2, 1, last - 1, 3).getDisplayValues() : [];
  const porTelefone = new Map();
  linhas.forEach(function(r) {
    const original = String(r[1] || r[2] || '').trim();
    const telefone = normalizarTelefoneV15_(r[1]) || normalizarTelefoneV15_(r[2]);
    if (!telefone) return;
    const nome = String(r[0] || '').trim();
    if (!porTelefone.has(telefone)) porTelefone.set(telefone, { telefoneNormalizado: telefone, telefoneOriginal: original, nomes: [] });
    if (nome && porTelefone.get(telefone).nomes.indexOf(nome) === -1) porTelefone.get(telefone).nomes.push(nome);
  });
  return Array.from(porTelefone.values()).map(function(p) {
    return { telefoneNormalizado: p.telefoneNormalizado, telefoneOriginal: p.telefoneOriginal, nomeExibido: p.nomes.join(' / ') };
  });
}

function martV15LerDecisoesExistentes_(aba) {
  const mapa = new Map();
  const last = aba.getLastRow();
  if (last < 2) return mapa;
  const dados = aba.getRange(2, 1, last - 1, MART_V15_REVISAO_CABECALHOS.length).getValues();
  dados.forEach(function(r) {
    const telefone = String(r[0] || '').trim();
    if (telefone) mapa.set(telefone, { linha: r, decisao: r[6] || 'PENDENTE', matriculaConfirmada: r[7] || '', tipoPessoa: r[8] || '', observacao: r[9] || '', processadoEm: r[12] || '', resultado: r[13] || '' });
  });
  return mapa;
}

function martV15AplicarValidacoesRevisao_(aba, quantidade) {
  if (!quantidade) return;
  const decisao = SpreadsheetApp.newDataValidation()
    .requireValueInList(['PENDENTE', 'CONFIRMAR_VENDEDOR', 'NAO_E_VENDEDOR', 'REJEITAR_CORRESPONDENCIA'], true)
    .setAllowInvalid(false).build();
  const tipo = SpreadsheetApp.newDataValidation()
    .requireValueInList(['GERENTE', 'FUNCIONARIO', 'OUTRO'], true)
    .setAllowInvalid(true).build();
  aba.getRange(2, 7, quantidade, 1).setDataValidation(decisao);
  aba.getRange(2, 9, quantidade, 1).setDataValidation(tipo);
}

function martV15FormatarAbaRevisao_(aba) {
  aba.setFrozenRows(1);
  aba.getRange(1, 1, 1, MART_V15_REVISAO_CABECALHOS.length)
    .setBackground('#51217A').setFontColor('#FFFFFF').setFontWeight('bold').setWrap(true);
  aba.setColumnWidth(1, 155);
  aba.setColumnWidth(2, 145);
  aba.setColumnWidth(3, 230);
  aba.setColumnWidth(4, 165);
  aba.setColumnWidth(5, 110);
  aba.setColumnWidth(6, 420);
  aba.setColumnWidth(7, 190);
  aba.setColumnWidth(8, 145);
  aba.setColumnWidth(9, 145);
  aba.setColumnWidth(10, 260);
  aba.setColumnWidth(11, 145);
  aba.setColumnWidth(12, 155);
  aba.setColumnWidth(13, 155);
  aba.setColumnWidth(14, 360);
  const last = aba.getLastRow();
  if (last > 1) {
    const filtroAtual = aba.getFilter();
    if (filtroAtual) filtroAtual.remove();
    aba.getRange(1, 1, last, MART_V15_REVISAO_CABECALHOS.length).createFilter();
    aba.getRange(2, 6, last - 1, 1).setWrap(true);
    aba.getRange(2, 10, last - 1, 1).setWrap(true);
    aba.getRange(2, 14, last - 1, 1).setWrap(true);
  }
}

function martV15IndiceIdentificacoes_(aba) {
  const indice = new Map();
  const last = aba.getLastRow();
  if (last < 2) return indice;
  const dados = aba.getRange(2, 1, last - 1, 8).getDisplayValues();
  dados.forEach(function(r, i) {
    const telefone = String(r[0] || '').trim();
    if (telefone && !indice.has(telefone)) indice.set(telefone, { row: i + 2, values: r });
  });
  return indice;
}

function martV15SalvarIdentificacao_(aba, indice, dados) {
  const existente = indice.get(dados.telefone);
  const valores = existente ? existente.values.slice() : ['', '', '', '', '', '', '', ''];
  valores[0] = dados.telefone;
  valores[1] = dados.nomeExibido || valores[1] || '';
  valores[2] = dados.tipoPessoa;
  valores[3] = dados.matricula;
  valores[4] = dados.observacao;
  valores[5] = existente ? (valores[5] || dados.usuario) : dados.usuario;
  valores[6] = existente ? (valores[6] || dados.agora) : dados.agora;
  valores[7] = dados.agora;
  if (existente) {
    aba.getRange(existente.row, 1, 1, 8).setValues([valores]);
    indice.set(dados.telefone, { row: existente.row, values: valores });
  } else {
    const row = aba.getLastRow() + 1;
    aba.getRange(row, 1, 1, 8).setValues([valores]);
    indice.set(dados.telefone, { row: row, values: valores });
  }
}

function martV15CandidatosDoParticipante_(telefone, indice) {
  const exatos = indice.exatos.get(telefone) || [];
  if (exatos.length) return exatos;
  const final8 = telefone.length >= 8 ? telefone.slice(-8) : '';
  return final8 ? (indice.finais8.get(final8) || []) : [];
}

function martV15NormalizarTipoPessoa_(valor) {
  const tipo = String(valor || '').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (tipo === 'GERENTE') return 'GERENTE';
  if (tipo === 'FUNCIONARIO') return 'FUNCIONARIO';
  if (tipo === 'OUTRO') return 'OUTRO';
  return '';
}
