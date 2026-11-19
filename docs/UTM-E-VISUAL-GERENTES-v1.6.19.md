# Homologação — UTMs e identidade visual do Portal de Gerentes

**Data:** 19/11/2026. **Repositório:** `Ofertas-Dos-Vendedores-Teste` (`main`). **Ambiente oficial:** não alterado.

Esta mudança atualiza **arquivos do GitHub**, mas não implanta automaticamente o Apps Script administrativo/coletor. A configuração de campanhas deve ser atualizada em **dois** Apps Scripts de TESTE para refletir as UTMs avançadas.

## Formato definido

O endereço final **do produto** (após o redirecionamento de parceiros) fica assim:

```text
https://www.martinello.com.br/ar-condicionado-12000-btus-split-midea-inverter-ai-ecomaster-inverter-42ezvcc-38ezvcc-220v-81579?utm_source=grupo_zap&utm_campaign=NOME_DA_CAMPANHA&utm_id=vendedores_zap
```

Não há `utm_medium` automático, nem prefixo de ano/mês/SKU no valor de `utm_campaign`.

Quando a matrícula é de vendedor ativo, o endereço **compartilhado** mantém a atribuição comercial:

```text
https://www.martinello.com.br/parceiros/19000?redirect=URL_DO_PRODUTO_COM_AS_3_UTMS_CODIFICADA
```

O parâmetro `redirect` continua sendo usado (não `redir`). Se a matrícula não é de vendedor, o portal utiliza o domínio padrão da Martinello com as mesmas três UTMs, sem atribuição a matrícula.

A presença de UTMs no destino **não comprova** que o redirecionamento real as preserva ou que o Google Analytics as registrou. Confirmar com a equipe responsável pelo domínio e pelos relatórios de Analytics.

## Prioridade da campanha

1. Campanha individual válida da oferta, se preenchida.
2. Campanha geral salva na aba `Config_Campanhas` da planilha de TESTE, para **qualquer oferta** antiga ou nova sem campanha individual.
3. Se nenhuma das duas existir, **não gerar** um link com o nome inventado `sem_campanha`: apresentar erro solicitando uma campanha válida.

O marcador legado `sem_campanha` guardado como nome individual também será tratado como campanha ausente, para a geral prevalecer.

O portal consulta o coletor periodicamente e antes de compartilhar quando o cache vence. O coletor tem cache de até 30 segundos; o navegador também até 30 segundos. Alterações podem levar aproximadamente **até 1 minuto** para propagar.

## Opções avançadas no administrador

Em **Admin → Ofertas → Campanha Geral**, clique em **OPÇÕES AVANÇADAS DE RASTREIO**:

| Propriedade | Valor inicial | Pode mudar? |
|---|---|---|
| `utm_source` | `grupo_zap` | Sim |
| `utm_campaign` | Campanha individual ou geral | Alterada pelo campo de campanha |
| `utm_id` | `vendedores_zap` | Sim |

`utm_source` e `utm_id` são compartilhados e não ficam gravados individualmente nas ofertas. A configuração atual aparece em uma prévia; o clique **Salvar Campanha** salva os três campos no Google Sheets, com revisão de conflitos para impedir sobrescrita entre administradores. Caracteres permitidos: letras minúsculas, dígitos, `_` ou `-` (até 60 caracteres).

A tabela `Config_Campanhas` armazena os registros por chave (`campanha_geral`, `link_grupo`, `utm_source`, `utm_id`). Linhas desconhecidas são preservadas, e a função antiga de link compacto não é reativada.

## O que copiar para os serviços de homologação

| Serviço | Arquivo do GitHub | Ação |
|---|---|---|
| Apps Script administrativo TESTE | [Code.gs](../infrastructure/apps-script/admin/Code.gs) | Substituir pelo código atual completo, mantendo `Refinamento.gs`, `Telefones.gs` e `Gerentes.gs` compatíveis |
| Apps Script coletor público TESTE | [Code.gs](../infrastructure/apps-script/coletor/Code.gs) | Substituir pelo código atual completo, mantendo `Telefones.gs` compatível |
| GitHub Pages TESTE | [index.html](../index.html), [admin.html](../admin.html), [gerentes.html](../gerentes.html) e os módulos `model/`, `presenter/` e `view/` atualizados | Publicação automática do repositório; abrir com recarga completa para renovar o cache |
| Worker / Firebase Rules | **Nenhuma alteração nesta etapa** | Preservar as configurações e a separação TESTE/OFICIAL |

**Implantação dos Apps Scripts:** após conferir as propriedades dos projetos (sem copiar valores privados para o GitHub), usar **Implantar → Gerenciar implantações → Editar → Nova versão**, preservando os URLs `/exec`. A API administrativa continua autenticada.

**Atenção à mesma planilha:** `MART_V153_SHEET_ID` (admin de TESTE) e `MART_EVT_SHEET_ID` (coletor de TESTE) precisam permitir consultar a mesma aba `Config_Campanhas`. Se os IDs apontarem para planilhas diferentes, o portal não terá acesso à campanha salva pelo administrador. Conferir antes de publicar, sem alterar outros bancos.

## Visual do Portal de Gerentes

A página usa `img/logo.png` (mesma logo estática do admin) como fallback e consulta somente o campo público `aparenciaPortal_TESTE/logo` no Firebase para refletir a logo personalizada da vitrine. Não é necessário novo login ou outra API administrativa. O restante do visual usa cores, cartões, botões, campos, filtros e cabeçalho alinhados ao admin em desktop e celular.

## Checklist de homologação

- [ ] Campanha geral salva uma vez aparece em oferta **antiga** e nova, ambas sem campanha individual.
- [ ] Campanha individual prevalece sobre geral; alterar a geral não modifica ofertas individuais.
- [ ] Produto recebe somente `utm_source`, `utm_campaign`, `utm_id`; nenhum `sem_campanha` fictício.
- [ ] Produto com UTM antiga não fica com parâmetros UTM repetidos; parâmetros não relacionados são mantidos.
- [ ] Configuração avançada salva e recarrega nos dois ambientes da homologação, respeitando o intervalo de cache.
- [ ] Sem campanha individual nem geral, portal avisa e não compartilha um link enganoso.
- [ ] Aba Contatos usa as mesmas regras do portal público.
- [ ] Link comercial mantém `/parceiros/MATRICULA?redirect=...` para vendedor ativo.
- [ ] No destino final após o redirecionamento real, validar se o navegador conserva as UTMs e se o Analytics as recebe.
- [ ] Portal de Gerentes mostra logo, tema claro/escuro, cartões responsivos sem rolagem horizontal.
- [ ] Nenhum dado ou configuração do ambiente OFICIAL foi modificado.

**Testes executados no código isolado:** campanhas geral/individual, marcador legado, valores avançados, matrícula não vendedora, bloqueio sem campanha, criação/migração de `Config_Campanhas`, preservação de outras chaves e prevenção de alterações concorrentes. **Testes integrados com Google e Analytics ainda não executados.**

**Backup da `main` antes da alteração:** `backup/main-2026-11-19-antes-utm-gerentes`.

## Revisão complementar — 19/11/2026

A leitura da main 359a406 confirmou que a implementação descrita acima já estava presente. Esta revisão preserva essas funcionalidades e corrige largura máxima, corte de tabela em tablets, contraste de indicadores no tema escuro e herança de padding no alternador. Não há alteração de regras de acesso, backend ou dados.

O marcador sem_campanha não pode ser salvo pelo formulário como nome geral e, se já existir na configuração remota, não vira UTM. Uma consulta remota que falha invalida o cache para que a próxima tentativa realmente consulte o coletor.

Validação: 47 testes aprovados; ensaio de navegador com dados fictícios em 390px e 768px, consultas e relatório nos dois temas, sem largura horizontal excedente. A conexão real ao Sheets e a implantação atual dos Apps Scripts não foram verificadas nesta revisão. Os dois Code.gs descritos acima continuam sendo os arquivos necessários caso as implantações ainda estejam antigas.

Backup anterior à revisão: backup/main-2026-11-19-revisao-gerentes-utm; SHA 359a40651458b842125b7b349ad18e5dea982716. Retorno por novo commit restaurando os arquivos alterados, sem restaurar ou apagar dados.
