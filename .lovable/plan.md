# Finalização da Central de Demandas Financeiras

Entrega única cobrindo detalhe enriquecido, cron Asana, paginação, filtros mobile e validação E2E. Mantém tudo que já foi construído (RLS, hooks, layout, integração Asana, Kanban).

## 1. Detalhe da demanda (`DemandDetailPage`)

Refatorar a página existente mantendo a rota atual. Cabeçalho Liquid Glass com:
- Código, título, empresa, tipo, badges (status, prioridade, SLA), `AsanaChip`
- Ações: Abrir no Asana, Reenviar Asana, Sincronizar agora, Copiar link, Ver logs, Alterar status, Finalizar
- Erros técnicos apenas para `is_internal()`; cliente vê mensagem amigável

Substituir conteúdo atual por `Tabs` (Radix) com 6 abas:
1. **Visão geral** — cards Liquid Glass agrupando dados financeiros, operacionais, fornecedor, sync
2. **Documentos** — lista via `financial_demand_documents` + upload (Storage `demand-documents`), empty state, status de extração
3. **Comentários** — split client/internal, seletor de visibilidade para internos, badge "interno"
4. **Checklist** — `financial_demand_checklist` com toggle, add/edit/remove (interno), readonly p/ cliente
5. **Timeline** — `financial_demand_timeline` com ícones por `event_type`, ordenação desc
6. **Logs Asana** — só `is_internal()`, lista `asana_sync_logs` por `demand_id`, payloads em `Collapsible`, lazy load

Mobile: tabs viram scroll horizontal compacto.

Novos hooks: `useDemandDocuments`, `useDemandComments`, `useDemandChecklist`, `useDemandTimeline`. Reusar `useAsanaSyncLogs` filtrado por demand_id.

## 2. Botões Asana no header

Componente `DemandAsanaActions`:
- "Abrir no Asana" — só se `asana_task_url`
- "Reenviar" — só se status em `error|pending_sync|not_synced`, chama `asana-retry-sync` com `{ demand_id }`
- "Sincronizar agora" — `asana-update-task` se já tem `asana_task_id`, senão `asana-create-task`
- "Copiar link" — navigator.clipboard
- "Ver logs" — muda aba ativa para Logs (só internal)

Todas com `toast` sucesso/erro, `disabled` enquanto pending, sem travar UI.

## 3. Cron `asana-retry-sync` (1 min)

Via `supabase--insert` (não migration — contém URL/anon key específicos do projeto):

```sql
select cron.schedule(
  'asana-retry-sync-every-minute',
  '* * * * *',
  $$ select net.http_post(
    url:='https://bswoctjrwvixxgqpwxcv.supabase.co/functions/v1/asana-retry-sync',
    headers:='{"Content-Type":"application/json","x-cron-secret":"<CRON_SECRET>"}'::jsonb,
    body:='{}'::jsonb
  ); $$
);
```

Habilitar `pg_cron` + `pg_net` via migration prévia se não estiverem ativos. Função já valida `X-CRON-SECRET`, processa até 50, é idempotente (cria se sem `asana_task_id`, atualiza caso contrário, registra em `asana_sync_logs`).

Fallback: botão "Sincronizar Asana" global já existe; comentar no código a query caso o cron precise ser recriado.

## 4. Paginação 50 em `useDemandsInbox`

Migrar para `useInfiniteQuery`:
- `pageSize = 50`, `.range(from, to)` no Supabase
- `count: 'exact'` na primeira page para total
- Reset ao mudar filtros (queryKey inclui filtros)
- Botão "Carregar mais" + skeleton incremental
- KPIs continuam vindo de query agregada separada (já existente) — não afetados

## 5. Filtros mobile (Sheet)

Em `DemandsListPage`, em `<lg`:
- Trocar barra avançada por botão `Filtros (N)` com contador
- `Sheet` lateral (bottom em mobile) com todos os filtros listados, scroll interno, footer fixo (Aplicar/Limpar/Fechar)
- Reusar componentes de filtro já existentes

## 6. Performance & UX

- Lazy-load aba Logs Asana e Documentos (`React.lazy` ou fetch on tab activate)
- Skeleton no detalhe e listagem
- Não buscar logs na listagem
- `useMemo` em cards/filtros pesados
- Debounce em busca, `disabled` durante mutations Asana
- Memo no Kanban para evitar re-render em drag

## 7. RLS & permissões

Tudo já está em policies existentes (`is_internal()`, `created_by`, `asana_sync_logs` internal-only). Não alterar. Apenas garantir no frontend:
- Aba "Logs Asana" condicional a `useUserRole().isInternal`
- Comentários internos filtrados client-side adicionalmente (defesa em profundidade)
- Mensagens de erro Asana técnicas só para internal

## 8. Validação E2E

Após implementar, validar via preview + `supabase--edge_function_logs`:
- Criar demanda → checar `asana_sync_status`, `asana_task_id`, `asana_task_url`
- Arrastar Kanban → checar update no Supabase + log de update no Asana
- Forçar erro (PAT inválido temporário) → reenviar via botão → confirmar retry
- Verificar como cliente (role `user`) que abas/comentários internos somem
- Testar mobile 390px (filtros Sheet, abas scroll)

## Arquivos

**Criar:**
- `src/components/demands/detail/DemandHeader.tsx`
- `src/components/demands/detail/DemandAsanaActions.tsx`
- `src/components/demands/detail/tabs/{Overview,Documents,Comments,Checklist,Timeline,AsanaLogs}Tab.tsx`
- `src/components/demands/DemandsFiltersSheet.tsx`
- `src/hooks/useDemandDocuments.ts`, `useDemandComments.ts`, `useDemandChecklist.ts`, `useDemandTimeline.ts`
- Migration: enable `pg_cron`/`pg_net`

**Alterar:**
- `src/pages/demands/DemandDetailPage.tsx` (refatoração completa, mantendo rota)
- `src/pages/demands/DemandsListPage.tsx` (Sheet mobile + "Carregar mais")
- `src/hooks/useDemandsInbox.ts` (infinite query, pageSize 50)

**Cron:** `supabase--insert` após CRON_SECRET confirmado (já existe nos secrets).

## Critérios de pronto

Detalhe refatorado · 6 abas funcionais · logs protegidos · botões Asana operacionais · cron agendado · paginação 50 · filtros mobile via Sheet · Kanban preservado · E2E validado · cliente sem dados internos · mobile e desktop refinados · Liquid Glass mantido · nada antigo quebrado.
