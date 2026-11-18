# Correção do travamento administrativo — 18/11/2026

## Diagnóstico
A avaliação de cada telefone percorria a base inteira, repetidamente nos indicadores e listas. Em ensaio isolado anterior, 1.000 vendedores produziram 1.000.000 leituras de telefone em uma passagem (260 ms). É um gargalo confirmado compatível com o relato; não foi coletado um perfil da sessão real congelada para excluir outras causas.

## Correção
Índice de telefones por matrícula, participantes e identificações por snapshot; cache de avaliações por objeto, invalidado quando as fontes mudam ou na atualização explícita do grupo. O editor usa a mesma regra com o índice, incluindo candidato ainda fora da base. Nomes de filiais pré-calculados. Regras de validação e titularidade preservadas. Nenhuma migração ou alteração de dados.

Arquivos: shared/telefones.js, presenter/vendors-presenter.js, model/filiais.js, admin.html; cópias geradas de Telefones.gs permanecem idênticas ao módulo compartilhado. A correção de desempenho do navegador não exige implantar Apps Script.

## Verificação
- 21 testes automatizados aprovados, incluindo quatro de regressão de desempenho/equivalência/invalidação/filiais.
- 6.000 vendedores, quatro rodadas de indicadores: 12.000 leituras de telefone, crescimento linear.
- Navegador com dados exclusivamente sintéticos e API antiga simulada: carga/renderização inicial em 75 ms; busca por matrícula retornou um registro, sem congelamento observado.
- Tempos dependem da máquina e não incluem latência dos serviços reais. Teste não comprova todos os fluxos nem desempenho no dispositivo do usuário.

## Publicação e teste manual pendentes
Correção preparada na branch refinamento/v1.6.19. Não altera oficial nem serviços externos. Antes da liberação, revisar e aplicar somente na homologação. Após publicar, recarregar com cache atualizado; conferir carregamento, busca, filtros, mostrar mais, troca de abas e atualização da lista com a base real. Confirmar que números repetidos continuam pendentes e que alterações de participantes invalidam os indicadores.

O aviso de backend pendente é independente: significa que os recursos novos da API ainda não foram reconhecidos. A correção não remove o bloqueio de edição segura. Implantação do backend continua exigindo comparação das fontes, plano e autorização.
