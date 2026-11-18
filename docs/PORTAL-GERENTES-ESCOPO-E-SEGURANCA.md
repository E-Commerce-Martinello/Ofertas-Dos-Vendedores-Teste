# Portal de Gerentes — escopo atualizado (matrícula simples)

**Data:** 18/11/2026 • **Ambiente:** TESTE • **Código:** alterado no GitHub; implantação de Worker/Apps Script pendente.

## Entrada e navegação

A nova página `gerentes.html` é acessível pelo atalho **PORTAL DE GERENTES** dentro do admin ou por URL direta, sem parâmetros UTM. O gerente digita apenas a **matrícula**. Não há login Google nessa página.

A aba privada `Gerentes_Autorizados` no Sheets contém matrícula, nome, filial, ativo e data. A API consulta o cadastro ativo e busca a filial ali, não no navegador. Uma matrícula não cadastrada, inativa ou duplicada é recusada.

**Risco assumido nesta configuração:** a matrícula **não é uma senha nem autenticação**. Quem souber uma matrícula ativa pode consultar a filial e registrar pedidos como se a tivesse informado legitimamente. O sistema não tem como afirmar que o solicitante é o gerente. O uso com dados reais envolve exposição de nomes, matrículas e indicadores de uso de colaboradores a terceiros que obtenham uma matrícula. A recomendação técnica permanece login ou outro segundo fator antes de produção.

## Duas abas

**Resultados:** filtros por mês e campanha; ranking por vendedor da filial, início de compartilhamento, ofertas utilizadas e última atividade. Início de compartilhamento é tentativa/ação no portal, **não comprovação de envio, clique, compra ou venda**.

**Cadastros e solicitações:** lista dos vendedores da filial, situação funcional, condição indicativa do link e status de telefone. Os números completos não são retornados ao gerente. O gerente pode solicitar um cadastro/revisão informando telefone obrigatório e tipo pessoal/profissional; o botão **Contrato temporário** cria pedido `CT_TEMPORARIO` quando ligado, ou `PENDENTE` quando desligado. O pedido não edita cadastros automaticamente.

O verificador de link **não comprova necessariamente cadastro no e-commerce**. Exibimos status descritivo do link até obter uma fonte oficial de cadastro.

## Segurança que permanece

- **Admin**: login Firebase/Google obrigatório; ações `listarVendedores`, `salvarCadastroCompleto`, `listarSolicitacoesGerentes` e `atualizarSolicitacaoGerente` seguem protegidas.
- **Visitante por matrícula**: exclusivamente `consultarPainelGerente` e `criarSolicitacaoGerente`, validadas no servidor. O Worker exige token para todas as outras ações.
- **Filial**: servidor decide a partir da matrícula cadastrada e filtra cada vendedor e evento antes do retorno; solicitações fora da filial são recusadas.
- **Dados**: nada de números de WhatsApp completos nas listas, planilha não publicada, tokens/cadastros não versionados no GitHub.
- **Solicitações**: registradas na `Solicitacoes_Gerentes` com origem `MATRICULA_<código>`, sem pretensão de comprovar identidade. Duplicação, validação do telefone e limites diários permanecem.
- **Implantações**: oficial não alterado; manter projetos/IDs independentes.

## Instalação e testes

O site de TESTE foi atualizado; para funcionar sem Google, **também** será necessário implantar o `Code.gs`, `Gerentes.gs` e o `worker.mjs` novos nos serviços de TESTE. Caso não tenha aplicado a v1.6.19 anterior, atualizar os outros módulos do Apps Script Admin de acordo com o guia.

Consulte [instruções completas e nova tabela de cinco colunas](PORTAL-GERENTES-INSTALACAO-TESTE.md).

**Não houve alteração automática no Apps Script, Cloudflare, Firebase ou Google Sheets.**
