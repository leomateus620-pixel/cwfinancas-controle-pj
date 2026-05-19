
# Fase 2 + Fase 3 — Central de Demandas Financeiras

Entrega única, incremental sobre o que a Fase 1 já entregou. Nada existente é refeito: `useFinancialDemands`, `useDemand`, `useCreateDemand`, `NewDemandPage`, `DemandDetailPage`, `DemandsListPage`, sidebar, RLS, autenticação e tabelas permanecem.

---

## 0. Pré-requisito — secrets do Asana

Antes de qualquer código de integração, solicito via `add_secret`:
`ASANA_PAT`, `ASANA_WORKSPACE_GID`, `ASANA_PROJECT_GID`, `ASANA_DEFAULT_SECTION_GID`.

Se algum estiver ausente em runtime, a Edge Function retorna `{ok:false, error}` com mensagem clara — nunca quebra a criação da demanda.

---

## 1. Edge Functions (Fase 2)

Todas em `supabase/functions/<nome>/index.ts`, com CORS completo, `getUser(token)`, validação Zod, sempre HTTP 200, logs em `asana_sync_logs`. Nunca expõem o PAT.

### 1.1 `asana-test-connection`
- Admin/internal only.
- `GET https://app.asana.com/api/1.0/users/me` com `Authorization: Bearer ${ASANA_PAT}`.
- Retorna `{ok, user, workspaces}` ou `{ok:false, error}`.

### 1.2 `asana-create-task`
Body: `{demand_id}`.
- Valida user + permissão (internal OU dono via `created_by`/`company_id`).
- Carrega demanda + `asana_integration_settings`. Se `is_enabled=false`, marca `disabled` e retorna.
- **Idempotência:** se `asana_task_id` já existe → invoca update e retorna `{ok:true, task_id, task_url, idempotent:true}`.
- Marca `asana_sync_status='syncing'`.
- POST `/tasks` com `name`, `notes` (markdown estruturado: código, empresa, tipo, valor, vencimento, prioridade, status, descrição, link interno `${origin}/demands/${id}`, documentos), `projects:[ASANA_PROJECT_GID]`, `memberships:[{project, section}]`, `due_on`, `assignee` quando aplicável.
- Sucesso: grava `asana_task_id`, `asana_task_url`, `status='synced'`, `error=null`, `last_synced_at=now()`. Log `action='create', status='success'`.
- Erro: `status='error'`, `error=<msg curta>`, log `status='error'` com payload e response.

### 1.3 `asana-update-task`
Body: `{demand_id}`.
- Internal only.
- Se sem `asana_task_id` → delega para create.
- PUT `/tasks/{gid}` atualizando `name`, `notes`, `due_on`, `assignee` se houver. Move seção via `addProject`/`memberships` conforme `status_mapping` (mapeamento padrão embutido conforme tabela do briefing).
- Mesma resiliência e logging.

### 1.4 `asana-retry-sync`
Body opcional: `{demand_id?}`.
- Header `X-CRON-SECRET` permite execução não-autenticada para o cron; chamada via UI exige auth + internal.
- Sem id: SELECT demandas com `asana_sync_status IN ('pending_sync','error')` LIMIT 50, ordem por `updated_at`.
- Para cada: se sem task_id → create, senão → update.
- Retorna `{ok, processed, success, errors}`.

### 1.5 Cron (via `supabase--insert`, não migration)
`pg_cron` + `pg_net`, schedule `* * * * *`, POST para `asana-retry-sync` com header `X-CRON-SECRET`. Mesmo padrão do `scheduled-sync` já existente.

---

## 2. Frontend — integração Asana na lista (Fase 2 UI)

### 2.1 `useCreateDemand` — alteração mínima
- INSERT com `asana_sync_status='pending_sync'`.
- Após sucesso, `supabase.functions.invoke('asana-create-task', {body:{demand_id}})` fire-and-forget (sem `await` bloqueante). Toast de sucesso da demanda aparece imediatamente.

### 2.2 `useDemandQuickActions` — extensão
- Após `changeStatus`, `markUrgent`, `assignTo`, `finalize` resolverem: invoca `asana-update-task` fire-and-forget e invalida query.
- Nova mutation `retrySync(demandId)` → invoca `asana-create-task` (que delega para update se já existir task).
- Nova mutation `retryAll()` → invoca `asana-retry-sync` sem body.

### 2.3 `AsanaChip` (componente novo `src/components/demands/AsanaChip.tsx`)
- Variantes: `synced` (verde), `syncing` (azul + spin), `pending_sync` (âmbar), `error` (vermelho), `disabled` (cinza), `not_synced` (neutro).
- Tooltip: última sync, task_id, link externo. Mensagem de erro **apenas se `isInternal`**.
- Botão externo abre `asana_task_url` em nova aba.

### 2.4 Header da `DemandsListPage`
- Botão `Sincronizar Asana` → `retryAll()`.
- Chip global "Última sync: há X min" lendo `max(asana_last_synced_at)`.
- Status integração: verde/âmbar/vermelho conforme contagem de erros vs sync OK.

### 2.5 Tabela e Cards
- Coluna/linha Asana usando `AsanaChip`.
- Ação rápida "Reenviar para Asana" + "Copiar link Asana".
- KPI "Erro de sync" filtra `asana_sync_status='error'`.

---

## 3. Kanban (Fase 3)

### 3.1 `DemandsKanbanBoard.tsx`
- 5 colunas: Novas, Pendentes, Em execução, Concluídas, Canceladas/Reprovadas (agrupamento exato do briefing).
- `@dnd-kit/core` + `@dnd-kit/sortable` (instalo se ausente).
- Card mostra: código, título, empresa, valor (mono tabular-nums), vencimento, prioridade, SLA, responsável, AsanaChip, ícone do tipo.
- Drop entre colunas → escolhe primeiro status do grupo destino → `changeStatus()` otimista → revalida em erro.
- Respeita filtros e busca de `useDemandsInbox`.

### 3.2 Toggle Tabela | Cards | Kanban
- Já existe Tabela/Cards. Adiciono botão Kanban no mesmo toggle, persistido em localStorage (`demands:view`).

---

## 4. Detalhe enriquecido (Fase 3)

Evolução de `DemandDetailPage` (mesmo arquivo, sem quebrar rotas):

### 4.1 Header
- Adiciono: código, SLA badge, `AsanaChip`, botões "Abrir no Asana", "Reenviar Asana" (quando `error`), além dos atuais.

### 4.2 Tabs (Radix `Tabs`)
Substituo grid atual por: `Visão geral | Documentos | Comentários | Checklist | Timeline | Logs Asana`.
- Conteúdo atual da página é redistribuído nas 5 primeiras (mantendo componentes `DemandComments`, `ApprovalDecisionCard`, etc.).
- **Logs Asana**: nova tab condicionada a `isInternal`. Hook novo `useAsanaSyncLogs(demandId)` lê últimos 50 com paginação leve. Cada item: action, status, error_message, created_at, request/response em `<Collapsible>` (fechado por default — regra de mem).

---

## 5. Configurações Asana (Fase 3)

### 5.1 Rota `/demands/settings/asana` — admin only
Página nova `src/pages/demands/AsanaSettingsPage.tsx`. Guarded por `useUserRole().isAdmin` (redirect para `/demands` se não admin). Registrada em `App.tsx`.

### 5.2 Form
- Toggle `is_enabled`.
- Inputs: `workspace_gid`, `project_gid`, `default_section_gid`, `default_assignee_gid`.
- JSON editors (Textarea + validação) para `status_mapping` e `priority_mapping`.
- Nota informativa: "Token PAT gerenciado em variáveis seguras do servidor" (sem expor).
- Botão "Testar conexão" → `asana-test-connection` → exibe user + workspaces.
- Botão "Criar tarefa de teste" → cria demanda dummy ou usa endpoint dedicado? **Decisão:** sem criar demanda — chama variante de teste do `asana-create-task` com flag `dry_run:true` que cria task com nome `[TESTE] Conexão Lovable` e retorna link, sem persistir vínculo.
- Tabela últimos 50 logs (sem filtro de demand_id).

### 5.3 Link no Sidebar
**Não toco na sidebar.** Adiciono apenas link "Configurações Asana" no menu de ações do header da `DemandsListPage` (DropdownMenu admin-only).

---

## 6. RLS e segurança

Políticas atuais já cobrem o necessário (`asana_integration_settings` admin-only, `asana_sync_logs` internal-only, `financial_demands` com `company_id` opcional). Sem migrations adicionais.

Garantias no código:
- `AsanaChip` esconde `error_message` para clientes.
- Tab "Logs Asana" só renderiza se `isInternal`.
- Comentários internos já filtrados por `visibility`.
- Edge Functions revalidam permissão antes de operar.

---

## 7. Responsividade e performance

- `DemandsListPage`: filtros viram `Sheet` lateral em `<lg`. Tabela vira lista de cards `<lg`. Kanban com `overflow-x-auto` + snap.
- `DemandDetailPage`: tabs ficam scrolláveis horizontalmente em mobile; header empilha.
- Paginação 50 itens em `useDemandsInbox` (já tem base; adiciono `range()` + botão "Carregar mais").
- Logs Asana lazy (só fetch quando tab ativa).
- Otimista em drag Kanban e quick actions.

---

## 8. Arquivos a criar / alterar

**Criar:**
- `supabase/functions/asana-test-connection/index.ts`
- `supabase/functions/asana-create-task/index.ts`
- `supabase/functions/asana-update-task/index.ts`
- `supabase/functions/asana-retry-sync/index.ts`
- `src/components/demands/AsanaChip.tsx`
- `src/components/demands/DemandsKanbanBoard.tsx`
- `src/hooks/useAsanaSyncLogs.ts`
- `src/hooks/useAsanaSettings.ts`
- `src/pages/demands/AsanaSettingsPage.tsx`

**Alterar (cirurgicamente):**
- `src/hooks/useCreateDemand.ts` — pending_sync + invoke fire-and-forget.
- `src/hooks/useDemandQuickActions.ts` — sync hooks + retry mutations.
- `src/hooks/useDemandsInbox.ts` — paginação 50.
- `src/pages/demands/DemandsListPage.tsx` — toggle Kanban, header com sync global, Sheet de filtros mobile, ações Asana, link admin.
- `src/pages/demands/DemandDetailPage.tsx` — tabs + header com Asana + tab Logs.
- `src/App.tsx` — rota `/demands/settings/asana`.

**Cron (via `supabase--insert`, não migration):** schedule `asana-retry-sync`.

---

## 9. Sequência de execução

1. Solicitar secrets Asana (`add_secret`).
2. Aguardar confirmação do usuário.
3. Criar as 4 Edge Functions + deploy.
4. Adicionar `@dnd-kit/core` e `@dnd-kit/sortable` (se ausentes).
5. Criar componentes/hooks novos (AsanaChip, Kanban, logs, settings).
6. Alterar hooks existentes (create, quickActions, inbox).
7. Refatorar `DemandsListPage` (toggle Kanban, sync global, mobile sheet).
8. Refatorar `DemandDetailPage` (tabs + logs).
9. Criar `AsanaSettingsPage` + rota.
10. Agendar cron via `supabase--insert`.
11. Testar `asana-test-connection` via `curl_edge_functions`.
12. Validar fluxo end-to-end com `read_query` (verificar `asana_sync_logs`).

Confirma para eu solicitar os secrets e iniciar?
