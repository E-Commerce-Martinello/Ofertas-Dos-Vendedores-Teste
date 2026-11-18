# Ajustes de interface — 18/11/2026

## Validação
24 testes automatizados: regras anteriores e testes de prioridade destaque/ranking/aleatória, preservação da escolha manual e aviso diário por matrícula/ambiente. Navegador com dados sintéticos: administrador em desktop e iframe de 390px; tema escuro, alternadores, caixas de configuração, botão flutuante; portal em 390px, seleção destacada inicial, troca manual, botão de gerar visível após rolagem e aviso fechado sem reaparecer na segunda geração da mesma matrícula. Sem acesso ou gravação em dados reais. Não equivale a teste em aparelho físico.

## Backend pendente
O frontend consulta consultarCapacidades. A API deve responder resultado.sincronizacao. Resposta Ação não reconhecida ou ausência de suporte indica necessidade de atualizar o Apps Script; erros de conexão e autenticação são informados separadamente. O Worker versionado encaminha ações sem uma lista restrita, mas sua implantação atual não foi comparada. Não é possível comprovar a resposta autenticada da sessão do usuário somente pela captura de tela.

Próxima etapa necessária: obter os fontes atualmente implantados do Apps Script administrativo e coletor, mais Worker e propriedades de ambiente (somente nomes e correspondência, sem credenciais). Comparar com infrastructure e confirmar isolamento. Preparar backup das versões implantadas; apresentar diff, escopos e serviços necessários antes de autorizar implantação. Primeiro habilitar revisão/snapshot no ambiente de teste; validar consultarCapacidades e duas sessões, só depois considerar notificações Firebase e gatilhos. Não implantar fontes históricos reconstruídos sem essa comparação.

## Verificação manual após publicação
- Recarregar homologação e conferir Ativo/Inativo no tema claro/escuro e em formulário reaberto.
- Abrir Configurações no celular; testar rolagem interna da tabela e botões.
- Abrir nova oferta pelo ícone flutuante; verificar que seleção em massa permanece checkbox.
- Abrir portal com destaque vigente, depois sem destaque e com ranking. Sem ambos, qualquer oferta ativa é válida.
- Selecionar uma oferta e confirmar botão de gerar visível; verificar imagens quadradas com recorte.
- Matrícula de não vendedor: card fecha em 20 segundos visíveis ou pelo X, não reaparece no mesmo navegador/dia para ela. Falha na consulta da matrícula continua gerando aviso separado, não é tratada como não vendedor.

## Limites
O limite diário é local por navegador; sincronização entre dispositivos exige backend e está fora desta correção. O ranking depende da resposta pública já existente; indisponibilidade usa oferta ativa. O frontend mantém o bloqueio de edição segura enquanto não reconhece o backend novo. Oficial e serviços externos permanecem inalterados.

## Ponto de retorno
Backup: backup/main-2026-11-18-antes-ajustes-interface. Main anterior: 897d419d92b0e716d949c44e21fe45e3126d47cf. Restaurar arquivos por novo commit preservando histórico; não há migração de dados.
