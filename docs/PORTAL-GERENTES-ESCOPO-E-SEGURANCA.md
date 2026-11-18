# Portal de Gerentes — proposta funcional e técnica

**Data:** 18/11/2026 · **Ambiente de desenvolvimento:** homologação · **Status:** especificação para implementação.  
**Não existe liberação de dados de gerentes/vendedores por matrícula nesta etapa.** Não foi criado endpoint público nem alterada a base de dados.

## Objetivo
Criar uma página separada, responsiva, para gerentes consultarem **somente vendedores da filial autorizada**, conhecerem a utilização do Portal de Ofertas e solicitarem novos cadastros/correções de telefone ao administrador.

Duas abas:
1. **Resultados** — indicadores, ranking, campanha, mês e detalhes do uso por vendedor.
2. **Cadastros** — situação do vínculo com e-commerce, telefones (sem exposição desnecessária), pendências e formulário de solicitação.

## Login e autorização: decisão de segurança indispensável

A matrícula identifica o gerente, mas **não autentica**. Em nenhuma hipótese liberar dados com base na matrícula informada pelo navegador.

**Fluxo proposto:**
1. Gerente informa matrícula no portal `gerentes.html`.
2. Autentica-se com conta Google (Firebase Auth já existente).
3. Apps Script valida o token Firebase no servidor, email verificado e provedor Google.
4. A API consulta uma nova aba privada `Gerentes_Autorizados` com colunas:
   `matricula_gerente | nome | email_autorizado | filial_autorizada | ativo | atualizado_em`.
5. O email autorizado, a matrícula e a filial precisam corresponder exatamente a um registro ativo. A filial autorizada **nunca é aceita do navegador**.
6. A API retorna apenas dados do escopo da filial autorizada. Não reutilizar `listarVendedores` ou `listarEventosPortal` do administrador, pois retornam informações amplas.
7. Revogação `ativo=NAO` deve valer na próxima requisição. O gerente não adquire privilégios administrativos.

**Cenário especial:** gestores sem matrícula na aba `Vendedores` continuam podendo ser autorizados exclusivamente pela aba `Gerentes_Autorizados`, sem inventar uma associação por nome ou telefone. A conta Google pode ser pessoal, desde que previamente aprovada pelo administrador.

## Aba Resultados

**Filtros:** mês (padrão mês atual), campanha e opcionalmente oferta. Toda aplicação de filtros acontece no servidor para o escopo da filial; o frontend não recebe eventos de outras filiais.

**Resumo:** vendedores ativos na filial, vendedores com atividade registrada, número de inícios de compartilhamento, ofertas distintas utilizadas. Ranking por vendedor com nome, matrícula e quantidade de inícios de compartilhamento; pode exibir evolução no mês e última atividade. Permitir ordenar por quantidade/atividade e pesquisar nome/matrícula.

**Medição honesta:** `inicio_compartilhamento` mede a tentativa de gerar/compartilhar oferta — **não confirma envio do WhatsApp, clique, compra ou venda**. O evento `acesso_portal` não inclui obrigatoriamente matrícula e portanto não deve ser atribuído a um vendedor. Campanhas podem estar ausentes para eventos legados, mostrar “Sem campanha”. Dados devem ser consultados de `Eventos_Portal`/`Eventos_Campanhas` com limites por período e otimizações; não expor logs brutos de outros vendedores.

**Tempo real:** atualização periódica leve sem recarregar a página; preservar filtros e seleção. Exibir aviso discreto de indisponibilidade e horário da última atualização. Considerar limites gratuitos do Apps Script.

## Aba Cadastros

Para cada vendedor **da filial autorizada**:
- Nome, matrícula, situação funcional e se está ativo.
- **E-commerce:** status indicativo derivado da última verificação de `Verificacao_Links`: “Link verificado”, “Não localizado” ou “Verificação pendente/inconclusiva”. Isso não comprova necessariamente cadastro interno da plataforma e deve ser identificado como indicativo; acesso a uma fonte oficial seria necessário para afirmar “cadastrado” com certeza.
- **Telefone:** “Validado”, “Pendente”, “No grupo — titularidade pendente” ou “Conflito”, segundo a mesma regra da v1.6.19. Evitar exibir telefones completos de vendedores na listagem dos gerentes; se indispensável, considerar mascaramento e revisão de autorização.
- Botão “Solicitar cadastro/correção” apenas para colaboradores na filial autorizada.

### Solicitação enviada pelo gerente

Campos:
- Matrícula e nome do vendedor preenchidos automaticamente; não editáveis.
- **Telefone do vendedor obrigatório**, máscara `(DD) 9 1234-5678` e validação de DDD, 11 dígitos, nono dígito e sequências fictícias também no backend.
- **Tipo de telefone obrigatório:** profissional ou pessoal.
- Interruptor com estados claramente escritos: **“Contrato temporário: Sim/Não”**.
- Observação opcional com limite de caracteres, sem expor dados sensíveis.

Gravar apenas na nova aba `Solicitacoes_Gerentes` (filial da sessão autorizada, gerente, vendedor, tipo, telefone, CT, data, status). Nunca editar diretamente a aba `Vendedores` ou `Telefones_Vendedores` pelo portal do gerente.

Status inicial exibido na fila administrativa:
- Interruptor desligado: **PENDENTE**.
- Interruptor ligado: **CT TEMPORÁRIO**.

Os dois são **estados de solicitação**, não uma alteração automática do vínculo funcional, da validação do número ou do cadastro oficial. A equipe administrativa revisa e processa o pedido. Status posteriores: `EM_ANALISE`, `CONCLUIDO`, `REJEITADO` e motivo restrito ao administrador. Deduplicar solicitação idêntica ainda pendente e registrar trilha de auditoria de quem solicitou.

A aba administrativa deve receber uma seção “Solicitações de gerentes” com filtros de filial, tipo e status, indicação visual de CT Temporário e ação de abrir o vendedor relacionado. Contador e dados não podem ser abertos para gerentes de outras filiais.

## API/backend

Reutilizar o Apps Script administrativo de TESTE, Google Sheets e Worker autenticado. Rotas próprias do gerente, sem permitir acesso às ações administrativas. A tabela de gerentes e as solicitações ficam no Sheets privadamente. Validar autorização **a cada requisição** e a matrícula do vendedor **pertencer à filial retornada pelo servidor** no momento da gravação.

Propostas de ações privadas:
- `consultarPerfilGerente`
- `consultarResultadosGerente`
- `consultarCadastrosGerente`
- `criarSolicitacaoGerente`
- Admins: `listarSolicitacoesGerentes`, `atualizarSolicitacaoGerente`.

Todo retorno deve conter apenas campos necessários; evitar retornar listas gerais e recortar no JavaScript do navegador. Proibir operações com matrículas inexistentes/duplicadas, gestores inativos, troca de filial, telefones inválidos e requisições repetidas. Rate limit e validação de tamanho. A página deve apresentar estado de erro sem vazar dados quando a autorização falhar.

Para a identidade de gerente, não usar o cadastro de WhatsApp como base de autorização. Nomes exibidos, telefones ou matrícula podem ser falsificados.

## Ordem de desenvolvimento

1. **Concluído:** administrador: ocultar telefone legado vazio e remover recargas/mensagens redundantes (frontend da homologação).
2. Modelar `Gerentes_Autorizados` e `Solicitacoes_Gerentes`, definir administradores responsáveis e processo de aprovação/revogação.
3. Construir autenticação isolada de gerente no Apps Script e testes negativos (outro email, matrícula, filial, tentativa de acessar outra filial, token falso/expirado).
4. Implementar somente leitura: painel Resultados e listagem Cadastros, com dados sintéticos de homologação.
5. Implementar solicitações validadas, deduplicação e fila administrativa, sem gravar nos cadastros de vendedores automaticamente.
6. Testes com duas filiais e pelo menos dois gerentes, responsividade/tema e quotas; verificar que gerente A jamais recebe dados da filial B.
7. Aprovar e implantar **somente na homologação**. Não replicar informações privadas de funcionários no GitHub ou Firebase público. Sem alteração oficial antes da aprovação.

## Decisões pendentes do negócio

- Qual conta Google cada gerente utilizará para autenticação e como será cadastrado/validado no mapa autorizado. O usuário quer matrícula como identificação; o backend requer também identidade autenticada.
- Se “CT Temporário” é apenas categoria de solicitação (recomendado) ou se existe classificação funcional oficial a sincronizar com outra base (exigiria outra fonte confiável).
- Se existe fonte oficial da situação “cadastrado no e-commerce”, além do verificador de links (hoje somente indicativo).

**Nota:** documentação de implementação, não portal de gerentes funcional. Não criar uma página com matrícula como única credencial e não disponibilizar dados reais sem autorização.
