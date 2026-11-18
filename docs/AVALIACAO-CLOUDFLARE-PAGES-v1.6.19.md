# Avaliação controlada — Cloudflare Pages e armazenamento

Situação: **planejamento e código de prévia preparados**. Nenhuma implantação Cloudflare Pages, Worker, Firebase ou Apps Script executada. Não copiar dados oficiais para homologação.

## Constatações atuais

- O repositório atual tem código de site em raiz, além de `infrastructure/`, `scripts/`, `tests/` e `docs/`. Nunca usar o repositório inteiro como diretório público do Pages.
- `shared/config.js` seleciona TESTE/OFICIAL apenas pela origem GitHub Pages e nome do repositório. Uma URL `*.pages.dev` é rejeitada na versão atual.
- A fonte versionada de `infrastructure/cloudflare/worker.mjs` permite CORS unicamente de `https://e-commerce-martinello.github.io` e define `parentOrigin` com esse valor. Portanto a prévia no Pages **não pode usar a API administrativa sem integrar previamente uma alteração de origem permitida ao Worker de TESTE**, após auditar o código efetivamente implantado.
- O Firebase Auth pode precisar que o domínio Pages de TESTE seja cadastrado nos domínios autorizados. Conferir a identidade e autorizações do projeto de TESTE.
- Código dos backends v1.6.19 presente no GitHub **não significa implantação**; `consultarCapacidades` precisa responder corretamente no Apps Script administrativo de TESTE. Não remover a trava de edição segura para contorná-lo.

## Build isolado para testar, sem publicação automática

Arquivo: `scripts/build-pages-preview.cjs`. Copia exclusivamente `index.html`, `admin.html`, `img/`, `model/`, `presenter/`, `shared/`, `view/` para `dist/`. Ajusta a variável `MART_AMBIENTE` **apenas na cópia do build** para `TESTE`. O fonte compartilhado permanece inalterado. O build falha se `MART_PAGES_ENV` não for exatamente `TESTE`.

Configuração futura, **somente para o projeto Pages de homologação**:

- Repositório: `E-Commerce-Martinello/Ofertas-Dos-Vendedores-Teste`
- Branch de produção Pages: escolher conscientemente a branch de homologação validada, nunca apontar para o repositório oficial por engano.
- Comando de build: `node scripts/build-pages-preview.cjs`
- Diretório de saída: `dist`
- Variável de ambiente de build: `MART_PAGES_ENV=TESTE`
- Definir `dist/` no .gitignore.
- Limitar o acesso da integração GitHub apenas ao repositório desejado.

Antes de executar esse teste, conferir e aprovar as configurações de CORS no Worker de TESTE, o domínio do Pages no Firebase Auth e os cabeçalhos/URLs efetivos. Não reaproveitar segredos de outro ambiente. Os URLs oficiais devem continuar funcionando inalterados.

## Métricas do banco: preencher antes de decidir migrar

A leitura de métricas reais de uso exige acesso autorizado aos consoles; **este documento não contém medições reais**.

Coletar separadamente para TESTE e OFICIAL, em janela de 30 dias:

| Recurso | Evidência e métrica | Resultado |
|---|---|---|
| Firebase RTDB | Console Firebase > Realtime Database > Usage: storage atual/pico | Pendente |
| Firebase RTDB | Downloads mensais e picos diários | Pendente |
| Firebase RTDB | Conexões simultâneas e tendências | Pendente |
| Firebase RTDB | Tamanho agregado dos nós de ofertas e banners Base64 | Pendente |
| Google Sheets | Linhas, abas, tamanho exportado e frequência de crescimento | Pendente |
| Apps Script | Execuções, duração média, erro, quota de triggers | Pendente |
| Cloudflare Workers | Requisições, falhas e uso do plano gratuito | Pendente |
| Pages | Builds e tráfego após testes de prévia | Ainda não publicado |

Não colocar exportações reais com telefones, tokens ou imagens internas no GitHub. Os banners Base64 inseridos no RTDB aumentam storage e tráfego; considerar compactação e separação de mídia somente depois de medir. Avaliar limites e custos/quotas das alternativas antes de aprovar qualquer migração.

## Decisão provisória

- **Aprovado**: preparar ensaio técnico do Cloudflare Pages conectado ao GitHub, sem desligar GitHub Pages.
- **Não aprovado/Não executado**: criar Pages via conta Cloudflare, mudar destinos de Worker, habilitar domínio Firebase, migrar dados, criar buckets/bancos, alterar regras, publicar no oficial.
- **Próxima dependência**: instalar e validar backend v1.6.19 no ambiente de homologação por procedimento controlado e rever Worker/CORS antes de usar Pages.
- **Banco**: manter a arquitetura atual até medir custo de operação, armazenamento e riscos. A migração não é requisito para funcionar no Pages.

Documentação de referência: https://developers.cloudflare.com/pages/configuration/git-integration/ ; https://developers.cloudflare.com/pages/configuration/build-configuration/ ; https://firebase.google.com/docs/database/usage/monitor-usage
