

## Plano: Feature "Cartão de Crédito" — Detecção, Persistência e Dashboard Premium

### Análise dos Padrões nas Planilhas

Com base nas 3 imagens, os blocos de cartão de crédito seguem padrões claros:

1. **Coluna de conta/banco**: Contém "Fatura CC Sicr...", "Fatura CC Nuba", ou nome do banco emissor (UNICRED, CRESOL)
2. **Data repetida**: Todas as linhas do bloco compartilham a mesma data (vencimento da fatura)
3. **Valores negativos**: Despesas em formato negativo ou com parênteses
4. **Descrições pulverizadas**: Fornecedores variados (postos, restaurantes, apps, software)
5. **Categorias preenchidas**: Software, Alimentação, Deslocamentos, Gasolina, etc.
6. **Contiguidade**: Linhas consecutivas formando blocos de 8-40+ linhas

### Arquitetura

```text
┌─────────────────────────────────────────────────────┐
│              PIPELINE DE DETECÇÃO                    │
│                                                      │
│  sheets-sync-all-tabs (existente, NÃO alterado)      │
│           ↓ (transactions já persistidas)             │
│  detect-credit-cards (nova edge function)            │
│           ↓                                          │
│  credit_card_cycles + credit_card_transactions       │
│           ↓                                          │
│  credit_card_review_queue (baixa confiança)          │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│              FRONTEND                                │
│                                                      │
│  useCreditCardDashboard() hook                       │
│           ↓                                          │
│  CreditCardPage.tsx (menu premium)                   │
│  - KPIs: líquido, bruto, reembolsos, lançamentos    │
│  - Faturas por ciclo                                 │
│  - Categorias (donut + grid)                         │
│  - Tabela de lançamentos                             │
│  - Fila de revisão                                   │
└─────────────────────────────────────────────────────┘
```

### Abordagem de Detecção — PÓS-IMPORTAÇÃO

A detecção NÃO altera o pipeline de sync existente. Em vez disso, uma **nova edge function** (`detect-credit-cards`) analisa as transações já importadas na tabela `transactions` para identificar blocos de cartão. Isso garante zero regressão.

**Sinais de detecção (por prioridade):**
1. Campo `client_vendor` ou `source_tab` contendo "Fatura CC", "cartão", "cartao"
2. Campo `notes` ou `raw_data` com referências a emissores de cartão
3. Repetição de `date` em linhas contíguas do mesmo `source_tab` + `source_sheet_id`
4. Valores predominantemente negativos (despesa)
5. Descrições pulverizadas típicas de cartão (fornecedores diversos, apps, postos)
6. Contiguidade de `source_row_number`

**Score de confiança:**
- "Fatura CC" no client_vendor → 0.95
- Nome de banco emissor + data repetida + contiguidade → 0.85
- Apenas contiguidade + data repetida + negativos → 0.70
- Abaixo de 0.70 → `needs_review`

### Fase 1 — Migração de Banco

**Tabela `credit_card_cycles`:**
- id, user_id, connection_id, card_label, period_key, due_date
- source_sheet_id, source_tab
- cycle_start_row, cycle_end_row
- detection_confidence, gross_amount, reimbursement_amount, net_amount
- transaction_count, status (draft|validated|needs_review)
- raw_block_hash, import_batch_id
- created_at, updated_at
- RLS: user_id = auth.uid()

**Tabela `credit_card_transactions`:**
- id, cycle_id, user_id, transaction_id (FK → transactions)
- due_date, transaction_type (expense|reimbursement)
- original_description, amount, category_original, category_normalized
- source_account, source_row_number, row_hash
- detection_confidence, detection_flags (jsonb)
- is_manually_overridden, override_reason
- created_at, updated_at
- RLS: user_id = auth.uid()

**Tabela `credit_card_review_queue`:**
- id, user_id, transaction_id, source_tab, source_row_number
- row_hash, raw_snapshot (jsonb), reason_flag, suggested_action
- confidence, reviewed_by, reviewed_at, final_decision
- created_at
- RLS: user_id = auth.uid()

### Fase 2 — Edge Function `detect-credit-cards`

Recebe `{ connectionId }`, lê transações dessa connection, agrupa por `source_tab` + `date` + contiguidade de `source_row_number`, calcula scores, persiste ciclos e transações de cartão. Deduplicação por `row_hash`.

Lógica principal:
1. Buscar transações com `source_sheet_id` da connection
2. Agrupar por `source_tab`
3. Ordenar por `source_row_number`
4. Detectar blocos contíguos (mesma data, linhas consecutivas, padrão "Fatura CC")
5. Calcular score por bloco
6. Classificar cada linha: expense / reimbursement / needs_review
7. Upsert em `credit_card_cycles` e `credit_card_transactions`
8. Enviar baixa confiança para `credit_card_review_queue`

### Fase 3 — Hooks

**`useCreditCardDashboard(connectionId)`:**
- Query de ciclos com agregados
- Query de transações com filtros (período, cartão, categoria, tipo)
- Query de review queue
- Mutation para reprocessar
- Mutation para override manual (aprovar/rejeitar review item)

### Fase 4 — `CreditCardPage.tsx`

Layout premium liquid glass:

```text
┌─────────────────────────────────────────────────────┐
│  CARTÃO DE CRÉDITO          [Detectar] [Filtros]    │
└─────────────────────────────────────────────────────┘

ROW 1: KPIs (4 cards)
┌──────────┬──────────┬──────────┬──────────┐
│ Fatura   │ Despesas │ Reembol- │ Lança-   │
│ Líquida  │ Brutas   │ sos      │ mentos   │
└──────────┴──────────┴──────────┴──────────┘

ROW 2: 2 colunas
┌────────────────────┬───────────────────────┐
│ FATURAS POR CICLO  │ CATEGORIAS (donut)    │
│ cards por vencim.  │ + grid lateral        │
└────────────────────┴───────────────────────┘

ROW 3: Tabela de lançamentos (full-width)
┌─────────────────────────────────────────────────────┐
│ Busca | Vencimento | Descrição | Categoria | Valor  │
│       | Tipo | Origem | Confiança                    │
└─────────────────────────────────────────────────────┘

ROW 4: Revisão (se houver itens)
┌─────────────────────────────────────────────────────┐
│ Itens com baixa confiança + ações de override       │
└─────────────────────────────────────────────────────┘
```

### Fase 5 — Sidebar + Rota

- Adicionar "Cartão de Crédito" na sidebar (ícone `CreditCard`)
- Rota protegida `/credit-cards` em App.tsx

### Arquivos

| Ação | Arquivo |
|------|---------|
| Migração | 3 tabelas + índices + RLS |
| Criar | `supabase/functions/detect-credit-cards/index.ts` |
| Criar | `src/hooks/useCreditCardDashboard.ts` |
| Criar | `src/pages/CreditCardPage.tsx` |
| Editar | `src/components/layout/AppSidebar.tsx` (add nav) |
| Editar | `src/App.tsx` (add route) |

### Escopo restrito
- Zero alteração no pipeline de sync existente (`sheets-sync-all-tabs`)
- Zero alteração nas tabelas `transactions`, `dre_*`, `forecast_*`
- Detecção opera sobre dados já importados (pós-sync)
- Zero impacto em dashboards, DRE, caixa, receitas, despesas
- Dados de cartão em tabelas dedicadas e isoladas

