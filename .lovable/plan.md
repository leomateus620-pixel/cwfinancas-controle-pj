Do I know what the issue is? Sim.

A falha atual não é mais apenas “Asana fora do ar”. A requisição do navegador está morrendo como `Failed to fetch` porque o preflight/CORS das funções Asana não permite todos os headers que o cliente está enviando, especialmente `x-supabase-client-platform`. Por isso a função nem aparece nos logs de execução quando clicada pela interface. Além disso, encontrei dois bloqueios funcionais depois dessa camada:

- A integração Asana está salva como desativada (`is_enabled = false`), então mesmo uma chamada direta autenticada retorna `disabled: true` e não cria tarefa.
- O botão “Sincronizar Asana” em lote exige perfil interno, mas os usuários atuais estão apenas como `user`; isso faz a chamada cair em “Sem permissão” quando a rede/CORS passa.

Plano de correção:

1. Corrigir CORS das funções Asana
   - Atualizar `asana-create-task`, `asana-update-task`, `asana-retry-sync` e `asana-test-connection` para usar headers CORS completos.
   - Incluir `x-supabase-client-platform` e manter `authorization`, `apikey`, `content-type`, `x-client-info`, `x-cron-secret`.
   - Garantir que todas as respostas, inclusive erros e `OPTIONS`, devolvam os mesmos headers.

2. Trocar o helper frontend Asana para chamada direta robusta
   - Refatorar `src/lib/asana/invokeAsana.ts` para usar `fetch` direto em `/functions/v1/<function>`.
   - Buscar a sessão com `supabase.auth.getSession()` e enviar manualmente:
     - `Authorization: Bearer <access_token>`
     - `apikey: VITE_SUPABASE_PUBLISHABLE_KEY`
     - `Content-Type: application/json`
   - Remover dependência de `supabase.functions.invoke()` somente para Asana, evitando o erro genérico “Failed to send a request to the Edge Function”.
   - Manter retorno padronizado `{ ok, data | error, detail }` com mensagem amigável.

3. Ajustar permissões da sincronização em lote
   - `asana-retry-sync` sempre validará o usuário autenticado quando for chamada pela interface.
   - Usuário comum poderá sincronizar apenas demandas criadas por ele.
   - Admin/manager poderá sincronizar todas as demandas pendentes/erro.
   - Chamadas internas com `x-cron-secret` continuam funcionando para rotina automática.

4. Corrigir subchamadas internas entre funções
   - Adicionar/garantir `Authorization: Bearer <SERVICE_ROLE_KEY>` também na delegação de `asana-update-task` para `asana-create-task`.
   - Manter o padrão serviço interno + validação de usuário quando a chamada vem do frontend.

5. Reativar a integração Asana quando houver configuração segura
   - Como os segredos `ASANA_PAT`, `ASANA_PROJECT_GID` e `ASANA_DEFAULT_SECTION_GID` existem, atualizar o registro de configurações para `is_enabled = true`.
   - Não expor token na interface.

6. Melhorar feedback visual sem poluir a operação
   - Se a falha for de configuração/permissão, mostrar mensagem amigável e curta.
   - Se houver detalhe técnico, manter em `detail` para uso interno, sem toast vermelho genérico para o cliente.
   - O botão “Sincronizar Asana” deve mostrar contadores reais e atualizar a lista após sucesso.

7. Validar ponta a ponta após implementar
   - Reimplantar as 4 funções Asana.
   - Testar `asana-retry-sync` direto pelo backend.
   - Testar criação de tarefa para uma demanda pendente.
   - Verificar se `financial_demands.asana_task_id`, `asana_task_url`, `asana_sync_status = synced` e `asana_sync_logs` foram preenchidos.
   - Confirmar que o navegador não mostra mais `Failed to fetch`/`Failed to send a request to the Edge Function`.

<presentation-actions>
  <presentation-open-history>View History</presentation-open-history>
  <presentation-link url="https://docs.lovable.dev/tips-tricks/troubleshooting">Troubleshooting docs</presentation-link>
</presentation-actions>