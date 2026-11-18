# Registro de códigos informados — Homologação

**Registro inicial:** 18/11/2026.  
**Fonte:** códigos fornecidos pelo responsável pelo Portal de Ofertas na conversa, como referências do ambiente de homologação.  
**Status da implantação:** **não verificado diretamente nos consoles** Firebase, Apps Script e Cloudflare; esta pasta documenta fielmente o material recebido.  
**Aplicação:** somente versionamento no GitHub. **NENHUM** serviço externo ou dado foi alterado neste registro.

## Arquivos guardados

| Componente | Arquivo de referência | Versão encontrada no conteúdo | Git blob SHA |
| --- | --- | --- | --- |
| Apps Script administrativo | [apps-script/admin/Code.gs](apps-script/admin/Code.gs) | `MART_V1692_API_VERSION = '1.6.18'` | `c0b0ff96e291296dc0c73db482de07052ef37089` |
| Apps Script coletor público | [apps-script/coletor/Code.gs](apps-script/coletor/Code.gs) | Cabeçalho `1.6.3.2` (inclui recursos posteriores) | `2a31bc5ee7090b9a91dfc1a86daddf2dfab7a344` |
| Cloudflare Worker | [cloudflare/worker.mjs](cloudflare/worker.mjs) | Sem número de versão declarado | `24a3730dae0643149e489352ee910eed704fad48` |
| Firebase Realtime Database Rules | [firebase/database.rules.json](firebase/database.rules.json) | Regras com sufixo `_TESTE` | `a7e125bf80ae3ff4d012bfe4f263bbc7c41df122` |

Os arquivos `Code.gs` foram comparados integralmente aos dois anexos do usuário (sem diferenças). As regras Firebase e o Worker foram transcritos do texto enviado, sem modificar as regras ou a lógica do código.

## Como usar esta pasta em futuras atualizações

1. **Consultar primeiro esta pasta** para conhecer as últimas versões de backend que o usuário nos forneceu.
2. **Não confundir** os arquivos de referência com `infrastructure/apps-script/`, `infrastructure/cloudflare/` e `infrastructure/firebase/`, que contêm fontes de desenvolvimento ou fragmentos de regras ainda pendentes de implantação.
3. Ao receber um novo código alterado manualmente nos consoles, substituir **somente o arquivo correspondente nesta pasta**, registrar a data, origem, diferenças e atualizar os hashes/versões. Cada alteração fica rastreada pelos commits do GitHub. A sincronização **não é automática** enquanto não houver um processo de implantação e coleta dedicado.
4. Antes de qualquer implantação, comparar o registro com o serviço realmente publicado, confirmar propriedades e permissões, realizar backup, executar testes e pedir aprovação para mudanças de serviços.
5. O repositório **oficial não é atualizado** por modificações nesta pasta.

## Alertas técnicos identificados

- O Apps Script administrativo fornecido **não contém** as ações `consultarCapacidades` e `sincronizarAdmin` exigidas pela interface v1.6.19. Isso é compatível com a mensagem "backend pendente". Os arquivos de desenvolvimento em `infrastructure/apps-script/admin/Refinamento.gs` são outra versão e **não foram implantados** por esta operação.
- As regras Firebase recebidas **não possuem** o nó `adminSync_TESTE` preparado no fragmento de regras da v1.6.19. Não adicioná-lo aqui: esta pasta representa exatamente o código informado.
- O Worker permite somente a origem `https://e-commerce-martinello.github.io`. O coletor também possui restrições à origem GitHub Pages. O projeto Cloudflare Pages precisa de mudanças controladas antes de se tornar operacional.
- O Worker depende de `APPS_SCRIPT_URL`, e os Apps Scripts dependem de propriedades externas; **não salvar valores privados dessas propriedades no GitHub**.

### Segurança do repositório

Este repositório é **público** e o GitHub Pages pode expor arquivos que estiverem na raiz de publicação. O código publicado aqui **não deve conter segredos**: tokens, chaves privadas, senhas, exportações de planilhas ou dados de vendedores. As regras recebidas incluem o endereço de e-mail do administrador principal em verificações de autorização; ele ficará visível no repositório público. O endereço de e-mail **não substitui a autenticação**.

Para uma reorganização futura, preferir publicar apenas a pasta de frontend via pipeline, mantendo os arquivos de infraestrutura fora do artefato hospedado. Se for necessário armazenar material privado, usar um repositório privado e credenciais gerenciadas externamente.

## Ponto de retorno

Antes de registrar os arquivos na `main`, foi criada a branch de backup:

`backup/main-2026-11-18-antes-snapshots-backend`  
Commit-base: `7c44c26691263f308a3b448a5a42437edf5a77c8`.
