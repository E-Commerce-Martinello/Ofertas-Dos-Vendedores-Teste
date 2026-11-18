# Refinamento v1.6.19 — validação e implantação proposta

Estado: implementação em branch, ainda não publicada. Não liberar como versão estável antes da validação integrada. Referência da homologação: `43a0b2693ebb5d82b1608f5f57da3f8e031307f2`. Nenhuma configuração de destino foi alterada.

## Verificações realizadas

- `node --test tests/*.test.cjs`: validação, evidências independentes de titularidade, duplicatas, associação de pedidos sem sobrescrita, legado inválido, prioridade, revisão obsoleta, lote de escrita único, pausa/backoff, concorrência e descarte de resposta após logout.
- Compilação sintática de JS/GS; scripts do HTML existentes; IDs únicos; dois inputs de telefone no modal; configuração de ambientes igual à base.
- Navegador com 36 registros sintéticos, serviços reais desconectados: cadastro, erro de DDD, aviso de conflito mantendo o nome digitado, bloqueio de salvamento obsoleto, filtro de filial por teclado, temas claro/escuro.
- Abas ofertas, links, contatos, aparência, configurações, dashboard e vendedores em desktop e iframe com viewport de 390 × 844. Nenhum overflow horizontal do documento nas abas; modal dentro do viewport com rolagem interna. A área útil com scrollbar foi 375 px. Isto não substitui teste em Android/iOS reais.
- A aba de acessos e as operações autenticadas de criação, exclusão, importação, envio/compartilhamento e upload ainda precisam de teste integrado. Não foram executadas contra dados reais.
- Evidência: `docs/evidencias/mobile-v1.6.19.jpg` (dados fictícios; botão de simulação pertence somente ao ensaio, não ao produto).

## Plano externo — requer aprovação antes de executar

1. Conferir/exportar o código **realmente implantado** dos dois Apps Scripts e do Worker de teste. As fontes aqui versionadas partiram do pacote histórico v1.6.18.2 e Worker v1.6.9.1; não há prova de igualdade com os serviços atuais. Integrar eventuais diferenças antes de substituir código.
2. Fazer backup da planilha e registrar as versões atuais dos serviços, regras Firebase e implantação do Pages. Não copiar dados privados para GitHub.
3. No Apps Script administrativo de TESTE, integrar `Code.gs`, `Refinamento.gs`, `Telefones.gs` e revisar o manifesto. Ativar o serviço avançado Google Sheets API v4 e autorizar os escopos necessários. Confirmar propriedades de TESTE, projeto Firebase e ID da planilha. Nunca copiar propriedades do oficial.
4. Conferir a aba `Telefones_Vendedores` e seus oito cabeçalhos descritos em `MART1618_FONES_CAB`. Se ausente, criar somente a aba vazia usando o preparador existente `mart1618_abaFones_(true)` depois da aprovação. Não converter, apagar nem mover os telefones existentes. Se o cabeçalho divergir, interromper e revisar.
5. Integrar o coletor de TESTE com seu `Telefones.gs`. Preservar implantação, autenticação, planilha e propriedades específicas. O pedido público continua append-only; a associação é derivada apenas quando há evidência independente e campo tipado vazio.
6. Publicar uma versão de TESTE das APIs, conferir `consultarCapacidades` com conta autorizada e então disponibilizar o frontend da branch em homologação, coordenando a troca: o backend novo bloqueia os endpoints antigos de edição de vendedores para evitar gravação parcial. Não mesclar/publicar automaticamente.
7. Começar com `MART19_PUSH_ATIVO=false`. Worker continua ponte autenticada sem cache; não precisa de alteração para os novos nomes de ação. Conferir que `APPS_SCRIPT_URL` aponta apenas para a API de TESTE.
8. Após o modo periódico funcionar, avaliar/autorizar acionadores `instalarAcionadoresRefinamento()` (onEdit/onChange) e o push opcional. O fragmento Firebase é **aditivo**, não um arquivo completo de regras: não substituir as regras existentes. O OAuth do Apps Script precisa de permissão IAM no Firebase de TESTE; não criar credenciais públicas. Confirmar autorização do proprietário e demais admins no nó privado. Só então habilitar push.
9. Executar checklist abaixo, registrar resultados e aprovar versão candidata. Só depois gerar pacote de publicação, tag/release `v1.6.19` e SHA. O oficial continua fora desta aprovação.

## Checklist manual de aceitação

- [ ] Duas contas autorizadas: alteração de vendedor, telefone, identificação, convite e campanha aparece na outra sessão sem F5.
- [ ] Alteração direta na planilha é percebida; testar separadamente edição humana e escrita por API/fórmula.
- [ ] Filtros, busca, seleção de filial/oferta, itens exibidos, aba e navegação permanecem úteis após atualização.
- [ ] Formulário aberto conserva valores; revisão antiga bloqueia salvamento. Confirmar também conflitos de aparência/oferta/rascunho.
- [ ] Sem conexão/aba oculta: consultas pausam; retorno reconcilia; erros repetidos aumentam intervalo. Conferir consumo por várias horas.
- [ ] Legado e extras históricos permanecem intactos ao instalar. Campo histórico inválido inalterado pode ser preservado; novas entradas inválidas não são aceitas.
- [ ] Testar DDD inválido, falta do 9, 10/12 dígitos, +55, zeros internos, letras, repetição, sequência fictícia e duplicata entre matrículas.
- [ ] Mesmo telefone na lista sem titularidade: “No grupo — titularidade pendente”. Declaração isolada não valida. Matrícula exata/associação confiável valida sem conflito.
- [ ] Mudança de participantes/associações atualiza fila e elegibilidade. Número confirmado no grupo tem prioridade; em empate, profissional.
- [ ] Cadastro novo, edição, pedidos pelo portal, importações revisadas e cadastros inativos continuam corretos.
- [ ] Ofertas, agendamento, expiração, rascunhos, importação/exclusão em massa, banners, convites, histórico e relatórios funcionam com dados descartáveis de teste.
- [ ] Teclado, foco, leitores de tela, Android/iOS, temas e zoom 200%; testar modais de todos os fluxos, não apenas vendedor.
- [ ] Login em PC/celular com proprietário e segunda conta; usuário não autorizado não lê snapshots nem metadados privados.
- [ ] Confirmar logs/destinos: nenhuma chamada de teste atinge projetos, planilhas ou Workers oficiais.

## Limites e riscos conhecidos

- Sheets não fornece notificação pública nativa ao navegador. Conferência de revisões: 90–105 s por sessão visível, com uma requisição em voo. Push é agrupado, espaçamento mínimo aproximadamente 30 s. Não prometer latência instantânea.
- Sem acionador/push, alterações externas são detectadas pelo fingerprint global a cada até 5 min, mais o próximo ciclo. Erros/rede/quotas podem aumentar o prazo. Novos pedidos do coletor usam essa reconciliação.
- Cadastros e pedidos têm limite protetivo de 20 mil linhas; ultrapassar requer revisão de arquitetura. Dashboard, auditoria e histórico de contatos monitoram os últimos 500 registros: edições em linhas mais antigas podem exigir atualização manual da área. O cadastro não é limitado a 500.
- Lock protege escritores do mesmo Apps Script; não bloqueia edição humana direta do Sheets durante uma gravação. A conferência anterior reduz o risco, mas não oferece CAS absoluto contra pessoas ou outros projetos. Em períodos de edição administrativa, evitar alterações simultâneas diretas nas mesmas linhas.
- A revisão de vendedor inclui associações globais: mudanças de telefones/grupo podem exigir reabrir um cadastro mesmo sem alteração no nome. É uma escolha conservadora contra validações obsoletas.
- Listas WhatsApp são fotografias importadas. Não provam participação atual e não verificam identidade por serviço externo.
- Reversão deve coordenar frontend e backends pelas versões guardadas. Não restaurar uma planilha inteira sobre dados novos; a reversão de código preserva os dados. Regras e acionadores exigem revisão separada.

## Versionamento

`VERSION` permanece `1.6.19-dev` até validação. A versão estável terá três componentes (`MAJOR.MINOR.PATCH`); registrar a versão anterior de quatro componentes como histórico, sem reescrever tags antigas. Commits separados por documentação, validação, backend, sincronização e interface. CHANGELOG registra comportamento, dependências e incompatibilidades. Nunca armazenar tokens, propriedades privadas, IDs de planilha privados ou exportações reais no repositório.
