## Central de Demandas Financeiras — Etapa 1

Objetivo: criar a fundação do módulo sem tocar nas features existentes. Entregar banco, segurança, menu, rota e listagem básica funcionando. Etapas 2-5 (formulário, upload, checklist, aprovação, dashboard, regras) virão em mensagens separadas.

### Modelo de acesso

Reaproveita `user_roles` atual:
- `user` = cliente final → vê apenas demandas onde `created_by = auth.uid()`.
- `manager` e `admin` = equipe interna do BPO → veem todas as demandas do sistema, podem editar status, atribuir, comentar internamente, finalizar.

Sem multitenancy novo. `assigned_to` referencia um usuário interno opcional.

### Banco de dados (migração única)

Tabelas criadas em `public`, todas com RLS habilitado e timestamps padrão:

1. **financial_demands** — núcleo
   - `created_by` (cliente), `assigned_to` (equipe, nullable)
   - `demand_type` (enum text), `title`, `description`, `amount NUMERIC(14,2)`, `due_date`
   - `supplier_name`, `supplier_document`, `category_suggested`, `category_final`, `cost_center`
   - `priority` (baixa|normal|alta|urgente, default normal)
   - `status` (recebida|em_analise|aguardando_info|aguardando_aprovacao|aprovada|reprovada|em_execucao|pagamento_agendado|comprovante_enviado|finalizada|cancelada)
   - `ai_confidence NUMERIC`, `requires_review BOOL`
   - `approved_by`, `approved_at`, `rejected_by`, `rejected_at`, `rejection_reason`
   - `finalized_at`

2. **financial_demand_documents** — `demand_id`, `file_name`, `file_path`, `file_type`, `file_size`, `document_type`, `extracted_data JSONB`, `extraction_status`, `extraction_confidence`. (Upload real entra na Etapa 2; coluna já preparada para IA futura.)

3. **financial_demand_checklist** — `demand_id`, `label`, `is_completed`, `completed_by`, `completed_at`, `sort_order`.

4. **financial_demand_comments** — `demand_id`, `user_id`, `comment`, `visibility` (`internal` | `client`).

5. **financial_demand_timeline** — `demand_id`, `user_id`, `event_type`, `title`, `description`, `metadata JSONB`. Append-only.

6. **financial_category_rules** — `keyword`, `category`, `priority`, `is_active`. Mantida por admins.

7. **financial_demand_tasks** — `demand_id`, `assigned_to`, `title`, `description`, `status`, `priority`, `due_date`.

8. **notifications** — `user_id`, `type`, `title`, `body`, `link`, `read_at`, `metadata`. Genérica (servirá outros módulos depois).

9. **storage bucket** `demand-documents` (privado). Policies: o dono da demanda e qualquer manager/admin podem ler/escrever arquivos no prefixo `{demand_id}/`.

Índices: `(created_by)`, `(assigned_to)`, `(status)`, `(due_date)`, `(demand_id)` nas filhas.

Trigger reaproveitando `update_updated_at_column` para todas as tabelas com `updated_at`.

Trigger `validate_amount_precision` estendida (ou trigger dedicado) para arredondar `amount` em `financial_demands`.

### RLS — padrão por tabela

Política helper: `public.is_internal()` = `has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager')` (SECURITY DEFINER, STABLE).

- **financial_demands**
  - SELECT: `is_internal() OR created_by = auth.uid()`
  - INSERT: `created_by = auth.uid()` (qualquer authenticated)
  - UPDATE: `is_internal()` OU (`created_by = auth.uid()` AND status restrito) — Etapa 1 mantém simples: cliente só edita enquanto `status='recebida'`; equipe edita sempre.
  - DELETE: `is_internal()`.
- **documents / checklist / tasks**: SELECT/INSERT/UPDATE/DELETE delegados à demanda parent via EXISTS check em `financial_demands` aplicando a mesma regra acima.
- **comments**:
  - SELECT: `is_internal()` OU (dono da demanda AND `visibility='client'`).
  - INSERT: `is_internal()` para qualquer; cliente só pode inserir `visibility='client'` em suas demandas.
- **timeline**: SELECT igual a `demands`; INSERT só via service role (gravado por triggers / edge functions); UPDATE/DELETE bloqueados.
- **category_rules**: SELECT para authenticated; INSERT/UPDATE/DELETE só `is_internal()`.
- **notifications**: SELECT/UPDATE só `user_id = auth.uid()`; INSERT via service role.

### Frontend — escopo Etapa 1

- Novo grupo no `AppSidebar` ("Demandas Financeiras") com itens: Dashboard, Nova Demanda, Recebidas, Aprovações Pendentes, Documentos, Configurações. Apenas **Recebidas** fica funcional nesta etapa; os outros itens renderizam placeholders "Em breve" (mantém roteamento estável).
- Novas rotas protegidas em `src/App.tsx` sob `/demands/*`:
  - `/demands` → `DemandsListPage`
  - `/demands/new`, `/demands/approvals`, `/demands/documents`, `/demands/settings`, `/demands/dashboard` → placeholder único com empty state Liquid Glass.
- `DemandsListPage` (Etapa 1):
  - Hook `useFinancialDemands` (React Query) → SELECT em `financial_demands` ordenado por `created_at desc`, paginado (limit 50).
  - Tabela em GlassCard com colunas: Título, Cliente (created_by → join opcional com `profiles.full_name`), Tipo, Valor, Vencimento, Prioridade (badge), Status (badge colorido), Atualizada em.
  - StatusBadge e PriorityBadge novos em `src/components/demands/`.
  - Filtros simples no topo: busca por título, select de status, select de prioridade.
  - Estados Loading (skeleton), Empty ("Nenhuma demanda ainda"), Error (mensagem sanitizada) — conforme regra Core de resiliência.
- Sininho de notificações no `DashboardHeader`:
  - Hook `useNotifications` (count unread + lista últimas 20).
  - `Popover` shadcn com itens clicáveis (navega para `link`) e botão "marcar todas como lidas".
  - Subscription Realtime opcional (Etapa 2) — Etapa 1 só polling com `refetchInterval: 30s`.

Sem formulário de criação, upload, timeline, aprovação ou dashboard nesta etapa — esses ficam para Etapas 2-4.

### Componentes/arquivos novos

```
src/pages/demands/DemandsListPage.tsx
src/pages/demands/DemandsPlaceholderPage.tsx
src/components/demands/StatusBadge.tsx
src/components/demands/PriorityBadge.tsx
src/components/demands/DemandFilters.tsx
src/components/notifications/NotificationsBell.tsx
src/hooks/useFinancialDemands.ts
src/hooks/useNotifications.ts
```

Editados: `src/App.tsx` (rotas), `src/components/layout/AppSidebar.tsx` (novo grupo), `src/components/layout/DashboardHeader.tsx` (sininho).

### Validação antes de fechar a Etapa 1

- Migração roda sem erro; linter Supabase limpo para as novas tabelas (RLS on, sem policies permissivas demais).
- Cliente logado como `user` consegue criar 1 demanda via SQL e vê apenas a própria na listagem.
- Conta com role `admin/manager` enxerga todas.
- Sininho aparece sem quebrar header em desktop e mobile.
- Nenhuma rota/feature existente quebra (Home, DRE, CC, Sheets continuam idênticos).

### Fora desta etapa (próximas mensagens)

Etapa 2: formulário multi-step `/demands/new`, upload para bucket, página de detalhe com timeline e checklist gerado por tipo, trigger que escreve eventos automáticos na `timeline`.
Etapa 3: comentários (internos/cliente), fluxo de aprovação/reprovação, justificativa obrigatória, notificações disparadas.
Etapa 4: dashboard KPI + filtros avançados, página Documentos, CRUD de `financial_category_rules`, sugestão automática de categoria por keyword.
Etapa 5: polish UX/mobile, empty/loading/error states refinados, auditoria de segurança final, memória de projeto atualizada.