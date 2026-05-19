
# Plano: Central de Demandas Financeiras (BPO + Asana)

Evolução **incremental** do módulo existente. Nada do que já funciona é refeito ou quebrado: autenticação, RLS atual, layout, sidebar, hooks `useFinancialDemands`/`useDemand`/`useCreateDemand`, páginas `NewDemandPage`/`DemandDetailPage` permanecem. A entrega é dividida em **3 fases** entregues sequencialmente, cada uma testável em produção.

---

## Decisões aprovadas

- **Asana auth**: PAT por tenant, armazenado como secret server-side (`ASANA_PAT`, `ASANA_WORKSPACE_GID`, `ASANA_PROJECT_GID`, `ASANA_DEFAULT_SECTION_GID`).
- **Multitenant**: adicionar `company_id` (FK `company_profiles`) em `financial_demands`. Sem `tenant_id`.
- **Sync Asana**: híbrida — gravação imediata no Supabase → invoke `create-asana-task` em background → cron a cada 1min reprocessa pendentes/erros → botão manual de reenvio.
- **Design**: Liquid Glass Premium (já estabelecido em mem), Inter + JetBrains Mono, sem refazer sidebar.

---

## FASE 1 — Schema + Tela "Demandas Recebidas" operacional

### 1.1 Migração de banco

Tabela `financial_demands` — adicionar colunas (nullable, sem quebrar dados existentes):

- `company_id uuid` (FK lógica para `company_profiles.id`)
- `demand_code text` (gerado por trigger: `DM-YYYYMM-####`)
- `sla_due_at timestamptz`
- `asana_task_id text`
- `asana_task_url text`
- `asana_sync_status text default 'not_synced'` — valores: `not_synced`, `pending_sync`, `syncing`, `synced`, `error`, `disabled`
- `asana_sync_error text`
- `asana_last_synced_at timestamptz`

Índices: `(asana_sync_status)`, `(company_id, status)`, `(status, priority, due_date)`.

Nova tabela `asana_integration_settings` (singleton por instância — sem tenant_id por escolha):
- `id`, `is_enabled bool`, `workspace_gid text`, `project_gid text`, `default_section_gid text`, `default_assignee_gid text`, `status_mapping jsonb`, `priority_mapping jsonb`, `created_at`, `updated_at`.
- RLS: SELECT/UPDATE apenas admin via `has_role(auth.uid(),'admin')`.

Nova tabela `asana_sync_logs`:
- `id`, `demand_id`, `action text` (create/update/retry), `status text`, `request_payload jsonb`, `response_payload jsonb`, `error_message text`, `created_at`.
- RLS: apenas `is_internal()` (admin/manager).

RLS `financial_demands` — manter políticas existentes. Adicionar regra: cliente só vê demandas onde `company_id` é igual ao `company_id` do seu `company_profiles` OU `created_by = auth.uid()` (mantém retrocompatibilidade para demandas antigas sem company_id).

Trigger `set_demand_code` BEFORE INSERT para gerar `demand_code` se nulo.

### 1.2 Reformulação da tela `DemandsListPage` ("Demandas Recebidas")

Substituir a tabela atual mantendo o mesmo arquivo `src/pages/demands/DemandsListPage.tsx`. Estrutura nova:

**Header executivo** (GlassCard):
- Título "Demandas Recebidas" + subtítulo dinâmico ("12 abertas · 3 urgentes · 1 vencida").
- Botões: `Nova demanda` (existente), `Sincronizar Asana` (Fase 2), `Exportar CSV`.
- Chip "Última sync: há X min" + status do Asana (verde/amarelo/vermelho).

**Grid de KPIs clicáveis** (10 cards Liquid Glass mini, grid responsivo 2/3/5 cols):
1. Recebidas hoje
2. Em aberto
3. Urgentes
4. Aguardando cliente
5. Aguardando aprovação
6. Vencidas
7. Vencendo em 3 dias
8. Sync Asana OK
9. Erro de sync
10. Tempo médio de resposta (h)

Clicar aplica filtro correspondente. Hook novo: `useDemandsInbox` (deriva tudo via 1 query com `select=*, count(exact)`).

**Barra de filtros avançados** (expansível): busca, status, prioridade, tipo, responsável, vencimento (range), empresa, sync_status.

**Toggle de visualização**: `Tabela | Cards | Kanban` (persistido em localStorage). Fase 1 entrega **Tabela + Cards**; Kanban fica para Fase 3.

**Tabela enriquecida** com colunas: Código, Cliente/Empresa, Tipo, Título, Valor, Vencimento, SLA badge (no prazo/atrasado), Prioridade, Status, Responsável, Asana chip (synced/pending/error + link externo), Ações rápidas (DropdownMenu: alterar status, atribuir, marcar urgente, finalizar, reenviar Asana, copiar link Asana).

**Empty/Loading/Error** — manter o padrão de resiliência já em mem.

### 1.3 Hooks novos
- `useDemandsInbox(filters)` — substitui `useFinancialDemands` na tela Recebidas (mantém o hook antigo intacto para retro-compat).
- `useDemandQuickActions()` — mutations: `changeStatus`, `assignTo`, `markUrgent`, `finalize`.

---

## FASE 2 — Integração Asana resiliente

### 2.1 Secrets necessários
Solicitar via `add_secret`: `ASANA_PAT`, `ASANA_WORKSPACE_GID`, `ASANA_PROJECT_GID`, `ASANA_DEFAULT_SECTION_GID`.

### 2.2 Edge Functions

**`asana-test-connection`** — GET `/users/me` no Asana. Retorna `{ok, user, workspaces}`. Apenas admin.

**`asana-create-task`** — body `{demand_id}`. Fluxo:
1. `getUser(token)` + verificar role internal ou que a demanda pertence ao user.
2. Carrega demanda + `asana_integration_settings`.
3. Marca `asana_sync_status='syncing'`.
4. POST `https://app.asana.com/api/1.0/tasks` com título `[Empresa] - [Tipo] - [Título]`, descrição estruturada (cliente, valor, vencimento, prioridade, descrição, link interno `/demands/{id}`), `projects:[project_gid]`, `memberships:[{project, section}]`.
5. Sucesso → grava `asana_task_id`, `asana_task_url`, `status='synced'`, `last_synced_at=now()`. Log em `asana_sync_logs`.
6. Erro → `status='error'`, `asana_sync_error=...`. Log. **Nunca lança exceção para o frontend** — sempre 200 com `{ok:false,error}`.

**`asana-update-task`** — body `{demand_id}`. PUT no Asana atualizando seção/status conforme `status_mapping`. Mesma resiliência.

**`asana-retry-sync`** — body `{demand_id?}`. Se id fornecido, retenta 1; se ausente, busca todas com `asana_sync_status in ('pending_sync','error')` e processa em batch (limit 50).

### 2.3 Trigger de criação
Após `useCreateDemand` resolver, chamar `supabase.functions.invoke('asana-create-task', {body:{demand_id}})` em **fire-and-forget** (não bloqueia a UI). Demanda já está marcada `pending_sync` por default.

Alteração mínima em `useCreateDemand`: setar `asana_sync_status='pending_sync'` no INSERT, depois invoke async sem await crítico.

### 2.4 Cron de reprocessamento
SQL via tool `insert` (pg_cron + pg_net) — job a cada 1 minuto chamando `asana-retry-sync` sem body (processa fila). Header `X-CRON-SECRET` igual ao padrão já usado no `scheduled-sync`.

### 2.5 UI integrada na tela Recebidas
- Chip Asana na tabela com tooltip e link `target=_blank`.
- Ação rápida "Reenviar para Asana" invoca `asana-create-task`.
- Header chip "Última sync" lê max(`asana_last_synced_at`).
- KPI "Erro de sync" abre lista filtrada.

### 2.6 Atualização de status → Asana
No `useDemandQuickActions.changeStatus`, após UPDATE bem-sucedido, invoke `asana-update-task` fire-and-forget.

---

## FASE 3 — Kanban, detalhe enriquecido, configurações

### 3.1 Visualização Kanban
Componente `DemandsKanbanBoard.tsx` — colunas por status agrupado: Novas (recebida/em_analise) | Pendentes (aguardando_info/aprovacao) | Em execução (aprovada/em_execucao/pagamento_agendado) | Concluídas (finalizada). Drag-and-drop com `@dnd-kit` (já no projeto; senão adicionar). Drop muda status.

### 3.2 Detalhe da demanda (drawer lateral)
Evoluir `DemandDetailPage` com seções colapsáveis (default fechado para audit, conforme regra de mem):
- Header: código, título, badges status/prioridade, chip Asana com link.
- Tabs: Visão geral · Documentos · Comentários · Checklist · Timeline · **Logs Asana** (apenas internal).
- Botão "Reenviar Asana" no header quando `status='error'`.

### 3.3 Página de configurações Asana
Nova rota `/demands/settings/asana` (admin only). Form com:
- Toggle ativar integração.
- Inputs Workspace GID / Project GID / Section GID / Default assignee (apenas leitura se vier de env; editáveis se quiser sobrescrever).
- Mapeamentos status→section e priority→tag (JSON editor).
- Botões "Testar conexão" e "Criar tarefa de teste".
- Tabela de últimos 50 logs.

### 3.4 Refinamentos finais
- Mobile: tabela vira lista de cards <1024px.
- Performance: paginação 50 + infinite scroll.
- Testes manuais checklist (RLS cliente vs internal, sync OK, sync erro, retry cron, mudança de status).

---

## Detalhes técnicos importantes

- **RLS**: `asana_integration_settings` e `asana_sync_logs` restritos a `is_internal()`. Clientes nunca veem logs nem error messages técnicos.
- **CORS**: todas edge functions seguem padrão `getUser(token)` + full Supabase CORS (regra de mem).
- **Resiliência**: nenhum erro Asana propaga para a UI do cliente. Sempre log + chip visual + retry disponível.
- **Idempotência**: `asana-create-task` checa se `asana_task_id` já existe; se sim, vira update.
- **Monetary**: `amount` continua NUMERIC(14,2) com trigger existente.
- **Não tocado**: `useFinancialDemands` (mantido para retro-compat), `NewDemandPage`, sidebar, demais módulos.

---

## Entrega proposta

Após aprovação, implemento **Fase 1 completa** primeiro (sem Asana), valido a tela operacional, e só então sigo para Fase 2 (que exige você adicionar os secrets do Asana). Fase 3 é incremental sobre o que estiver estável.

Confirma este plano para eu iniciar pela Fase 1?
