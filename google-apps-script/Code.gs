/**
 * Verificador de links dos vendedores Martinello.
 * A URL consultada é fixa no domínio oficial. O endpoint recebe apenas matrículas numéricas.
 * Responde em JSONP para poder ser chamado pelo GitHub Pages sem configurar CORS.
 */
function doGet(e) {
  const params = (e && e.parameter) || {};
  const callback = String(params.callback || '');
  const ids = String(params.ids || '')
    .split(',')
    .map(function (v) { return v.replace(/\D/g, ''); })
    .filter(Boolean);

  if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(callback)) {
    return ContentService.createTextOutput('Callback inválido.').setMimeType(ContentService.MimeType.TEXT);
  }
  if (params.action !== 'verificarLinks') {
    return jsonp_(callback, { ok: false, erro: 'Ação não reconhecida.' });
  }
  if (!ids.length || ids.length > 30) {
    return jsonp_(callback, { ok: false, erro: 'Informe de 1 a 30 matrículas por solicitação.' });
  }

  const resultados = verificarMatriculas_(ids);
  return jsonp_(callback, { ok: true, resultados: resultados });
}

function verificarMatriculas_(matriculas) {
  const requisicoes = matriculas.map(function (matricula) {
    return {
      url: 'https://www.martinello.com.br/parceiros/' + encodeURIComponent(matricula),
      method: 'get',
      followRedirects: false,
      muteHttpExceptions: true,
      timeoutSeconds: 25,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MartinelloLinkCheck/1.0)' }
    };
  });

  let respostas = [];
  try {
    respostas = UrlFetchApp.fetchAll(requisicoes);
  } catch (erroLote) {
    // Fallback individual se o servidor recusar uma requisição em lote.
    respostas = requisicoes.map(function (req) {
      try { return UrlFetchApp.fetch(req.url, req); }
      catch (erro) { return null; }
    });
  }

  return matriculas.map(function (matricula, i) {
    const resposta = respostas[i];
    if (!resposta) {
      return { matricula: matricula, status: 'erro', httpCode: '', destino: '', url: '' };
    }

    const codigo = resposta.getResponseCode();
    const cabecalhos = resposta.getAllHeaders() || {};
    const chaveLocation = Object.keys(cabecalhos).find(function (k) { return k.toLowerCase() === 'location'; });
    const destino = chaveLocation ? String(cabecalhos[chaveLocation] || '') : '';
    let status = 'inconclusivo';
    let urlFinal = 'https://www.martinello.com.br/parceiros/' + matricula;

    if (/localhost:55191/i.test(destino)) {
      status = 'inativo';
      urlFinal = destino;
    } else if (codigo >= 300 && codigo < 400) {
      status = 'redirecionamento';
      urlFinal = destino || urlFinal;
    } else if (codigo === 404 || codigo === 410) {
      status = 'inativo';
    } else if (codigo >= 200 && codigo < 300) {
      // Alguns sistemas fazem o redirecionamento no HTML/JavaScript, não no cabeçalho HTTP.
      const corpo = String(resposta.getContentText() || '').slice(0, 150000);
      if (/localhost:55191/i.test(corpo)) {
        status = 'inativo';
        urlFinal = 'http://localhost:55191/';
      } else {
        status = 'ativo';
      }
    }

    return {
      matricula: matricula,
      status: status,
      httpCode: codigo,
      destino: destino,
      url: urlFinal
    };
  });
}

function jsonp_(callback, objeto) {
  const json = JSON.stringify(objeto).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
  return ContentService.createTextOutput(callback + '(' + json + ');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}
