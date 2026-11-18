# Portal de Gerentes — instalação na homologação (matrícula apenas)

**Preparado em 18/11/2026.** Os arquivos do GitHub de TESTE foram atualizados; Apps Script e Cloudflare **ainda não foram implantados por esta alteração**. Não mexer no ambiente OFICIAL.

## O que mudou

- Admin: atalho **PORTAL DE GERENTES** ao lado de **VOLTAR AO PORTAL**, abrindo `gerentes.html` em nova aba, **sem UTM ou parâmetros de rastreio**.
- Admin → **Vendedores → Cadastro de gerentes**: cadastrar/editar matrícula, nome, celular, filial e situação ATIVO/INATIVO, sem abrir o Google Sheets. A lista apresenta todos os gerentes e oferece busca e edição.
- Gerente: digita somente a matrícula cadastrada. Não é necessário login Google.
- A filial é **sempre definida no servidor**, pela aba `Gerentes_Autorizados`, nunca por uma filial informada no navegador.
- Página recebe apenas ranking, status e dados limitados a essa filial. Nenhum telefone completo de vendedor é retornado no painel. Solicitações exigem um telefone digitado e tipo pessoal/profissional; vão à fila administrativa sem editar cadastros.
- **Aviso importante:** matrícula não autentica uma pessoa. Quem descobrir uma matrícula ativa poderá ver resultados e nomes/status da filial e criar solicitações em nome dela. O registro no Sheets identifica **a matrícula informada**, não comprova o remetente. Antes de usar com dados reais, considere reintroduzir autenticação ou restringir a rede de acesso.

## Arquivos finais para copiar (homologação)

| Serviço | Arquivos |
|---|---|
| Site GitHub (já alterado) | [admin.html](../admin.html), [gerentes.html](../gerentes.html), [model/gerentes-api.js](../model/gerentes-api.js), [presenter/gerentes-presenter.js](../presenter/gerentes-presenter.js), [presenter/gerentes-cadastro-presenter.js](../presenter/gerentes-cadastro-presenter.js) |
| Apps Script **ADMIN** de TESTE | [Code.gs](../infrastructure/apps-script/admin/Code.gs), [Refinamento.gs](../infrastructure/apps-script/admin/Refinamento.gs), [Telefones.gs](../infrastructure/apps-script/admin/Telefones.gs), [Gerentes.gs](../infrastructure/apps-script/admin/Gerentes.gs), [appsscript.json](../infrastructure/apps-script/admin/appsscript.json) |
| Cloudflare Worker **ADMIN** de TESTE | [worker.mjs](../infrastructure/cloudflare/worker.mjs) |
| Apps Script **COLETOR** de TESTE | Sem mudanças específicas desta opção de matrícula. Se ainda não implantou a v1.6.19 anterior, veja o [guia geral](../infrastructure/GUIA-COPIAR-BACKEND-TESTE-v1.6.19.md). |
| Firebase | **Nenhuma regra nova para liberar o gerente.** Admin mantém as regras existentes e o login Google para administrar. |

**Obrigatório:** atualizar **tanto o Code.gs + Gerentes.gs quanto o Worker**. Instalar somente a nova página sem esses dois serviços resultará em erro ao informar a matrícula. Os arquivos de Apps Script não devem ser juntados nem duplicados.

## Passos

1. Salve o backup dos arquivos atuais no Apps Script administrativo e Worker de TESTE, bem como uma cópia da planilha de homologação.
2. No Apps Script administrativo de TESTE, substitua `Code.gs`, `Refinamento.gs`, `Telefones.gs` e o `appsscript.json` pelos correspondentes atuais. Crie/atualize `Gerentes.gs` no **mesmo projeto administrativo** (não no coletor público).
3. Confira as Script Properties de TESTE: `MART_AMBIENTE=TESTE`, `MART_V153_SHEET_ID`, `MART_FIREBASE_WEB_API_KEY`, `MART_V153_ADMIN_EMAIL`. O login do ADMIN continua usando o Firebase e exigindo autorização. No editor, confira serviço avançado **Google Sheets API v4**.
4. Execute `diagnosticarBackendV1619`; valide o diagnóstico. Depois execute `prepararEstruturaGerentesV1619` **com a conta administradora principal**. Ela cria as abas, se ausentes; se `Gerentes_Autorizados` já tiver o esquema antigo de cinco colunas, adiciona somente a coluna `telefone` ao final, sem regravar os registros.
5. Acesse **Admin → Vendedores → Cadastro de gerentes** e cadastre matrícula, nome, telefone e filial. O admin salva diretamente na planilha TESTE. Só matrículas cadastradas como ATIVO poderão acessar a página de gerentes.
6. Em Apps Script → **Implantar → Gerenciar implantações → Editar → Nova versão**, publique a atualização da implantação administrativa de TESTE existente. Preserve o `/exec`.
7. No Worker administrativo de TESTE, substitua o código inteiro por `worker.mjs` e publique. Preserve a variável `APPS_SCRIPT_URL` com o `/exec` da API **administrativa de TESTE**.
8. Teste acesso à página pelos links abaixo, com matrículas válidas, desativadas e inexistentes. Confira que outras ações administrativas continuam recusando solicitações sem token.

### Gerentes_Autorizados — seis colunas exatas

| Coluna | Cabeçalho | Exemplo fictício |
|---|---|---|
| A | `matricula_gerente` | 12345 |
| B | `nome` | Gerente Exemplo |
| C | `filial_autorizada` | 1 |
| D | `ativo` | ATIVO |
| E | `atualizado_em` | Data/hora gerada automaticamente |
| F | `telefone` | 65998124567 |

**Não precisa editar manualmente a planilha.** O painel administrativo permite cadastrar, localizar, editar e ativar/desativar gerentes. Os telefones são validados como celular brasileiro de 11 dígitos e gravados como texto, sem máscaras.

A filial é obtida dessa tabela e validada contra a lista de filiais do Sheets. Não é inferida do nome ou telefone do grupo. Gerentes que não aparecem em `Vendedores` podem acessar, desde que estejam ativos nesta base.

**Migração:** se você já criou a tabela de cinco colunas (`matricula_gerente, nome, filial_autorizada, ativo, atualizado_em`), `prepararEstruturaGerentesV1619` apenas acrescenta F=`telefone`. Os números antigos ficam vazios até você editá-los pelo admin; o cadastro não perde matrícula e filial. **Se criou uma tabela antiga de seis colunas contendo `email_autorizado`**, não substitua dados por cima: faça backup e adapte o cabeçalho/posições manualmente antes da preparação, pois a função recusa esquemas desconhecidos por segurança.

A situação `INATIVO` bloqueia imediatamente as consultas seguintes com aquela matrícula. A matrícula de um gerente já cadastrado não pode ser alterada; para trocar, faça uma nova matrícula e desative a anterior.

### Solicitações

`Solicitacoes_Gerentes` também será criada pelo preparo. A coluna `origem_acesso` registra `MATRICULA_<código>`, **não** a identidade verificada de quem digitou. Os pedidos têm status `PENDENTE` ou `CT_TEMPORARIO` (na interface, **CT Temporário**), além do número, tipo, filial e vendedor.

Somente o admin pode revisar, concluir ou rejeitar pedidos. Mesmo `CONCLUIDO` não altera cadastros ou valida telefones automaticamente.

## Links sem UTM

- [Página de Gerentes de TESTE](https://e-commerce-martinello.github.io/Ofertas-Dos-Vendedores-Teste/gerentes.html)
- [Administrador de TESTE](https://e-commerce-martinello.github.io/Ofertas-Dos-Vendedores-Teste/admin.html), atalho **PORTAL DE GERENTES** no cabeçalho do painel após login.

Os links são relativos, sem `utm_source`, `utm_medium`, `utm_campaign` nem outros parâmetros de campanha.

## Checklist de homologação

- [ ] Abrir portal a partir do admin, junto a VOLTAR AO PORTAL; não há UTM na URL.
- [ ] No admin → Vendedores → Cadastro de gerentes, inserir matrícula, nome, telefone e filial; salvar, editar e desativar.
- [ ] A matrícula salva consulta somente a filial definida na base e a desativação impede novas consultas.
- [ ] Com base anterior de cinco colunas, executar preparação sem perder dados e confirmar a nova coluna F; se o cabeçalho não corresponder, parar sem regravar registros.
- [ ] Inserir matrícula ativa cadastrada: carregar **somente** vendedores, ranking e status da sua filial, sem Google.
- [ ] Matrícula inexistente/inativa/duplicada: acesso recusado.
- [ ] Alterar payload para matrícula de outra filial: somente os dados vinculados àquela matrícula aparecem; **isso não autentica quem informa a matrícula**.
- [ ] Chamar `listarVendedores`, `salvarCadastroCompleto` ou `listarSolicitacoesGerentes` sem token: acesso negado. Admin Google continua funcionando.
- [ ] Tentar enviar pedido para vendedor de outra filial: acesso recusado.
- [ ] Enviar pedido válido pessoal/profissional, com e sem CT Temporário; pedido aparece no admin e não muda telefone/cadastro automaticamente.
- [ ] No admin, revisar e concluir pedido de teste; conferência periódica sem recarregar a página.
- [ ] Conferir que todas as chamadas apontam exclusivamente para planilha, Worker e Apps Script **TESTE**.
- [ ] Testar telas em desktop e celular.

**Nenhuma implantação externa ou alteração de dados foi feita automaticamente.**

## Diagnóstico dos três erros de 18/11/2026

- **`GoogleSheetsService is not defined` na página de gerentes:** corrigido no GitHub. A página não utiliza mais o serviço do admin durante a limpeza da sessão. Atualizado o cache de `gerentes.html` para carregar os arquivos novos.
- **Código duplicado no seletor de filiais:** corrigido no GitHub. O seletor e as listas usam o rótulo já formatado por `FiliaisUI.nome()` sem repetir o código. Exemplo: `118 • Alto Araguaia`.
- **`Ação não reconhecida` ao salvar gerente:** a API administrativa atualmente implantada está sem o despacho da ação nova. **GitHub não implanta Apps Script automaticamente.** Copie **todos** os módulos administrativos atuais do repositório para o Apps Script de TESTE e use **Gerenciar implantações → Editar → Nova versão**; sem nova versão, a URL `/exec` continuará executando o código antigo. Depois confira se a variável `APPS_SCRIPT_URL` do Worker TESTE aponta para essa mesma implantação. Se o Worker antigo ainda bloquear requisições da página dos gerentes, copie e implante também o `worker.mjs` atual.

Depois de publicar, execute `prepararEstruturaGerentesV1619` **uma vez**, com a conta administradora de TESTE. Essa função cria as abas necessárias ou adiciona a coluna de telefone à tabela legada, sem apagar matrículas existentes. Em seguida, salve o cadastro pelo admin e teste a matrícula na página de gerentes.

Não copie arquivos de `infrastructure/registro-atual/`: são snapshots históricos anteriores às alterações.

## Complemento: correções de 18/11/2026

- Filiais: `model/filiais.js` remove códigos repetidos vindos da planilha; `presenter/vendors-presenter.js` usa uma única versão do nome da filial. As referências em `admin.html` foram atualizadas para `fix4`.
- Portal de Gerentes: `gerentes.html` usa referências `mat3` de `GerentesAPI` e do presenter, para substituir o JavaScript antigo que ainda chamava `GoogleSheetsService`.
- A mensagem `Ação não reconhecida` significa que o endpoint atualmente utilizado ainda não possui a ação `salvarCadastroGerente`; ela já existe no `Code.gs` do repositório. É necessário atualizar a implantação administrativa do Apps Script e confirmar `APPS_SCRIPT_URL` no Worker TESTE.
- Instalação: copiar os quatro arquivos Apps Script Admin atualizados e conferir o manifesto, executar `prepararEstruturaGerentesV1619`, editar a implantação existente escolhendo **Nova versão**, atualizar o Worker TESTE e testar com uma matrícula de gerente cadastrada.
- Após a publicação do GitHub Pages, use Ctrl+F5 no navegador para substituir os scripts antigos. Confira na aba Network que `gerentes-presenter.js?v=1.6.19-mat3` foi carregado.
- Nenhuma regra nova do Firebase é necessária para corrigir estes três erros. O ambiente OFICIAL permanece sem alterações.
