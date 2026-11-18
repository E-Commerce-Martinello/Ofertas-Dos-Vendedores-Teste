# Refinamento v1.6.19 — plano e diagnóstico

Base de homologação: `43a0b2693ebb5d82b1608f5f57da3f8e031307f2`, com os mesmos 37 blobs do oficial `78ad21664822f1495d66d2e9137b4bfe09a08c10`. Branch: `refinamento/v1.6.19`. Nenhuma implantação externa autorizada nesta etapa.

## Diagnóstico
- Ofertas e rascunhos têm listeners Firebase e transações: preservá-los. Aparência tem leitura única.
- Vendedores carregam base, links e extras separadamente; WhatsApp é outra consulta. Recarregar reinicia paginação. Falhas parciais viram listas vazias.
- O editor não guarda revisão da linha de vendedor; a revisão dos extras é obtida da lista atual ao salvar. Duas chamadas de escrita podem produzir sucesso parcial.
- Telefones possuem quatro validadores distintos. O de WhatsApp insere o nono dígito e não verifica DDD. Indicadores/filtros ainda usam o telefone legado.
- Participação é baseada na última lista importada. Declarações não comprovam presença ou titularidade.
- CSS concentra regras repetidas em admin.html, com cores fixas e overrides. Filiais usam datalist sobre select escondido. Modais não têm gerenciamento uniforme de foco.
- Backends recuperados do pacote 1.6.18.2, não da implantação ativa; exigir comparação antes de instalar. Worker recuperado da versão 1.6.9.1. Não há credenciais nesses fontes.

## Etapas e commits
1. Documentar base e versionar fontes de referência de Apps Script e Worker.
2. Núcleo comum de celulares e associação: mesma implementação no navegador e backend; testes de falsos positivos, duplicatas, DDD e legado.
3. Backend administrativo: revisões, snapshots, escrita única em lote de vendedor/extras, revisão de convites. Notificações opcionais e acionadores preparados, nunca instalados automaticamente.
4. Cliente: coordenador de sincronização sem sobreposição, revisão fixada ao abrir editor, paginação/filtros preservados, modo degradado explícito.
5. Interface administrativa: tokens de tema, combobox, alternadores, validação inline, modais acessíveis e responsividade.
6. Testes, CHANGELOG, guia de implantação e checklist. Sem merge/main ou pacote de publicação final antes da validação.

## Arquitetura
Firebase continua sendo a fonte das ofertas/rascunhos/aparência. Sheets continua sendo a fonte administrativa. Um marcador Firebase privado comunica somente que houve mudança; não transporta contatos. O backend é a autoridade da revisão e dos dados.

Consulta autenticada de revisões a cada 90 s, com jitter; pausa quando oculto/offline, backoff até 15 min e uma requisição em voo. Notificações disparam verificação agrupada com espaçamento mínimo. Snapshot só quando a revisão muda. Sem push autorizado, o modo periódico continua funcionando.

Escritas pelo portal invalidam as revisões explicitamente. Edições manuais usam acionadores instaláveis; alterações por outras APIs/fórmulas exigem reconciliação por fingerprint no máximo uma vez a cada 5 min por projeto. Não tratar `onEdit` como detector de chamadas de API.

## Telefones sem perda
Somente profissional e pessoal são editáveis. Legado permanece nas colunas existentes, exibido como histórico sem tipo. Associação explícita pode copiar o histórico para um campo livre; nunca apagar o original. Valores inválidos preexistentes ficam preservados e marcados para revisão, sem normalização silenciosa. Novas entradas exigem DDD válido + 9 + oito dígitos. +55 é removido somente quando há 13 dígitos; nunca inserir o nono dígito.

Presença e titularidade são independentes. Associação manual inequívoca, matrícula exata no nome importado ou contato previamente validado podem sustentar titularidade. Conflitos entre quaisquer matrículas, inclusive pendentes, impedem validação automática. Correspondência parcial/sufixo e declaração jamais validam.

## Dependências e limites
Apps Script e Sheets não oferecem transação com edição humana simultânea. Comparar fingerprint sob lock protege clientes do portal; uma edição humana durante a escrita ainda é risco residual documentado. A escrita multiaba usa Sheets API batchUpdate, que aplica o lote atomicamente. Ativar a API/serviço e instalar acionadores requer aprovação.

Limites consultados em 17/11/2026: Apps Script pessoal 90 min/dia de acionadores e 20 mil URL Fetch/dia; Workers Free 100 mil requisições/dia; Firebase Spark 100 conexões simultâneas, 1 GB armazenado e 10 GB/mês transferido. Reusar conexão Firebase existente, não replicar banners ou dados privados. Limites podem mudar e não constituem garantia de capacidade.

Fontes: https://developers.google.com/apps-script/guides/services/quotas · https://developers.google.com/apps-script/guides/triggers/installable · https://developers.cloudflare.com/workers/platform/limits/ · https://firebase.google.com/pricing · https://developers.google.com/workspace/sheets/api/guides/batch

## Testes planejados
Unidade: normalização/validação, titularidade, duplicatas, prioridade, preservação de legado; backend com serviços simulados, revisão obsoleta e lote único; coordenador com relógio simulado para concorrência, pausa, erros e notificações agrupadas; interface com dados sintéticos em desktop/celular, teclado e temas. Nenhum teste grava dados de produção.
