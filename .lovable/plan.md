
# Etapa 2 — Central de Demandas Financeiras

Objetivo: permitir que clientes criem demandas pelo `/demands/new` (formulário multi-step com upload), abram a página de detalhe (`/demands/:id`) com timeline + checklist auto-gerado por tipo, e que o banco registre eventos automaticamente via trigger.

## 1. Banco de dados (migração)

### 1.1 Templates de checklist por tipo
Função `public.seed_demand_checklist(demand_id uuid, demand_type text)` que insere itens padrão em `financial_demand_checklist` de acordo com o tipo:

- `pagamento`: "Validar boleto/NF", "Conferir dados bancários", "Aprovar valor", "Agendar pagamento", "Confirmar pagamento"
- `recebimento`: "Conferir NF emitida", "Confirmar entrada", "Conciliar conta"
- `nota_fiscal`: "Validar dados", "Emitir NF", "Enviar ao cliente"
- `conciliacao`: "Importar extrato", "Conciliar lançamentos", "Validar diferenças"
- `reembolso`: "Validar comprovante", "Aprovar valor", "Efetuar reembolso"
- `outro`: 1 item genérico "Analisar solicitação"

### 1.2 Trigger de timeline automática
Trigger `AFTER INSERT OR UPDATE` em `financial_demands` chamando `public.log_demand_event()` (SECURITY DEFINER, search_path public):

- INSERT → evento `created` + chama `seed_demand_checklist(...)` + cria `notifications` para `is_internal()` users
- UPDATE de `status` → evento `status_changed` (de → para) + notifica `created_by`
- UPDATE de `assigned_to` (não nulo) → evento `assigned` + notifica `assigned_to`
- UPDATE de `approved_at` / `rejected_at` / `finalized_at` → eventos correspondentes

Trigger `AFTER INSERT` em `financial_demand_documents` → evento `document_uploaded` na timeline.
Trigger `AFTER INSERT` em `financial_demand_comments` → evento `comment_added`.

Nenhuma alteração estrutural nas tabelas existentes; apenas funções + triggers.

### 1.3 Storage policies
Bucket `demand-documents` já existe. Adicionar policies (se não existirem) em `storage.objects`:
- INSERT / SELECT / DELETE permitidos quando `bucket_id = 'demand-documents'` e o primeiro segmento do path (`(storage.foldername(name))[1]`) for um `demand_id` em `financial_demands` onde `is_internal()` ou `created_by = auth.uid()`.

## 2. Hooks

- `useCreateDemand()` (mutation): insere em `financial_demands` retornando `id`, invalida `['demands']`.
- `useUploadDemandDocument()` (mutation): faz upload em `demand-documents/{demand_id}/{uuid}-{filename}`, insere row em `financial_demand_documents`.
- `useDemand(id)` (query): retorna demanda + `created_by` profile.
- `useDemandTimeline(id)` (query): lista eventos ordenados por `created_at desc`.
- `useDemandChecklist(id)` (query + mutation `toggle`): lista e marca itens.
- `useDemandDocuments(id)` (query + mutation `delete`): lista e remove arquivos (storage + row).

Todos com 3 estados (loading/error/empty) seguindo a regra global do projeto.

## 3. Formulário multi-step `/demands/new`

Componente `NewDemandPage` com 4 passos dentro de um `GlassCard` (Liquid Glass), barra de progresso no topo:

1. **Tipo & título** — `demand_type` (cards visuais com ícones: Pagamento, Recebimento, NF, Conciliação, Reembolso, Outro), `title`, `priority`.
2. **Detalhes financeiros** — `amount`, `due_date`, `supplier_name`, `supplier_document`, `cost_center`, `description` (textarea).
3. **Documentos** — dropzone (drag-and-drop) usando input file; lista local antes do upload; aceita PDF/JPG/PNG/XML até 10MB cada.
4. **Revisão** — resumo dos dados, botão "Enviar demanda".

Fluxo de submit:
1. Cria demanda → recebe `id`
2. Faz upload de cada arquivo em paralelo (`Promise.all`) para `demand-documents/{id}/...`
3. Insere rows em `financial_demand_documents`
4. Redireciona para `/demands/:id`

Validação com `zod` por etapa. Botões: Voltar / Próximo / Enviar. Estados: salvando, erro com retry.

## 4. Página de detalhe `/demands/:id`

`DemandDetailPage` com layout em 2 colunas (desktop) / stack (mobile):

**Coluna principal (8/12)**:
- Header: `StatusBadge` + `PriorityBadge` + título + ações internas (admin/manager: alterar status, atribuir, finalizar — Etapa 3 fará aprovar/rejeitar)
- Card de detalhes (valor, vencimento, fornecedor, categoria sugerida, descrição)
- Card **Documentos**: grid com thumbnail/ícone, nome, tamanho, botão download (`createSignedUrl` 60s) e excluir
- Card **Timeline**: linha vertical com ícones por `event_type`, autor, timestamp relativo

**Coluna lateral (4/12)**:
- Card **Checklist**: itens com checkbox; só internos podem marcar; mostra `completed_by` + horário
- Card **Resumo**: criada por, criada em, atribuída a

Loading: skeletons. Erro: mensagem amigável (404 captado como null). Vazio: estados próprios para timeline/docs/checklist.

## 5. Roteamento e sidebar

- `App.tsx`: substituir placeholder de "Nova Demanda" pela rota real `/demands/new` → `NewDemandPage`; adicionar `/demands/:id` → `DemandDetailPage`.
- `DemandsListPage`: cada linha vira link para `/demands/:id`.
- `AppSidebar`: item "Nova Demanda" já existe — sem mudança estrutural.

## 6. Validação

- Migração roda limpa; linter sem warnings novos.
- Cliente cria demanda → vê evento `created` na timeline e checklist preenchido conforme tipo.
- Upload aparece imediatamente na lista de documentos e gera evento `document_uploaded`.
- Mudança de status (feita pelo interno via dropdown) escreve evento `status_changed` e cria `notification` para o cliente.
- RLS: cliente não vê demanda de outro cliente; cliente não consegue marcar checklist (policy `is_internal()`).
- Nenhuma rota existente quebra.

## 7. Arquivos

**Criar**
- `supabase/migrations/<ts>_demands_etapa2.sql`
- `src/hooks/useDemand.ts`, `useDemandTimeline.ts`, `useDemandChecklist.ts`, `useDemandDocuments.ts`, `useCreateDemand.ts`, `useUploadDemandDocument.ts`
- `src/pages/demands/NewDemandPage.tsx`
- `src/pages/demands/DemandDetailPage.tsx`
- `src/components/demands/new/StepTypeTitle.tsx`, `StepDetails.tsx`, `StepDocuments.tsx`, `StepReview.tsx`, `StepProgress.tsx`
- `src/components/demands/detail/DemandHeader.tsx`, `DemandTimeline.tsx`, `DemandChecklist.tsx`, `DemandDocumentsCard.tsx`, `DemandSummaryCard.tsx`
- `src/lib/demands/checklistTemplates.ts` (espelho TS dos templates, caso precise no front)

**Editar**
- `src/App.tsx` (rotas `/demands/new` e `/demands/:id`)
- `src/pages/demands/DemandsListPage.tsx` (linkar linhas)

## Próximas etapas (não nesta entrega)

- Etapa 3: comentários, fluxo de aprovação/rejeição com justificativa, regras de notificação refinadas.
- Etapa 4: dashboard de KPIs, lista de documentos global, CRUD de regras de categoria, sugestão automática.
- Etapa 5: polimento, auditoria de segurança, atualização da memória do projeto.
