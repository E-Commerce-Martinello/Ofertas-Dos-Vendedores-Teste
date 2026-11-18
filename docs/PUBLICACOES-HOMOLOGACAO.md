# Publicações na homologação

Autorização do usuário em 18/11/2026: atualizações podem ser feitas diretamente na main de E-Commerce-Martinello/Ofertas-Dos-Vendedores-Teste, com ponto de retorno registrado antes de cada alteração. Essa autorização não abrange o repositório oficial nem implantações em serviços externos ou migrações destrutivas.

## Correção de desempenho — 18/11/2026
- Backup: backup/main-2026-11-18-antes-correcao-desempenho.
- Commit anterior da main: 7a6a444f4ea7397a36f9ceb0818e49a04c67f3d2.
- Correção validada: ef8edde76a8415b87152166824e7a30bfde907ae.
- Verificação: 21 testes aprovados; ensaio no navegador com 6.000 vendedores sintéticos.
- Retorno: criar um novo commit na main restaurando os arquivos da correção a partir do backup, preservando o histórico e eventuais alterações posteriores. Não restaurar bancos de dados: esta publicação só altera código/documentação.
- Apps Script, Firebase e Cloudflare não foram implantados nesta publicação; backend novo continua pendente.

## Códigos de backend preparados — 18/11/2026
- Ponto de retorno do GitHub: `backup/main-2026-11-18-antes-backend-v1619` (base `4da4130634ddc961e856aec2e51ea20920d27c4c`).
- Atualizados diretamente na `main` **somente os arquivos de código**: Apps Script ADMIN/Coletor, Worker e regras completas Firebase de TESTE.
- `infrastructure/GUIA-COPIAR-BACKEND-TESTE-v1.6.19.md` documenta exatamente quais arquivos copiar e em que ordem.
- Código antigo enviado pelo usuário preservado em `infrastructure/registro-atual/homologacao/` como referência.
- Removidas funções legadas desabilitadas; mantidas validações de autorização, token e conflitos. Melhorias de leitura/indexação e controle de origem.
- Padronizados calendários de contagem diária para `America/Sao_Paulo`, conforme preferência validada.
- Verificações de sintaxe e testes isolados de regras/redirect Worker concluídos; testes integrados contra serviços reais ainda pendentes.
- **IMPORTANTE:** não houve implantação em Firebase, Apps Script ou Cloudflare, nem migração/alteração de dados. O aviso de backend pendente permanecerá até instalar e validar as novas versões.
