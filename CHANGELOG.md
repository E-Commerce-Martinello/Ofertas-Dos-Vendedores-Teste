# Histórico de alterações

## 1.6.19 — em desenvolvimento, não publicada
- Diagnóstico técnico e plano em docs/PLANO-v1.6.19.md.
- Fontes de infraestrutura recuperados de pacotes anteriores para revisão; não confirmados como os atualmente implantados.

## 1.6.18.3 — base confirmada em 17/11/2026
- Homologação sincronizada e testada pelo usuário.
- Importação de rascunhos com pendências, correção de duplicidades em buscas e exclusão em massa.
- Base da homologação: 43a0b2693ebb5d82b1608f5f57da3f8e031307f2.

### Implementação preparada na branch de homologação
- Sincronização de snapshots administrativos com revisões, deduplicação, pausa em segundo plano e backoff; notificações Firebase opcionais.
- Cadastro com profissional/pessoal opcionais, histórico legado preservado e associação derivada de solicitações com evidência independente.
- Validador único de celulares no navegador e nos dois backends; importações não inventam o nono dígito.
- Gravação conjunta de vendedor e extras pela API avançada do Sheets, revisão obrigatória e rejeição de conflitos. Endpoints antigos de edição bloqueados no backend novo.
- Aparência salva por transação Firebase; convites por revisão; formulários sujos protegidos de atualização automática.
- Componentes administrativos compartilhados: campos, botões, combobox pesquisável com teclado, alternadores, mensagens e modais responsivos. Seleção múltipla preservada.
- Fontes de infraestrutura, testes e roteiro de implantação versionados. Nenhuma implantação externa executada. Consulta ao WhatsApp continua baseada na última lista importada.

### Dependências para liberação
Conferir fontes realmente implantadas, autorizar API avançada/escopos e validar duas sessões reais em homologação. Push exige autorização adicional de IAM/regras/acionadores. Consultar `docs/VALIDACAO-v1.6.19.md`. A versão permanece `1.6.19-dev`; não é release publicada.
