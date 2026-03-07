

## Plan Revisado: Contas a Pagar / Receber — Pipeline Completo

### Correções aplicadas conforme solicitado

---

### Part 1: Database — Tabela `accounts_payable_receivable`

```sql
CREATE TABLE public.accounts_payable_receivable (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  connection_id uuid REFERENCES google_sheet_connections(id) ON DELETE SET NULL,
  record_type text NOT NULL CHECK (record_type IN ('payable', 'receivable')),
  period_key text NOT NULL,           -- "2026-01"
  source_tab text NOT NULL,
  source_row integer,
  source_layout text,                 -- 'horizontal_monthly' | 'vertical_rows' | 'block_contract'
  due_date date,
  description text NOT NULL DEFAULT '',
  counterpart text,
  nf_number text,
  payment_method text,
  amount numeric(14,2) NOT NULL,
  status_raw text,
  status_normalized text NOT NULL DEFAULT 'pendente',
  notes text,
  content_hash text NOT NULL,         -- MD5 do conteúdo lógico (dedup estável)
  sync_run_id text,                   -- ID da execução de sync (detecta órfãos)
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  raw_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, connection_id, content_hash)
);

-- Índices de performance
CREATE INDEX idx_apr_user_period ON accounts_payable_receivable(user_id, period_key);
CREATE INDEX idx_apr_user_type ON accounts_payable_receivable(user_id, record_type);
CREATE INDEX idx_apr_sync_run ON accounts_payable_receivable(user_id, connection_id, sync_run_id);
CREATE INDEX idx_apr_last_seen ON accounts_payable_receivable(user_id, connection_id, last_seen_at);

ALTER TABLE accounts_payable_receivable ENABLE ROW LEVEL SECURITY;
-- RLS: CRUD próprio do user (4 policies padrão)
```

**Deduplicação:** `content_hash` = MD5 de `(record_type, period_key, description_normalizada, counterpart_normalizado, amount)`. Isso é estável independente de posição de linha/aba.

**Registros órfãos:** Após cada sync, DELETE registros com `sync_run_id != current_run AND connection_id = X`, garantindo que linhas removidas da planilha sejam removidas do banco.

---

### Part 2: Integração ao Fluxo Principal de Sync

**Não criar edge function separada.** Integrar diretamente no `sheets-sync-all-tabs/index.ts`:

1. Estender `TabRoute` com `"PAYABLE" | "RECEIVABLE"`
2. Na classificação (`classifyTab`), **antes** do match de meses, testar payable/receivable com scoring
3. Após processar abas mensais, processar abas PAYABLE/RECEIVABLE com parser dedicado
4. Isso garante que ao sincronizar, contas a pagar/receber sejam sempre atualizadas junto

**Autenticação:** Já usa `verify_jwt = false` com validação manual via `getUser()` no código — mantém o padrão existente (o user é autenticado no código, a conexão é validada como pertencente ao user).

---

### Part 3: Classificação de Abas com Score de Confiança

```text
classifyTabPayableReceivable(tabName, headers, sampleRows) → { type, score, layout }

Score composto (0-100):
  +30  nome da aba match (contas a pagar, pagar, payable, etc.)
  +25  cabeçalhos match (vencimento+despesa+valor = payable; cliente+NF+valor = receivable)
  +20  estrutura (blocos por mês, status como pago/pendente nas linhas)
  +15  sinais positivos adicionais (forma pgto, observação)
  -40  sinais negativos: DRE keywords, "demonstracao", "resultado", "tendencia", "plano de contas", "resumo"
  -30  aba já classificada como MONTHLY ou DRE

Threshold: score >= 40 para classificar como PAYABLE ou RECEIVABLE
```

**Padrões de nome:**
- Payable: `contas a pagar`, `pagar`, `payable`, `despesas agendadas`, `a pagar`, `pagamentos`
- Receivable: `contas a receber`, `receber`, `receivable`, `clientes a receber`, `a receber`, `recebimentos`

**O layout detectado é registrado no log** (campo `source_layout` no registro + log console).

---

### Part 4: Parsers Dedicados por Layout

Três parsers específicos (não reutiliza `detectHeaderRow` genérico):

**4.1 Parser Horizontal por Mês**
- Detecta cabeçalho com meses em sequência horizontal (Jan, Fev, Mar...)
- Cada mês tem sub-colunas (valor, pgto, NF, forma pgto)
- Coluna fixa à esquerda = identificador (despesa/cliente)
- Gera N registros por linha (1 por mês)
- Detecção: ≥3 nomes de mês na mesma row do header

**4.2 Parser Vertical por Linha**
- Formato tabular clássico: cada linha = 1 registro
- Cabeçalho dedicado detectado por keywords payable/receivable-específicos
- Keywords payable: `vencimento`, `vcto`, `despesa`, `fornecedor`, `forma de pgto`, `status`
- Keywords receivable: `cliente`, `nº NF`, `NF`, `forma de pgto`, `valor`, `status`

**4.3 Parser por Bloco/Contrato**
- Detecta agrupadores: linha com texto sem valor numérico = nome do cliente/contrato
- Linhas subsequentes com meses/valores = registros vinculados ao agrupador
- Detecção: presença de linhas intercaladas com texto-only seguidas de linhas com valores

---

### Part 5: Inferência de Competência/Mês — Prioridade

Ordem de prioridade (do mais confiável ao menos):

1. **Coluna explícita** de data/vencimento/competência no registro → extrair mês
2. **Cabeçalho de coluna** do mês (layout horizontal) → mês do bloco de colunas
3. **Nome da aba** se contiver mês (ex: "Pagar Jan 2026")
4. **Bloco/seção** se houver separador com nome de mês no conteúdo
5. **Fallback:** mês atual (com warning no log)

---

### Part 6: Mapeamento de Status

```text
STATUS_MAP_PAYABLE:
  pago, pg, ok, liquidado, quitado         → "pago"
  pendente, em aberto, aberto, a pagar     → "pendente"
  agendado, programado, scheduled          → "agendado"
  confirmar, a confirmar, verificar        → "confirmar"
  emitir, a emitir                         → "emitir"
  cancelado, estornado                     → "cancelado"
  (vazio ou não reconhecido)               → "desconhecido"

STATUS_MAP_RECEIVABLE:
  recebido, rec, ok, liquidado, quitado    → "recebido"
  pendente, em aberto, aberto, a receber   → "pendente"
  previsto, estimado, expected             → "previsto"
  confirmar, a confirmar, verificar        → "confirmar"
  emitir, a emitir                         → "emitir"
  cancelado, estornado                     → "cancelado"
  (vazio ou não reconhecido)               → "desconhecido"
```

**"ok" não assume pago/recebido automaticamente.** É mapeado como "pago" apenas para payable e "recebido" apenas para receivable, pois é o uso mais comum em planilhas financeiras brasileiras. Se ambíguo, o `status_raw` preserva o valor original para auditoria.

Salvos separadamente: `status_raw` (valor bruto), `status_normalized` (padronizado), `notes` (observações livres).

---

### Part 7: Exclusão Reforçada de Totais e Auxiliares

Antes de importar qualquer registro, aplicar validações:

```text
EXCLUIR se:
- Linha contém keywords: total, subtotal, soma, somatório, geral, resumo
- Linha é cabeçalho repetido (>= 3 keywords de cabeçalho na mesma linha)
- Linha decorativa: todas as células vazias exceto 1, ou apenas separadores (---, ===)
- Valor === 0 e sem descrição
- Descrição é apenas um mês/ano sem conteúdo operacional
- Célula parece instrução do usuário (>50 chars sem valor numérico)
- Registro tem amount === null após parseBRL
```

---

### Part 8: Logs de Importação

Para cada aba processada como PAYABLE/RECEIVABLE, logar no `sync_tab_audit`:

- `tab_name`, `period_key` (se aplicável)
- `rows_scanned`, `rows_imported`, `rows_skipped`
- `skip_reasons`: detalhamento (total_row, empty_row, header_repeat, value_parse_fail, etc.)
- Nos `skip_reasons`, incluir: `layout_detected: "horizontal_monthly"`, `classification_score: 72`, `record_type: "payable"`

---

### Part 9: Frontend — Hook `usePayableReceivable.ts`

- Query `accounts_payable_receivable` filtrada por `record_type` e `period_key`
- Computa agregados: total, total pago/recebido, total pendente, contagem
- Sem mutation de sync própria — usa o sync principal existente

---

### Part 10: UI — Página `/accounts`

**Rota** adicionada em `App.tsx`. Menu em `AppSidebar.tsx` com ícone `ClipboardList`.

**Layout:**
- Header com título "Contas a Pagar / Receber" + seletor de mês (glass chips)
- Dois cards lado a lado (stacked em mobile):

**Card Contas a Pagar** (`liquid-glass-caixa`, borda esquerda amber):
- KPIs: Total a Pagar, Total Pago, Total Pendente, Qtd
- Tabela resumida: descrição, fornecedor, vencimento, valor, status, forma pgto
- Badges de status:
  - `pago` → verde
  - `pendente` → amber
  - `agendado` → azul (não vermelho)
  - `confirmar` → roxo
  - `desconhecido` → cinza

**Card Contas a Receber** (`liquid-glass-caixa`, borda esquerda verde):
- KPIs: Total a Receber, Total Recebido, Total Pendente, Qtd
- Tabela: cliente, nº NF, valor, status, forma pgto
- Badges:
  - `recebido` → verde
  - `pendente` → amber
  - `previsto` → azul
  - `confirmar` → roxo
  - `desconhecido` → cinza

---

### Arquivos Criados/Modificados

| Arquivo | Ação |
|---------|------|
| Migration SQL | Nova tabela + RLS + índices |
| `supabase/functions/sheets-sync-all-tabs/index.ts` | Estender classifyTab + parsers dedicados |
| `supabase/config.toml` | Sem alteração (usa função existente) |
| `src/hooks/usePayableReceivable.ts` | Novo hook |
| `src/pages/AccountsPage.tsx` | Nova página |
| `src/components/accounts/PayableCard.tsx` | Novo componente |
| `src/components/accounts/ReceivableCard.tsx` | Novo componente |
| `src/App.tsx` | Nova rota `/accounts` |
| `src/components/layout/AppSidebar.tsx` | Novo item no menu |

### O que NÃO muda
- Tabela transactions e pipeline mensal existente
- Tabela DRE e pipeline DRE
- Edge functions separadas (tudo integrado no sheets-sync-all-tabs)
- Demais páginas e componentes

