# Correção da Sincronização Asana — Causa raiz + endurecimento

## Diagnóstico

Após inspecionar `supabase/functions/asana-*` e os pontos de chamada do frontend, identifiquei três causas plausíveis para o erro **"Failed to send a request to the Edge Function"** + falhas silenciosas:

1. **Falta de `verify_jwt = false` explícito** para as 4 funções `asana-*` em `supabase/config.toml`. Embora o default seja `false`, fixar o valor remove ambiguidade e elimina rejeições no gateway (que retornam 401 sem CORS, gerando exatamente esse erro no browser).
2. **`asana-retry-sync` chama internamente** `asana-create-task` / `asana-update-task` enviando apenas `x-cron-secret` + `apikey`, sem `Authorization`. Se o gateway exigir JWT, o sub-chamado falha silenciosamente (`success=0, errors=N`). Mesmo bug em `asana-create-task` quando delega para `asana-update-task`.
3. **Frontend sem helper centralizado** — cada botão trata erros de forma diferente, alguns deixam `FunctionsFetchError` borbulhar como toast técnico.

Os nomes das funções já estão consistentes (`asana-create-task`, `asana-update-task`, `asana-retry-sync`, `asana-test-connection`) e os CORS headers das funções estão corretos.

## Mudanças

### 1. `supabase/config.toml`
Adicionar blocos para as 4 funções:
```toml
[functions.asana-create-task]
verify_jwt = false
[functions.asana-update-task]
verify_jwt = false
[functions.asana-retry-sync]
verify_jwt = false
[functions.asana-test-connection]
verify_jwt = false
```
Isso garante que o gateway nunca rejeite chamadas antes do código da função rodar. A validação de sessão continua sendo feita in-code via `auth.getUser(token)`.

### 2. Edge functions — autenticação interna robusta
- Em `asana-retry-sync` e `asana-create-task`, o helper interno que chama outra função passa a enviar **também** `Authorization: Bearer ${SERVICE_ROLE_KEY}` (além de `x-cron-secret` + `apikey`). Isso garante que mesmo com `verify_jwt=true` no futuro, o internal call passe.
- Tornar `x-cron-secret` opcional quando vier service-role JWT (já bypassa via `isCron`).
- Padronizar mensagens de erro retornadas: usuário comum recebe "Não foi possível sincronizar agora", admin/internal recebe detalhe técnico (campo `detail` separado).
- Adicionar guarda anti-duplicidade: em `asana-create-task`, antes do POST ao Asana, re-checar `asana_task_id` com `for update` lógico (segundo SELECT) e abortar se já existir.

### 3. Frontend — helper centralizado
Criar `src/lib/asana/invokeAsana.ts`:
```ts
export async function invokeAsana<T>(fn: string, body: Record<string, unknown> = {}):
  Promise<{ ok: true; data: T } | { ok: false; error: string; detail?: string }>
```
- Usa `supabase.functions.invoke(fn, { body })`.
- Captura `FunctionsFetchError`, `FunctionsHttpError` e respostas `{ ok: false }`.
- Retorna sempre um objeto estruturado; nunca lança.
- Para `error: string`, mapeia mensagens técnicas para textos amigáveis.

Refatorar para usar o helper:
- `src/hooks/useDemandQuickActions.ts` (`retryAsana`, `retryAllAsana`, fire-and-forget `asana-update-task` em `changeStatus`)
- `src/hooks/useDemand.ts` (fire-and-forget pós-criação)
- `src/components/demands/detail/DemandAsanaActions.tsx`

### 4. Botão "Sincronizar Asana" (header)
Verificar em `DemandsListPage.tsx` (linha 216) que o `onClick` chama `retryAllAsana.mutate()` da hook, com estado de loading no botão (`disabled={retryAllAsana.isPending}`) e ícone giratório. Toasts: sucesso resume `{success} OK · {errors} erro(s)`, falha mostra mensagem amigável.

### 5. UX por demanda
`DemandAsanaActions.tsx`: o botão único decide via `taskId ? update : create` (já implementado). Acrescentar:
- Estado visual `syncing` enquanto a request roda.
- Toasts: "Tarefa criada no Asana" / "Tarefa atualizada no Asana" / "Não foi possível sincronizar agora".
- Recuperação de erro: ao final, invalida `demand`, `asana-sync-logs` e `demands-inbox`.

### 6. Criação automática
`useDemand.ts`: depois do INSERT, dispara `invokeAsana("asana-create-task", { demand_id })` sem await bloqueante (`void invokeAsana(...).then(...)`), com `.catch` nunca propagando. Sucesso ou falha o demand já está salvo; o chip reflete o estado.

## Arquivos afetados

**Editados:**
- `supabase/config.toml`
- `supabase/functions/asana-retry-sync/index.ts`
- `supabase/functions/asana-create-task/index.ts`
- `supabase/functions/asana-update-task/index.ts` (apenas mensagens de erro padronizadas)
- `src/hooks/useDemandQuickActions.ts`
- `src/hooks/useDemand.ts`
- `src/components/demands/detail/DemandAsanaActions.tsx`
- `src/pages/demands/DemandsListPage.tsx` (loading state no botão header)

**Criados:**
- `src/lib/asana/invokeAsana.ts`

## Validação pós-deploy

1. Header → "Sincronizar Asana" → toast com contadores.
2. Criar demanda nova → tarefa aparece em `ASANA_PROJECT_GID=1201221862107065` / `SECTION=1201221862107066`; `asana_task_id` e `asana_task_url` salvos; chip vira `synced`.
3. Demanda existente sem task → botão "Sincronizar agora" cria.
4. Demanda já sincronizada → botão atualiza (idempotente, não duplica).
5. Logs em `asana_sync_logs` só visíveis para admin/manager (RLS já existente).
6. Nenhum toast técnico "Failed to send a request to the Edge Function".
