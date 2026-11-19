# Diagnóstico de desempenho — homologação

Acesso: Admin → Configurações → Desempenho e uso da sessão.

## O que mede
- Chamadas efetivamente enviadas à API: quantidade, falhas e duração média/máxima/última. Cache e chamadas deduplicadas não geram nova contagem.
- Leitura explícita de ofertas no Firebase e número de callbacks do listener de ofertas.
- Estado e horário da última conferência administrativa aplicada.
- Tamanho lógico JSON das ofertas em memória, somente ao clicar em Medir ofertas já carregadas.

Exportar diagnóstico baixa agregados JSON. Não inclui cadastros, payloads, URLs, credenciais ou conteúdo dos erros. Os agregados existem somente na memória da aba e são reiniciados ao recarregar. Não há envio automático, consultas adicionais nem novos intervalos.

## Limitações
Os tempos incluem rede, gateway e servidor: não isolam o Sheets. Callbacks Firebase podem ser iniciais, locais ou cacheados e não representam downloads ou gravações remotas. O tamanho JSON não equivale ao banco completo ou tráfego cobrado. As medições cobrem o admin, não todos os acessos públicos. Não medem automaticamente o atraso entre duas sessões.

## Checklist de coleta e validação
- [ ] Usar normalmente a homologação, abrir Configurações e exportar antes de recarregar.
- [ ] Repetir em períodos de uso diferentes, anotando se a conexão é móvel ou fixa.
- [ ] Conferir no Firebase Console → Realtime Database → Uso os downloads, armazenamento, conexões e carga; observar os últimos 30 dias.
- [ ] Em duas sessões autorizadas de homologação, registrar horário de uma alteração de teste e quando ela aparece na segunda sessão. Repetir com alteração direta na planilha, sem apagar registros.
- [ ] Confirmar que formulário não salvo continua preservado durante atualização.
- [ ] Se houver backend pendente/incompatível, resolver a implantação compatível antes de avaliar a eficiência da sincronização nova. Este patch não implanta Apps Script ou Workers.
- [ ] Comparar duração das requisições com o tempo entre conferências: espera pelo próximo ciclo não significa requisição lenta.
- [ ] Decidir otimização após coleta: notificações de revisão, redução de payloads ou armazenamento de imagens separado; migração de banco não é requisito prévio.

## Verificação realizada
49 testes automatizados aprovados. Painel inspecionado no navegador com API sintética e 6.000 vendedores; contagem de chamadas, falha simulada e botão de tamanho verificados. Nenhum acesso aos serviços reais nesse ensaio. Testes manuais acima permanecem necessários.

## Reversão e publicação
Base anterior: `2a2eb5dff6acc17e7d6617c7f9a97f60bf36b6b0`.
Backup: `backup/main-2026-11-19-antes-diagnostico`.
Somente o main de Ofertas-Dos-Vendedores-Teste recebe este patch. Oficial permanece inalterado e depende de validação e autorização posteriores.
