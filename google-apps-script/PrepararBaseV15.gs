/**
 * Martinello Ofertas — preparação não destrutiva da base v1.5
 * Este script deve ser adicionado ao Apps Script VINCULADO À CÓPIA DE TESTE.
 * Ele cria novas abas vazias e gera uma prévia. Não apaga nem altera as abas antigas.
 */

const MARTINELLO_V15_TEST_SPREADSHEET_ID = '127G49HueMod1v-bHP66Ci4X1bpP4sIhRPZRO0JJKxdA';
const MARTINELLO_V15_SCAN_LIMIT = 10000;

const MARTINELLO_V15_SCHEMA = {
  'Vendedores': [
    'matricula', 'nome', 'filial', 'codigo_filial', 'telefone_original',
    'telefone_normalizado', 'situacao_funcional', 'status_cadastro',
    'origem_cadastro', 'criado_em', 'atualizado_em', 'observacoes'
  ],
  'Importacao_Funcionarios': [
    'lote_id', 'importado_em', 'filial_origem', 'matricula_origem',
    'nome_origem', 'tipo_linha', 'linha_origem', 'resultado_processamento'
  ],
  'Importacao_WhatsApp': [
    'lote_id', 'importado_em', 'nome_exibido', 'telefone_original',
    'telefone_normalizado', 'situacao_correspondencia', 'linha_origem'
  ],
  'Historico_WhatsApp': [
    'snapshot_id', 'data_extracao', 'nome_exibido', 'telefone_original',
    'telefone_normalizado', 'status_na_lista', 'tipo_pessoa',
    'matricula_associada', 'origem'
  ],
  'Identificacoes_Manuais': [
    'telefone_normalizado', 'nome_exibido', 'tipo_pessoa',
    'matricula_associada', 'observacao', 'criado_por', 'criado_em', 'atualizado_em'
  ],
  'Uso_Portal': [
    'evento_id', 'data_hora', 'matricula', 'navegador', 'oferta_id',
    'tipo_evento', 'origem', 'evento_id_legado', 'importado_em'
  ],
  'Historico_Contatos': [
    'contato_id', 'matricula', 'telefone', 'oferta_id', 'status_contato',
    'data_preparacao', 'data_whatsapp_aberto', 'confirmado_em', 'observacao', 'usuario'
  ],
  'Verificacao_Links': [
    'matricula', 'url_consultada', 'status', 'codigo_http', 'destino',
    'verificado_em', 'detalhe'
  ],
  'Auditoria': [
    'data_hora', 'usuario', 'acao', 'entidade', 'chave_registro',
    'antes_json', 'depois_json', 'resultado'
  ],
  'Previa_Migracao': [
    'indicador', 'origem', 'quantidade', 'observacao', 'gerado_em'
  ]
};

/** Execute manualmente primeiro. Confere o ID e cria somente as abas novas. */
function prepararEstruturaV15() {
  const ss = obterPlanilhaTesteV15_();
  const criadas = [];
  const preservadas = [];

  Object.keys(MARTINELLO_V15_SCHEMA).forEach(function(nome) {
    let aba = ss.getSheetByName(nome);
    if (!aba) {
      aba = ss.insertSheet(nome);
      const cabecalhos = MARTINELLO_V15_SCHEMA[nome];
      aba.getRange(1, 1, 1, cabecalhos.length).setValues([cabecalhos]);
      aba.setFrozenRows(1);
      aba.getRange(1, 1, 1, cabecalhos.length)
        .setBackground('#51217A')
        .setFontColor('#FFFFFF')
        .setFontWeight('bold')
        .setWrap(true);
      aba.autoResizeColumns(1, cabecalhos.length);
      criadas.push(nome);
    } else {
      // Não sobrescreve cabeçalhos, dados ou fórmulas de uma aba que já exista.
      preservadas.push(nome);
    }
  });

  const resumo = [
    'Estrutura v1.5 preparada na cópia de teste.',
    criadas.length ? 'Novas abas: ' + criadas.join(', ') : 'Nenhuma aba nova foi necessária.',
    preservadas.length ? 'Abas já existentes foram preservadas: ' + preservadas.join(', ') : '',
    'As abas antigas (Banco de Dados, Parâmetros de Dados, respostas e backups) não foram alteradas.'
  ].filter(Boolean).join('\n\n');

  Logger.log(resumo);
  SpreadsheetApp.getUi().alert('Preparação concluída', resumo, SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * Gera uma prévia de contagens para orientar a migração.
 * Lê apenas as abas legadas e escreve exclusivamente em Previa_Migracao.
 * Não importa vendedores, não remove fórmulas e não altera dados antigos.
 */
function gerarPreviaMigracaoV15() {
  const ss = obterPlanilhaTesteV15_();
  let destino = ss.getSheetByName('Previa_Migracao');
  if (!destino) {
    prepararEstruturaV15();
    destino = ss.getSheetByName('Previa_Migracao');
  }
  if (!destino) throw new Error('A aba Previa_Migracao não foi criada. Execute prepararEstruturaV15.');

  const agora = new Date();
  const linhas = [[
    'indicador', 'origem', 'quantidade', 'observacao', 'gerado_em'
  ]];

  const banco = ss.getSheetByName('Banco de Dados');
  const parametros = ss.getSheetByName('Parâmetros de Dados');
  const respostas = ss.getSheetByName('Respostas ao formulário 1');
  const backupMaster = ss.getSheetByName('Backup Master');

  if (banco) {
    const colunasBase = lerColunasV15_(banco, 1, 5, MARTINELLO_V15_SCAN_LIMIT);
    const colunasTelefone = lerColunasV15_(banco, 7, 1, MARTINELLO_V15_SCAN_LIMIT);
    const dados = colunasBase.map(function(r, i) { return r.concat([null, (colunasTelefone[i] || [''])[0]]); });
    const validos = dados.filter(function(r) {
      return somenteDigitosV15_(r[2]) && String(r[3] || '').trim();
    });
    const matriculas = validos.map(function(r) { return somenteDigitosV15_(r[2]); });
    const unicas = new Set(matriculas);
    const telefones = validos.filter(function(r) { return normalizarTelefoneV15_(r[6]); }).length;
    const duplicadas = matriculas.length - unicas.size;
    const ativos = validos.filter(function(r) { return String(r[4] || '').trim().toUpperCase() === 'OK'; }).length;

    adicionarLinhaPreviaV15_(linhas, 'Registros de vendedores com matrícula e nome', 'Banco de Dados', validos.length, 'Leitura das colunas C e D; linhas vazias e cabeçalho excluídos.', agora);
    adicionarLinhaPreviaV15_(linhas, 'Matrículas únicas', 'Banco de Dados', unicas.size, 'A matrícula será a chave única da aba Vendedores.', agora);
    adicionarLinhaPreviaV15_(linhas, 'Possíveis matrículas duplicadas', 'Banco de Dados', duplicadas, 'Precisam ser revisadas antes de consolidar a base.', agora);
    adicionarLinhaPreviaV15_(linhas, 'Vendedores com telefone preenchido', 'Banco de Dados', telefones, 'Contagem de telefones na coluna G.', agora);
    adicionarLinhaPreviaV15_(linhas, 'Registros com situação OK', 'Banco de Dados', ativos, 'Valor atualmente exibido na coluna E; será comparado ao relatório importado.', agora);
  } else {
    adicionarLinhaPreviaV15_(linhas, 'Banco de Dados', 'Não encontrado', 0, 'A aba legada não foi localizada.', agora);
  }

  if (parametros) {
    const dadosParticipantes = lerColunasV15_(parametros, 1, 3, MARTINELLO_V15_SCAN_LIMIT);
    const dadosFuncionarios = lerColunasV15_(parametros, 6, 3, MARTINELLO_V15_SCAN_LIMIT);
    const participantes = dadosParticipantes.filter(function(r) { return normalizarTelefoneV15_(r[1]); });
    const relacaoFuncionario = dadosFuncionarios.filter(function(r) { return String(r[1] || '').trim(); });
    const statusNovo = dadosFuncionarios.filter(function(r) { return String(r[0] || '').trim().toUpperCase() === 'VENDEDOR NOVO'; });
    const linhasFilial = dadosFuncionarios.filter(function(r) { return String(r[0] || '').trim().toUpperCase() === 'FILIAL'; });

    adicionarLinhaPreviaV15_(linhas, 'Participantes com telefone', 'Parâmetros de Dados!A:C', participantes.length, 'A lista é substituída pela extração mais recente do grupo.', agora);
    adicionarLinhaPreviaV15_(linhas, 'Linhas na relação de funcionários', 'Parâmetros de Dados!F:H', relacaoFuncionario.length, 'Inclui cabeçalhos de filial; a separação será feita na etapa de importação.', agora);
    adicionarLinhaPreviaV15_(linhas, 'Linhas marcadas como VENDEDOR NOVO', 'Parâmetros de Dados!F:H', statusNovo.length, 'Resultado calculado pela fórmula atual.', agora);
    adicionarLinhaPreviaV15_(linhas, 'Cabeçalhos de filial', 'Parâmetros de Dados!F:H', linhasFilial.length, 'Linhas de agrupamento, não são vendedores.', agora);
  } else {
    adicionarLinhaPreviaV15_(linhas, 'Parâmetros de Dados', 'Não encontrado', 0, 'A aba legada não foi localizada.', agora);
  }

  if (respostas) {
    const dados = lerColunasV15_(respostas, 1, 3, MARTINELLO_V15_SCAN_LIMIT);
    const eventos = dados.filter(function(r) {
      return String(r[0] || '').trim() && somenteDigitosV15_(r[1]);
    });
    adicionarLinhaPreviaV15_(linhas, 'Eventos no formulário', 'Respostas ao formulário 1!A:C', eventos.length, 'Registros de geração/compartilhamento iniciado; não comprovam envio efetivo no WhatsApp.', agora);
    adicionarLinhaPreviaV15_(linhas, 'Matrículas distintas no formulário', 'Respostas ao formulário 1!A:C', new Set(eventos.map(function(r) { return somenteDigitosV15_(r[1]); })).size, 'Contagem de matrículas distintas com pelo menos um registro.', agora);
  } else {
    adicionarLinhaPreviaV15_(linhas, 'Respostas ao formulário 1', 'Não encontrado', 0, 'A aba legada não foi localizada.', agora);
  }

  if (backupMaster) {
    const dados = lerColunasV15_(backupMaster, 1, 3, MARTINELLO_V15_SCAN_LIMIT);
    const eventos = dados.filter(function(r) { return String(r[0] || '').trim() && String(r[1] || '').trim(); });
    adicionarLinhaPreviaV15_(linhas, 'Eventos em Backup Master', 'Backup Master!A:C', eventos.length, 'Não consolidar automaticamente: pode haver sobreposição com outras abas de backup.', agora);
  }

  ss.getSheets().filter(function(aba) { return /^Backup/i.test(aba.getName()) && aba.getName() !== 'Backup Master'; })
    .forEach(function(aba) {
      const dados = lerColunasV15_(aba, 1, 3, MARTINELLO_V15_SCAN_LIMIT);
      const eventos = dados.filter(function(r) { return String(r[0] || '').trim() && String(r[1] || '').trim(); });
      adicionarLinhaPreviaV15_(linhas, 'Eventos em ' + aba.getName(), aba.getName() + '!A:C', eventos.length, 'Contagem isolada; não representa eventos únicos até a deduplicação.', agora);
    });

  // Correspondência de telefones apenas para diagnóstico: igualdade exata ou possível revisão pelos últimos 8 dígitos.
  if (banco && parametros) {
    const baseVendedores = lerColunasV15_(banco, 1, 5, MARTINELLO_V15_SCAN_LIMIT);
    const fonesVendedores = lerColunasV15_(banco, 7, 1, MARTINELLO_V15_SCAN_LIMIT);
    const vendedores = baseVendedores.map(function(r, i) { return r.concat([null, (fonesVendedores[i] || [''])[0]]); })
      .filter(function(r) { return somenteDigitosV15_(r[2]) && String(r[3] || '').trim(); });
    const participantes = lerColunasV15_(parametros, 1, 3, MARTINELLO_V15_SCAN_LIMIT)
      .filter(function(r) { return normalizarTelefoneV15_(r[1]); });
    const telefonesExatos = new Set();
    const finais8 = new Set();
    vendedores.forEach(function(r) {
      const fone = normalizarTelefoneV15_(r[6]);
      if (fone) {
        telefonesExatos.add(fone);
        if (fone.length >= 8) finais8.add(fone.slice(-8));
      }
    });
    let exatos = 0;
    let possiveis = 0;
    let semCorrespondencia = 0;
    participantes.forEach(function(r) {
      const fone = normalizarTelefoneV15_(r[1]);
      if (telefonesExatos.has(fone)) exatos++;
      else if (fone.length >= 8 && finais8.has(fone.slice(-8))) possiveis++;
      else semCorrespondencia++;
    });
    adicionarLinhaPreviaV15_(linhas, 'Participantes com telefone idêntico ao cadastro', 'Comparação Banco de Dados x Parâmetros', exatos, 'Diagnóstico; não cria associações automaticamente.', agora);
    adicionarLinhaPreviaV15_(linhas, 'Possíveis correspondências pelos últimos 8 dígitos', 'Comparação Banco de Dados x Parâmetros', possiveis, 'Devem permanecer para revisão manual por risco de homônimos/DDD.', agora);
    adicionarLinhaPreviaV15_(linhas, 'Participantes sem correspondência encontrada', 'Comparação Banco de Dados x Parâmetros', semCorrespondencia, 'Podem ser gerentes, funcionários de outras áreas ou outros participantes.', agora);
  }

  // Só limpa a aba se ela tiver exatamente o cabeçalho esperado deste relatório.
  // Assim, uma aba homônima criada/manualizada pelo usuário nunca é sobrescrita.
  const cabecalhoEsperado = MARTINELLO_V15_SCHEMA['Previa_Migracao'];
  const cabecalhoAtual = destino.getRange(1, 1, 1, cabecalhoEsperado.length).getDisplayValues()[0];
  if (cabecalhoEsperado.some(function(valor, i) { return String(cabecalhoAtual[i] || '').trim() !== valor; })) {
    throw new Error('A aba Previa_Migracao já existe com outro cabeçalho. Ela foi preservada; renomeie-a ou revise manualmente antes de gerar a prévia.');
  }
  // A aba de prévia é gerada por este script; somente ela é limpa e reescrita.
  destino.clearContents();
  destino.getRange(1, 1, linhas.length, linhas[0].length).setValues(linhas);
  destino.setFrozenRows(1);
  destino.getRange(1, 1, 1, 5).setBackground('#51217A').setFontColor('#FFFFFF').setFontWeight('bold');
  destino.autoResizeColumns(1, 5);

  const mensagem = 'Prévia gerada na aba Previa_Migracao.\n\nForam lidas as abas antigas sem alterar seus dados. Confira os totais antes de autorizar qualquer migração.';
  Logger.log(mensagem);
  SpreadsheetApp.getUi().alert('Prévia de migração pronta', mensagem, SpreadsheetApp.getUi().ButtonSet.OK);
}

function validarAmbienteV15() {
  const ss = obterPlanilhaTesteV15_();
  const mensagem = 'Ambiente correto: ' + ss.getName() + '\nID: ' + ss.getId() + '\n\nNenhuma informação foi alterada.';
  Logger.log(mensagem);
  SpreadsheetApp.getUi().alert('Validação do ambiente', mensagem, SpreadsheetApp.getUi().ButtonSet.OK);
}

function obterPlanilhaTesteV15_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Abra este projeto pelo menu Extensões > Apps Script da planilha de TESTE.');
  if (ss.getId() !== MARTINELLO_V15_TEST_SPREADSHEET_ID) {
    throw new Error('Proteção: este script só pode operar na cópia de TESTE. ID encontrado: ' + ss.getId());
  }
  return ss;
}

function lerColunasV15_(aba, primeiraColuna, quantidadeColunas, limite) {
  const quantidadeLinhas = Math.min(Math.max(aba.getMaxRows() - 1, 0), limite);
  if (!quantidadeLinhas) return [];
  return aba.getRange(2, primeiraColuna, quantidadeLinhas, quantidadeColunas).getDisplayValues();
}

function somenteDigitosV15_(valor) {
  return String(valor == null ? '' : valor).replace(/\D/g, '');
}

function normalizarTelefoneV15_(valor) {
  let numero = somenteDigitosV15_(valor);
  if (!numero) return '';
  if ((numero.length === 10 || numero.length === 11) && !numero.startsWith('55')) numero = '55' + numero;
  return numero;
}

function adicionarLinhaPreviaV15_(destino, indicador, origem, quantidade, observacao, geradoEm) {
  destino.push([indicador, origem, quantidade, observacao, geradoEm]);
}
