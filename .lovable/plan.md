

## Diagnóstico: Contas a Pagar — Tarifa Zero

### Estrutura da planilha

A aba "Contas a pagar - Tarifa Zero" tem este layout:

```text
Col 0       | Col 1                    | Col 2          | Col 3          | Col 4        | Col 5          | Col 6        | Col 7          | Col 8
Data        | Fornecedor               | Forma pgto/... | JANEIRO        |              | FEVEREIRO      |              | MARÇO          |
Dia 01      | Leonardo                 | 010.562.720-82 | R$ 6.000,00    | Pago Cresol  | R$ 6.000,00    | Pago Cresol  | R$ 7.000,00    | Pago Unicred
Dia 05      | Alexandre                | 51999822840    | R$ 500,00      | Pago Cresol  | R$ 500,00      | Pago Cresol  | R$ 500,00      | Pago Cresol
```

Cada mês ocupa **2 colunas**: valor + status (ex: "Pago Cresol"). Não há sub-headers.

### Problemas identificados (3)

1. **Status não extraído**: O parser encontra o valor via fallback mas ignora a célula seguinte ("Pago Cresol") porque não há sub-headers com labels "valor"/"pgto". Resultado: todos status = "desconhecido", KPIs de "Total Pago" e "Total Pendente" ficam zerados.

2. **Due date "Dia XX" não interpretada**: `parseDate("Dia 01")` falha. Deveria construir a data combinando o dia com o mês do período (ex: "Dia 10" + período 2026-01 → 2026-01-10).

3. **Counterpart/Fornecedor vazio para payables**: O parser só preenche `counterpart` para receivables (linha 1604). Para payables, o fornecedor (col 1) deveria ser o counterpart.

### Solução

**Arquivo**: `supabase/functions/sheets-sync-all-tabs/index.ts`, função `parseAPRHorizontal`

#### 1. Extrair status da célula adjacente ao valor (sem sub-headers)
Quando não há sub-headers, o grupo de cada mês tem padrão: `[valor, status]`. Após encontrar o amount via fallback, verificar se a próxima célula não é numérica — se for texto, tratá-la como `statusRaw`.

#### 2. Parsear "Dia XX" como due_date contextual
Criar lógica para detectar padrão "Dia NN" no campo vencimento e combinar com o period_key de cada mês para gerar a data completa (ex: "Dia 10" + 2026-02 → 2026-02-10).

#### 3. Preencher counterpart para payables
Usar o campo `description` (Fornecedor) também como `counterpart` para registros payable.

#### 4. Extrair banco/forma de pagamento do status
Quando o status é "Pago Cresol" ou "Pago Unicred", extrair "Cresol"/"Unicred" como informação de pagamento e garantir que "pago" seja normalizado corretamente pelo `normalizeAPRStatus`.

### Impacto
- Apenas a função `parseAPRHorizontal` é alterada
- Nenhum outro layout (vertical, block) é afetado
- Nenhum outro fluxo (transações mensais, DRE, forecast) é afetado
- Após deploy, re-sync da planilha corrige os dados

