# Portal de Gerentes — implantação controlada em homologação

**Preparado no código em 18/11/2026.** A nova página está no repositório GitHub de TESTE, mas **NÃO está liberada para dados reais até instalar o backend e cadastrar os gerentes autorizados**.

## Arquivos envolvidos

| Local | Código no GitHub |
|---|---|
| Página pública de login (sem dados antes da autenticação) | [gerentes.html](../gerentes.html) |
| Interface JavaScript | [presenter/gerentes-presenter.js](../presenter/gerentes-presenter.js) |
| CSS responsivo | [view/gerentes.css](../view/gerentes.css) |
| Apps Script administrativo atualizado | [infrastructure/apps-script/admin/Code.gs](../infrastructure/apps-script/admin/Code.gs) |
| Novo módulo no mesmo Apps Script administrativo | [infrastructure/apps-script/admin/Gerentes.gs](../infrastructure/apps-script/admin/Gerentes.gs) |
| Integração com sincronização | [infrastructure/apps-script/admin/Refinamento.gs](../infrastructure/apps-script/admin/Refinamento.gs) |
| Fila no administrador | [presenter/gerentes-solicitacoes-presenter.js](../presenter/gerentes-solicitacoes-presenter.js) |

Nenhum novo projeto Firebase, Cloudflare ou Google Sheets é necessário. O módulo de gerentes utiliza o **mesmo projeto Apps Script administrativo de TESTE**, a mesma API privada via Worker e abas adicionais na planilha de homologação.

**Não implantar no oficial sem validação.**

## 1. Conferir e instalar no Apps Script ADMIN de TESTE

1. Faça backup do código e registre a versão atual da implantação Web App.
2. Atualize `Code.gs` e `Refinamento.gs` conforme os arquivos do GitHub; mantenha `Telefones.gs` e o manifesto `appsscript.json` existentes conforme `infrastructure/GUIA-COPIAR-BACKEND-TESTE-v1.6.19.md`.
3. Crie **`Gerentes.gs`** no mesmo projeto administrativo e cole todo o conteúdo do arquivo correspondente no GitHub. Não copie para o coletor público.
4. Confira as propriedades de TESTE (`MART_AMBIENTE=TESTE`, IDs da planilha e do Firebase TESTE, conta administradora). Não exponha segredos no GitHub.
5. Execute, com a conta principal, **`prepararEstruturaGerentesV1619`**. A função apenas prepara as abas abaixo; nenhum vendedor é criado, alterado ou excluído.
6. Preencha a aba `Gerentes_Autorizados` com os gerentes autorizados (veja tabela).
7. Editar a implantação Web App de TESTE existente, selecionando **Nova versão**, e manter sua URL `/exec`.
8. Testar com uma conta Google de gerente previamente autorizada e outra não autorizada. A segunda **não** pode ver vendedores nem resultados.

## 2. Estrutura da aba privada Gerentes_Autorizados

| Coluna | Nome exato | Exemplo fictício |
|---|---|---|
| A | matricula_gerente | 12345 |
| B | nome | Gerente Exemplo |
| C | email_autorizado | gerente.exemplo@gmail.com |
| D | filial_autorizada | 1 |
| E | ativo | ATIVO |
| F | atualizado_em | 2026-11-18 |

Cada vínculo deve estar autorizado por quem administra o sistema. **Não basta conhecer a matrícula**: o gerente deve entrar com o mesmo e-mail Google verificado cadastrado na coluna C.

Para revogar, altere `ativo` para `INATIVO` ou `NAO`. Não remova registros sem antes registrar quem autorizou a alteração. Uma filial por vínculo na versão inicial.

Se os gerentes não constarem como vendedores no relatório RH, isso não impede o acesso: a autorização é feita por essa aba independente, não pela lista de WhatsApp.

## 3. Estrutura da aba Solicitações

`Solicitacoes_Gerentes` é criada automaticamente na preparação, com os cabeçalhos definidos no módulo. O gerente **não acessa essa planilha diretamente**: envia solicitações autenticadas pela API.

Cada pedido contém gerente, filial, vendedor, número informado, tipo, indicador de contrato temporário, status e data.

- Contrato temporário **NÃO**: status inicial `PENDENTE`.
- Contrato temporário **SIM**: status inicial `CT_TEMPORARIO`, exibido como **CT Temporário** no administrador.
- O cadastro do vendedor só deve ser alterado após revisão pela equipe administrativa.
- Os pedidos idênticos ainda abertos são deduplicados. A API também limita pedidos por gerente/dia e recusa vendedores de outra filial.

No admin, abra **Base de Vendedores → Solicitações de gerentes**, clique em **Revisar vendedor** para abrir o cadastro. Depois da revisão, marque **Concluir** ou **Rejeitar** com confirmação. Concluir a solicitação não valida o telefone automaticamente.

## 4. Link para testar

[Portal de Gerentes de Homologação](https://e-commerce-martinello.github.io/Ofertas-Dos-Vendedores-Teste/gerentes.html)

O link existe no GitHub Pages após a publicação do commit; antes do Apps Script e das abas serem preparados, a autenticação deverá falhar de modo seguro, **sem liberar dados**.

As duas abas são:
1. **Resultados**: indicadores de início de compartilhamento por mês/campanha, ranking por vendedor da filial e última atividade.
2. **Cadastros e solicitações**: situação funcional, status indicativo de link e telefone; envio obrigatório de celular brasileiro com DDD, tipo pessoal/profissional e opção CT Temporário.

A contagem é **indicativa**, não prova de venda ou de mensagem enviada no WhatsApp. A origem de dados é a planilha do ambiente correspondente. Eventos antigos podem ficar fora da janela de leitura; a interface avisa quando houver truncamento.

## 5. Testes de segurança obrigatórios

- [ ] Conta sem autorização: matrícula válida + e-mail não cadastrado = acesso negado.
- [ ] Mesmo e-mail com matrícula diferente = acesso negado.
- [ ] Gerente de filial 1 não recebe dados de filial 2, mesmo alterando requisição diretamente no navegador.
- [ ] Gerente não consegue chamar ações administrativas como `listarVendedores` ou `salvarCadastroCompleto`.
- [ ] Vendedor de outra filial é rejeitado ao tentar criar solicitação.
- [ ] Número inválido, tipo ausente, pedido duplicado e excesso de pedidos são recusados.
- [ ] CT Temporário aparece no admin e não altera a situação funcional nem o status do telefone antes da revisão.
- [ ] Admin recebe dados atualizados em sincronização automática sem recarregar a página.
- [ ] Interface responsiva no Samsung e no desktop; tema claro/escuro e teclado.
- [ ] Ambiente oficial não recebe solicitações, gravações nem consultas desta implantação.

**Rollback:** restaurar versão anterior da implantação do Apps Script administrativo e do frontend se falhar. Não restaurar uma planilha inteira sobre registros recentes. As novas abas não devem ser apagadas automaticamente.

## 6. Limitações e decisões

O status “e-commerce cadastrado” não pode ser confirmado apenas pelo comportamento de redirecionamento do link. A UI exibe **“Link verificado / Link não localizado / Verificação pendente”**, sempre como indicação, não como confirmação de vínculo comercial.

A matrícula do gerente não serve como senha. A autenticação Google é obrigatória para proteger dados dos funcionários sem introduzir um serviço pago adicional. Quando houver fonte interna de autorização de gerentes, ela poderá substituir o cadastro manual no Sheets.

Não foram migrados dados ou implantados códigos nos serviços externos nesta entrega; o funcionamento completo dependerá dessas etapas manuais.
