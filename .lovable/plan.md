

## Plano: Correção do Bug Crítico — 0 Faturas / 0 Lançamentos

### Causa Raiz Identificada

O pipeline retorna 0/0 porque a detecção nunca é acionada. A auditoria forense dos dados reais revela:

**1. `client_vendor` é NULL em 100% das transações.**
A função verifica `hasCCPattern(t.client_vendor)` e `hasBankPattern(t.client_vendor)` — ambas retornam `false/null` com `client_vendor = null`.

**2. O nome do banco está em `raw_data->>'Banco'`**, não em `client_vendor`.
- Connection `4fa15756`: `raw_data.Banco` = "UNICRED" ou "CRESOL"
- Connection `9c5aa84f`: `raw_data.Banco` = null (este é o extrato Sicredi direto)

**3. Blocos reais existem, mas são invisíveis à detecção atual.**
Exemplo concreto: Connection `4fa15756`, aba "Janeiro", linhas 76-102:
- 27 linhas contíguas, todas com data `2026-01-22`
- Todas com `banco: UNICRED`
- Descrições: "POSTO BERRES", "VACCARI", "AIRBNB * HMXYHDH (5/6)", "SHOPEE *MAGAZINEDECOR (5/12)", "CACAUSHOW SANTA ROSA (1/2)", "AMAZONMKTPLC*LOJAELECT (5/10)"
- Categorias: Gasolina, Alimentação, Aquisições, Manutenções
- **Este É o bloco de fatura do cartão UNICRED** — completamente ignorado.

**4. A condição de entrada (linha 109) rejeita TUDO.**
```
if (!vendorHasCC && !descHasCC && !vendorHasBank) { i++; continue; }
```
Como `client_vendor = null` e descrições são nomes de comerciantes (não "Fatura CC"), nenhuma linha passa.

---

### Correção — Edge Function `detect-credit-cards`

#### Mudança 1: Ler `raw_data.Banco` como fonte primária do banco

A interface `Transaction` já inclui `raw_data: any`. A detecção deve extrair o banco de `raw_data?.Banco || raw_data?.banco`.

#### Mudança 2: Nova heurística de detecção por bloco (não mais por linha isolada)

Em vez de exigir que a PRIMEIRA linha tenha padrão CC/banco no vendor, a nova abordagem:

1. Agrupar por `(source_tab, date, banco_from_raw_data)` 
2. Para cada grupo com 3+ linhas contíguas do mesmo banco e mesma data:
   - Calcular sinais: presença de parcelas `(X/Y)`, descrições curtas de comerciantes, predominância de negativos, contiguidade
   - Se score ≥ 0.6, aceitar como bloco de cartão
3. Manter a detecção existente por "Fatura CC" como fast-path (alta confiança)

#### Mudança 3: Retorno diagnóstico quando 0/0

Se `blocks.length === 0`, retornar:
```json
{
  "cycles": 0,
  "transactions": 0,
  "status": "no_blocks_found",
  "diagnostic": {
    "totalTransactions": N,
    "tabsScanned": [...],
    "transactionsPerTab": {...},
    "candidateGroups": N,
    "rejectedGroups": [...],
    "suggestion": "..."
  }
}
```

#### Mudança 4: Detecção de parcelas como sinal forte

Regex para `(X/Y)` ou `PARC=` nas descrições — sinal forte de cartão de crédito.

#### Lógica nova de `detectBlocks`:

```text
Para cada tab:
  1. Extrair banco de raw_data.Banco para cada transação
  2. Agrupar linhas contíguas com (mesma data + mesmo banco)
  3. Para cada grupo ≥ 3 linhas:
     a. Contar parcelas (regex (X/Y))
     b. Contar descrições curtas de comerciantes
     c. Contar negativos
     d. Verificar se banco == "UNICRED"|"CRESOL"|etc
     e. Se "Fatura CC" presente → confiança 0.95
     f. Se parcelas ≥ 2 + mesmo banco + ≥ 5 linhas → 0.85
     g. Se mesmo banco + ≥ 3 linhas + >60% negativos → 0.75
     h. Se ≥ 0.6 → aceitar bloco
  4. Blocos < 0.6 vão para diagnostic
```

### Correção — Frontend (Hook + UX)

#### `useCreditCardDashboard.ts`

No `onSuccess`, verificar `data.status === "no_blocks_found"` e mostrar toast de warning com diagnóstico em vez de sucesso falso.

```typescript
onSuccess: (data) => {
  if (data.cycles === 0 && data.transactions === 0) {
    toast.warning("Nenhuma fatura detectada", {
      description: data.diagnostic?.suggestion || "Verifique se a planilha contém blocos de cartão"
    });
  } else {
    toast.success(`${data.cycles} faturas, ${data.transactions} lançamentos`);
  }
}
```

### Arquivos

| Ação | Arquivo |
|------|---------|
| Reescrever | `supabase/functions/detect-credit-cards/index.ts` (lógica de detecção + diagnóstico) |
| Editar | `src/hooks/useCreditCardDashboard.ts` (toast warning para 0/0) |

### Escopo restrito
- Zero novas tabelas ou migrações
- Zero alteração no pipeline de sync/importação
- Zero alteração em outros menus
- Mesma edge function, mesma rota, mesmo payload
- Apenas a lógica de detecção e o feedback ao usuário

