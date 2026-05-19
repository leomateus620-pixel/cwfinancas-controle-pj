
# Etapas 3 + 4 — Central de Demandas Financeiras

Entrega conjunta: comentários, aprovação/rejeição com justificativa, dashboard de KPIs, documentos consolidados, CRUD de regras e sugestão automática de categoria por palavra-chave. Tudo sob um menu reorganizado.

## 1. Reorganização do menu (sidebar)

O menu atual lista 6 itens sem hierarquia. Vamos agrupá-los por papel do usuário para clientes e equipe interna verem só o que importa:

```text
Demandas Financeiras
├─ Visão geral          /demands/dashboard      (todos)
├─ Recebidas            /demands                (todos)
├─ Nova demanda         /demands/new            (todos)
├─ Aprovações           /demands/approvals      (interno) — badge com contador
├─ Documentos           /demands/documents      (interno)
└─ Regras & categorias  /demands/settings       (interno)
```

- Itens marcados (interno) ficam ocultos para `role = user` via `useUserRole().isManager`.
- "Aprovações" mostra badge com contagem de demandas `status = 'aguardando_aprovacao'` quando > 0.
- "Visão geral" passa a ser o landing do módulo (era placeholder).

## 2. Etapa 3 — Comentários e aprovação

### 2.1 Comentários (`/demands/:id`)

- Novo card "Conversa" abaixo da Linha do tempo.
- Hook `useDemandComments(demandId)` + `useAddDemandComment`.
- Cliente vê e cria apenas comentários com `visibility = 'client'`.
- Interno escolhe `client` (visível ao cliente) ou `internal` (só equipe), com toggle visual claro (badge "Interno" em fundo âmbar).
- Composer com `Textarea` + botão "Enviar" + radio `visibility`.
- Mensagens renderizadas em bolhas alinhadas (esquerda=outros, direita=eu), avatar/inicial, horário relativo.
- Trigger já existente (`log_demand_comment_event`) escreve evento na timeline automaticamente.

### 2.2 Fluxo de aprovação

Regra: clientes solicitam → interno revisa → manager aprova/rejeita. Etapas:

1. Cliente cria demanda → status `recebida`.
2. Interno pode clicar **"Solicitar aprovação"** quando estiver em `em_analise` → status `aguardando_aprovacao`.
3. Em `aguardando_aprovacao`, na página de detalhe aparece um card destacado **"Decisão pendente"** com dois botões:
   - **Aprovar** (verde) — opcional justificar
   - **Rejeitar** (vermelho) — abre modal exigindo `rejection_reason` (mín. 5 chars). Sem justificativa, botão fica desabilitado.
4. Ao aprovar: `status='aprovada'`, `approved_at=now()`, `approved_by=auth.uid()`.
5. Ao rejeitar: `status='reprovada'`, `rejected_at=now()`, `rejected_by=auth.uid()`, `rejection_reason=<texto>`.
6. Trigger existente já gera eventos `approved`/`rejected` + notifica cliente via trigger de `status_changed`.

Hook único `useApproveDemand` / `useRejectDemand`. Visibilidade dos botões: só `isManager`.

### 2.3 Migração de banco

- Função `public.has_pending_approvals_count()` (SECURITY DEFINER) para badge — apenas conta, sem expor dados.
- Garantir UPDATE em `financial_demands` permitido para `aprovada`/`reprovada` (RLS já cobre via `is_internal()`).
- Sem schema novo; nenhum CREATE TABLE nesta parte.

## 3. Etapa 4 — Dashboard, Documentos, Regras, Sugestão

### 3.1 `/demands/dashboard` — Visão geral

Layout em 3 linhas, Liquid Glass:

**Linha 1 — KPIs (4 cards):**
- Demandas no mês (total criadas)
- Aguardando aprovação (com link → `/demands/approvals`)
- Tempo médio de resolução (criada → finalizada, em horas/dias)
- Volume financeiro do mês (soma de `amount` de demandas finalizadas)

**Linha 2 — Gráficos:**
- Barra empilhada por status (últimos 30 dias)
- Donut por tipo de demanda

**Linha 3:**
- Lista das 5 demandas mais antigas ainda abertas (alerta)
- Filtros avançados que afetam todos os KPIs: período (date range), tipo, prioridade, status, criador (apenas interno), valor mín/máx.

Hook `useDemandStats(filters)` faz uma única query select agregando no cliente (até 1000 rows).

### 3.2 `/demands/documents` — Documentos consolidados (interno)

- Tabela com todos os arquivos de `financial_demand_documents` (JOIN com `financial_demands` para mostrar título/cliente).
- Colunas: arquivo, demanda (link), enviado por, tipo, tamanho, data.
- Filtros: busca por nome, tipo de arquivo (PDF/IMG/XML), demanda.
- Ações: baixar (signed URL 60s), abrir demanda.
- Paginação simples (50 por página).

### 3.3 `/demands/settings` — Regras & categorias (interno)

CRUD de `financial_category_rules` (já existe a tabela):

- Lista em `GlassCard`: keyword, categoria, prioridade, ativo (switch).
- Botão "Nova regra" → modal com `keyword`, `category`, `priority` (number), `is_active`.
- Editar inline (clique no item abre modal).
- Excluir com confirmação.
- Dica visual: "Quando uma demanda é criada, palavras-chave em título e descrição sugerem categoria automaticamente."

### 3.4 Sugestão automática de categoria

**Trigger no banco** (`suggest_demand_category`) `BEFORE INSERT OR UPDATE OF title, description` em `financial_demands`:

- Se `category_final` está preenchido → não faz nada.
- Senão, busca regra ativa com maior `priority` cujo `lower(keyword)` apareça em `lower(coalesce(title,'') || ' ' || coalesce(description,''))`.
- Se achar → `NEW.category_suggested = regra.category`, `NEW.ai_confidence = 0.7`.
- Se não achar → mantém `category_suggested` como está.

No frontend, na página de detalhe, quando `category_suggested` existe e `category_final` é null, mostrar badge **"Sugestão: X"** com botão **"Confirmar"** (interno) que copia para `category_final`.

## 4. Hooks novos

- `src/hooks/useDemandComments.ts` — query + mutation add
- `src/hooks/useApproveDemand.ts` — `approve`, `reject`, `requestApproval` mutations
- `src/hooks/useDemandStats.ts` — agregados para o dashboard
- `src/hooks/useAllDemandDocuments.ts` — lista consolidada
- `src/hooks/useCategoryRules.ts` — CRUD (list, upsert, remove)
- `src/hooks/usePendingApprovalsCount.ts` — badge do sidebar
- `src/hooks/useSetDemandCategory.ts` — confirmar categoria sugerida

## 5. Componentes novos

```text
src/components/demands/
├─ detail/
│   ├─ DemandComments.tsx       (lista + composer + toggle interno/cliente)
│   ├─ ApprovalDecisionCard.tsx (card destacado com botões Aprovar/Rejeitar)
│   ├─ RejectModal.tsx          (justificativa obrigatória)
│   └─ CategorySuggestionBadge.tsx
├─ dashboard/
│   ├─ DemandKpiCards.tsx
│   ├─ DemandStatusChart.tsx
│   ├─ DemandTypeDonut.tsx
│   ├─ OldestOpenList.tsx
│   └─ AdvancedFilters.tsx
├─ documents/
│   └─ DocumentsTable.tsx
└─ settings/
    ├─ CategoryRulesTable.tsx
    └─ CategoryRuleModal.tsx
```

## 6. Páginas novas / atualizadas

- **Criar** `src/pages/demands/DemandsDashboardPage.tsx`
- **Criar** `src/pages/demands/DemandsApprovalsPage.tsx` (lista filtrada `status=aguardando_aprovacao`)
- **Criar** `src/pages/demands/DemandsDocumentsPage.tsx`
- **Criar** `src/pages/demands/DemandsSettingsPage.tsx`
- **Editar** `src/pages/demands/DemandDetailPage.tsx` — adicionar `DemandComments`, `ApprovalDecisionCard`, `CategorySuggestionBadge`
- **Editar** `src/App.tsx` — trocar placeholders pelas páginas reais
- **Editar** `src/components/layout/AppSidebar.tsx` — itens condicionados por role + badge "Aprovações"

## 7. Banco de dados — migração única

```sql
-- 1) Trigger de sugestão de categoria
CREATE FUNCTION public.suggest_demand_category() RETURNS trigger
-- BEFORE INSERT OR UPDATE OF title, description ON financial_demands

-- 2) Função de contagem para badge
CREATE FUNCTION public.demands_pending_approvals_count() RETURNS int
-- STABLE SECURITY INVOKER (RLS já filtra por papel)

-- 3) Seed inicial de regras (opcional, 6 padrões úteis: aluguel, energia,
--    folha, internet, marketing, imposto) com priority=50, is_active=true
```

Sem alteração estrutural; só funções/trigger e seed via `insert` tool.

## 8. Permissões e segurança

- Sidebar e botões internos escondidos por `isManager`, **mas** a defesa real está na RLS já existente (`is_internal()`).
- `rejection_reason` validado com Zod (mín. 5, máx. 500) no front e na mutation.
- Comentários `internal` filtrados pela RLS atual — cliente nunca recebe a linha.
- Funções novas SECURITY DEFINER com `REVOKE EXECUTE` de `PUBLIC, anon, authenticated` quando não houver motivo para chamada direta (trigger e contagem).

## 9. Validação

- `bun run build` limpo, sem warnings novos do linter.
- Cliente criando demanda com "boleto de energia" → categoria sugerida = "Utilidades" (se seed cobrir).
- Interno marca `aguardando_aprovacao` → card de decisão aparece; aprovar/rejeitar atualiza status, gera evento e notifica cliente.
- Sidebar do cliente esconde Aprovações/Documentos/Regras; sidebar interno mostra tudo com badge de pendentes.
- Página `/demands/documents` lista arquivos do cliente da demanda atual com download funcionando.
- CRUD de regras: criar, editar, desativar, excluir.

## 10. Fora de escopo (próxima etapa, Etapa 5)

- OCR/IA para preencher `extracted_data` (pendente decisão futura)
- E-mail/Resend para notificações
- Atribuição de demanda a um membro específico (Picker de usuários internos)
- Atualização da memória do projeto e auditoria final
