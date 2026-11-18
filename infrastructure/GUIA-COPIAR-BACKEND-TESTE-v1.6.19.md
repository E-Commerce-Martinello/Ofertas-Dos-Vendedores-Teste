# Portal de Ofertas Martinello — Backend de homologação v1.6.19

**Fonte de verdade do código a copiar:** os arquivos abaixo dentro de `infrastructure/apps-script/`, `infrastructure/cloudflare/` e `infrastructure/firebase/database.rules.TESTE.json`, no branch `main` do repositório `Ofertas-Dos-Vendedores-Teste`.

**Não copie arquivos da pasta `infrastructure/registro-atual/` para uma implantação nova.** Aquela pasta guarda os códigos anteriores informados pelo responsável, para comparação e recuperação. Este guia descreve os fontes preparados da v1.6.19.

**Esta alteração no GitHub NÃO atualizou os serviços externos.** Preserve o oficial sem mudanças. Faça backup de todos os códigos implantados e das regras Firebase antes de substituir qualquer coisa.

## Complemento: módulo do Portal de Gerentes

Após a revisão deste guia, também está preparado o módulo `infrastructure/apps-script/admin/Gerentes.gs`, que deve ser criado **no mesmo Apps Script ADMIN de TESTE** juntamente com `Code.gs`, `Refinamento.gs` e `Telefones.gs`. Ele implementa autorização Google + matrícula + filial e uma fila privada de solicitações.

A nova página `gerentes.html` estará acessível pelo GitHub Pages, porém só mostrará dados após a implantação do código e cadastro explícito de gerentes na aba privada `Gerentes_Autorizados`. Consulte o procedimento completo em [docs/PORTAL-GERENTES-INSTALACAO-TESTE.md](../docs/PORTAL-GERENTES-INSTALACAO-TESTE.md).

## 1. Google Apps Script ADMIN — homologação

Abrir o projeto **administrativo de TESTE** existente e atualizar estes arquivos separadamente:

| Arquivo no Apps Script | Código no repositório |
| --- | --- |
| `Code.gs` | [apps-script/admin/Code.gs](apps-script/admin/Code.gs) |
| `Refinamento.gs` (criar/atualizar) | [apps-script/admin/Refinamento.gs](apps-script/admin/Refinamento.gs) |
| `Telefones.gs` (criar/atualizar) | [apps-script/admin/Telefones.gs](apps-script/admin/Telefones.gs) |
| `appsscript.json` (manifesto) | [apps-script/admin/appsscript.json](apps-script/admin/appsscript.json) |

**Não junte os três arquivos `.gs` no mesmo arquivo.** Não mantenha versões duplicadas das funções. O manifesto requer serviço avançado Google Sheets API v4; confira também em **Serviços → Google Sheets API** no editor. As funções novas usam `Sheets.Spreadsheets.batchUpdate` para salvar cadastro e telefones em um único lote.

Antes de implantar:

1. Conferir Script Properties sem copiá-las para o GitHub: `MART_AMBIENTE=TESTE`, `MART_V153_SHEET_ID` (planilha de teste), `MART_FIREBASE_WEB_API_KEY` (Firebase TESTE), `MART_V153_ADMIN_EMAIL` (proprietário autorizado) e `MART19_PUSH_ATIVO=false` (ou propriedade ausente).
2. Executar **`diagnosticarBackendV1619`** no editor. O resultado esperado é `versao:'1.6.19'`, `ambiente:'TESTE'`, `planilhaEncontrada:true`, `abaTelefonesPronta:true`, `sheetsAvancado:true`.
3. Se a aba `Telefones_Vendedores` **não existir**, fazer backup, obter autorização e executar **`prepararAbaTelefonesV1619`** *uma vez*. Ela cria somente a aba vazia com cabeçalhos; não migra nem exclui números antigos. Se a aba existir com cabeçalhos diferentes, interrompa e revise — não force substituição.
4. Quando tudo estiver correto, em **Implantar → Gerenciar implantações → Editar**, selecionar **Nova versão** na implantação administrativa de teste existente. Não criar um novo URL `/exec` sem atualizar e testar o Worker.
5. Fazer login com conta autorizada e conferir que `consultarCapacidades` informa `sincronizacao:true` e `edicaoCompleta:true`. O painel deve deixar de mostrar "backend pendente". Não contornar o bloqueio de edição caso a verificação falhe.

`Refinamento.gs` contém as funções da sincronização e operações de revisão, mas **não instala acionadores automaticamente**. A conferência periódica continuará operacional com push desligado (tipicamente 90–105 s quando a aba está visível; alterações diretamente no Sheets podem levar aproximadamente 5 min a mais para serem identificadas).

## 2. Cloudflare Worker ADMIN — homologação

Copiar o arquivo completo [cloudflare/worker.mjs](cloudflare/worker.mjs) para o **Worker de TESTE**, mantendo a variável `APPS_SCRIPT_URL` apontada **exclusivamente ao Apps Script ADMIN de TESTE** e conservando o nome do Worker. Atualizar a versão implantada do Worker.

O código novo preserva autenticação do Apps Script, valida formato das requisições e trata o redirecionamento do Google com **um único POST**. Se o Google devolver 404 temporário após o redirecionamento, são repetidos somente os GETs do mesmo endereço, nunca a gravação POST.

- A origem `https://e-commerce-martinello.github.io` continua permitida.
- `PAGES_ORIGIN` é variável **opcional**, somente para uma origem exata do tipo `https://nome.pages.dev` quando testarmos Cloudflare Pages. Não configure um domínio inventado nem use curingas.
- A API continua validando a identidade via Firebase ID token; CORS não substitui autenticação.

## 3. Firebase Realtime Database — homologação

Copiar o **arquivo completo** [firebase/database.rules.TESTE.json](firebase/database.rules.TESTE.json) para as regras do Firebase do projeto TESTE, após comparar com as regras que estiverem publicadas no console.

A diferença em relação ao código Firebase anteriormente informado é somente o nó `adminSync_TESTE`, com leitura restrita aos administradores autorizados e `".write": false` para clientes.

**O arquivo `sync-rules.fragment.json` não é um conjunto de regras completo** e não deve substituir o documento de regras na console. Nunca aplicar estas regras no Firebase OFICIAL. Não ligar `MART19_PUSH_ATIVO` até haver permissão IAM apropriada e teste de gravação autenticada pelo Apps Script, separado dos clientes.

## 4. Google Apps Script COLETOR — homologação

No projeto Apps Script **coletor público de TESTE**, atualizar:

| Arquivo no Apps Script | Código no repositório |
| --- | --- |
| `Code.gs` | [apps-script/coletor/Code.gs](apps-script/coletor/Code.gs) |
| `Telefones.gs` | [apps-script/coletor/Telefones.gs](apps-script/coletor/Telefones.gs) |
| `appsscript.json` | [apps-script/coletor/appsscript.json](apps-script/coletor/appsscript.json) |

Conferir `MART_EVT_SHEET_ID` apontando exclusivamente à planilha de homologação. Este projeto é **separado** do administrativo e continua público para registrar eventos, sem acesso aos endpoints administrativos.

Alterações: reutilização do validador compartilhado, consulta de status com cache binário de **60 segundos**, buscas indexadas por matrícula e origem restrita ao GitHub Pages Martinello. Se e quando habilitarmos Pages, a variável opcional de Script Properties `MART_EVT_PAGES_ORIGIN` deverá conter a origem exata `https://nome.pages.dev`. O coletor não expõe números ou nomes nessas consultas públicas.

Editar a **implantação Web App existente** e selecionar uma nova versão, preservando o `/exec`.

## 5. Horário do projeto

Nesta revisão, códigos de cálculo do **dia** e os dois manifestos foram padronizados para **`America/Sao_Paulo` (Brasília)**, conforme planejamento aprovado. Isso afeta o horário de virada de dias em limites diários e filtros “hoje”; não altera os instantes históricos gravados em UTC.

## 6. Testes obrigatórios (dados de homologação)

- [ ] `diagnosticarBackendV1619`: retorna todas as condições esperadas.
- [ ] Frontend: status do backend atualizado; acesso administrativo com usuário principal e segunda conta.
- [ ] Edição segura de vendedor com dois telefones; validação obrigatória e conflitos; histórico legado preservado.
- [ ] Dois administradores: dados sincronizados sem F5 e sem sobrescrever um formulário em edição.
- [ ] Coletor: consultar matrícula, consultar telefone, registrar evento e não expor dados pessoais.
- [ ] Worker: rejeitar origem não cadastrada e token inválido; confirmar POST único e retorno JSON válido.
- [ ] Firebase: visitante vê apenas ofertas/aparência permitidas; usuário sem autorização não lê `adminSync_TESTE`, rascunhos ou gestão.
- [ ] Nenhuma chamada, regra ou gravação atinge os serviços OFICIAIS.
- [ ] Formulários, importação, convites, dashboard, ranking e aparência continuam operacionais.

## 7. Publicação e retorno

Atualizar os códigos manualmente, **somente na homologação**. Anotar versões anteriores das implantações e exportar as regras antes de cada atualização. Se algo falhar, restaurar a versão anterior do Apps Script/Worker, revisar as regras Firebase e reabrir a homologação. Não substituir uma planilha inteira sobre registros novos sem análise.

**Nota de segurança:** este repositório é público. Os arquivos não devem conter senhas, tokens, chaves administrativas, credenciais privadas, dados de vendedores ou valores secretos de Script Properties/Workers. O Firebase Web API key é um identificador público de projeto; chaves privadas e service accounts não devem ser versionadas.
