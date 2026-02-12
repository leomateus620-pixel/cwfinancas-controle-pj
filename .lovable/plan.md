

# Correcao Definitiva: Sync Infinito + Job Control

## Diagnostico

O erro de console mostra `FunctionsFetchError: Failed to send a request to the Edge Function` para `sheets-sync-all-tabs`. Isso significa que a chamada nem chega ao servidor -- a funcao pode ter falhado no deploy, ou o request expirou antes de completar. Como resultado:

1. O `google_sheet_sync_logs` fica com `status = 'running'` para sempre (nunca recebe update de `completed_at`)
2. A UI mostra "Executando" indefinidamente baseado nesse log
3. Nao existe mecanismo de timeout ou heartbeat para detectar jobs travados
4. Nao existe prevencao de concorrencia (clicar varias vezes cria multiplos logs "running")

## Solucao em 5 Blocos

### Bloco 1 -- Tabela `sheet_sync_jobs` (migracao SQL)

Criar tabela dedicada para controle de jobs com heartbeat e timeout:

```text
sheet_sync_jobs
- id uuid PK
- user_id uuid NOT NULL
- connection_id uuid NOT NULL
- mode text NOT NULL (ALL_TABS / SINGLE_TAB / DRE_ONLY)
- status text NOT NULL DEFAULT 'queued'
  (queued | running | success | failed | canceled | timeout)
- started_at timestamptz
- finished_at timestamptz
- heartbeat_at timestamptz
- progress jsonb DEFAULT '{}'
  (tabs_total, tabs_done, rows_read, rows_imported, current_tab)
- error_message text
- error_step text
- request_id text
- created_at timestamptz DEFAULT now()
```

RLS: `user_id = auth.uid()` para SELECT. INSERT/UPDATE/DELETE somente via service role (edge functions).

### Bloco 2 -- Edge Function `sheets-sync-all-tabs` (reescrita com job control)

Reescrever a funcao com controle completo:

**Inicio:**
1. Verificar se existe job `running` para o mesmo `user_id + connection_id`
   - Se `heartbeat_at` < 2 minutos atras: retornar `{ error: "already_running" }` (HTTP 409)
   - Se `heartbeat_at` > 2 minutos atras: marcar como `timeout` e prosseguir
2. Criar novo job com `status = 'running'`, `started_at = now()`, `heartbeat_at = now()`

**Execucao (try/catch/finally):**
- Antes de cada etapa critica, atualizar `heartbeat_at` e `progress`:
  - `step=auth` -> heartbeat
  - `step=listTabs` -> heartbeat + `progress.tabs_total`
  - `step=classifyTabs` -> heartbeat
  - Para cada aba: `step=readTab(tabName)` -> heartbeat + `progress.tabs_done++`
  - `step=upsertRows` -> heartbeat + `progress.rows_imported`
- Implementar timeout interno: verificar `Date.now() - startTime > 110_000` (110s para dar margem antes do timeout de 150s do Supabase) e se exceder, salvar progresso parcial e marcar `status = 'timeout'`

**Erro (catch):**
- Salvar `status = 'failed'`, `error_message`, `error_step`, `finished_at`

**Fim (finally):**
- Se status ainda for `running`, atualizar para `success` com `finished_at`
- Garantir que o `google_sheet_connections.sync_status` tambem e atualizado

**Logs detalhados** em cada etapa para facilitar debug futuro.

### Bloco 3 -- Edge Function `google-sheets-sync` (mesma protecao)

Aplicar o mesmo pattern de job control na funcao de sync de aba unica:
- Criar job antes de processar
- Heartbeat durante processamento
- try/catch/finally garantindo finalizacao
- Prevencao de concorrencia

### Bloco 4 -- Hook `useSyncStatus` + novo `useSyncJobs` 

**Novo hook `useSyncJobs`:**
- Query em `sheet_sync_jobs` para o `connection_id` ativo
- Polling a cada 3 segundos SOMENTE quando existe job `running` ou `queued`
- Para de fazer polling quando status e `success/failed/timeout/canceled`
- Detecta job travado: se `heartbeat_at` > 5 minutos, mostra "Sync travou" na UI

**Atualizar `useGoogleSheets`:**
- Apos chamar `syncAllTabs` ou `syncData`, capturar erro de rede (`FunctionsFetchError`) e:
  - Mostrar toast informativo ("Sincronizacao iniciada, acompanhe o progresso")
  - Iniciar polling do job
  - NAO travar a UI esperando resposta da function

### Bloco 5 -- UI: GoogleSheetsPage + SyncHistoryTable

**GoogleSheetsPage:**
- Botao "Sincronizar" desabilitado quando existe job `running` para aquela conexao
- Se job `running` existe, mostrar indicador de progresso (tabs_done/tabs_total, rows_imported)
- Se job `timeout` ou `failed`, mostrar mensagem com botao "Tentar novamente"
- Badge visual no card da conexao mostrando status do ultimo job

**SyncHistoryTable:**
- Adicionar coluna "Progresso" mostrando dados do `progress` jsonb
- Jobs com status `timeout` mostram icone diferente de `error`
- Adicionar status `timeout` e `canceled` ao mapa de cores

**Prevencao de cliques multiplos:**
- O botao "Sincronizar" verifica se existe job ativo antes de disparar
- Se usuario clicar com job ativo, mostrar toast "Sincronizacao ja em andamento"

## Arquivos Criados/Modificados

| Arquivo | Acao |
|---|---|
| Migracao SQL | Criar tabela `sheet_sync_jobs` com RLS |
| `supabase/functions/sheets-sync-all-tabs/index.ts` | Reescrever com job control |
| `supabase/functions/google-sheets-sync/index.ts` | Adicionar job control |
| `supabase/config.toml` | Sem alteracao (funcoes ja registradas) |
| `src/hooks/useSyncJobs.ts` | Criar (polling de jobs) |
| `src/hooks/useGoogleSheets.ts` | Tratar erro de rede, integrar com jobs |
| `src/pages/GoogleSheetsPage.tsx` | Mostrar progresso/status do job |
| `src/components/sheets/SyncHistoryTable.tsx` | Adicionar status timeout/canceled |

## Detalhes Tecnicos

- O timeout interno de 110s garante que a funcao finaliza antes do limite de 150s do Supabase Edge Functions
- O heartbeat a cada etapa critica (nao a cada linha) minimiza queries extras ao banco
- A verificacao de concorrencia usa `heartbeat_at` como indicador de "vida" -- se o heartbeat parou ha mais de 2 minutos, o job e considerado morto
- O polling do frontend usa `refetchInterval` do React Query, ativado condicionalmente
- O `FunctionsFetchError` capturado no frontend permite que a UI nao trave mesmo quando o request falha na rede
- Jobs antigos com status `running` sem heartbeat recente sao automaticamente marcados como `timeout` quando um novo sync e iniciado

