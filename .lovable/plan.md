

## Diagnóstico: Previsões zeradas (receita_prev_base = 0, despesa_prev_base = 0)

### Problema raiz

A classificação por `movement_type` já está correta (fix anterior funcionou -- Jan: receita 22k, despesa 53k). O problema agora é **matemático**: o algoritmo de projeção gera valores negativos que são clampados a 0.

Dados reais no banco:
- 2026-01: Receita R$ 22k, Despesa R$ 53k
- 2026-02: Receita R$ 68k, Despesa R$ 49k
- **2026-03: Receita R$ 1k, Despesa R$ 12k** (mês corrente, apenas 9 dias)
- **2026-05: Receita R$ 11k, Despesa R$ 0** (transações futuras pré-datadas)

O mês 2026-03 (incompleto) e 2026-05 (futuro sem despesas) arrastam a média e a slope para baixo. A regressão linear fica tão negativa que `recAvg + recSlope * idx` < 0 para todos os meses futuros → `Math.max(0, ...)` = 0.

### Solução (3 correções no `build-forecast`)

#### 1. Excluir mês corrente incompleto
Se `month_key` === mês atual do calendário, excluí-lo da série de projeção (mantê-lo como real para visualização, mas não usar no cálculo de média/slope).

#### 2. Excluir meses futuros
Se `month_key` > mês atual, excluí-lo da série de cálculo.

#### 3. Floor de projeção: usar média quando slope leva a negativo
Quando `recAvg + slope * idx` < `recAvg * 0.3`, usar `recAvg * 0.7` como floor em vez de 0. Isso evita projeções irrealistas enquanto ainda reflete tendência de queda.

### Arquivo: `supabase/functions/build-forecast/index.ts`

Mudanças:
1. Após construir `realData`, determinar o mês corrente (`YYYY-MM`) e filtrar: criar `seriesData` = realData excluindo meses onde `month_key >= currentMonth`
2. Usar `seriesData` (não `realData`) para calcular `receitaSeries`, `despesaSeries`, slopes e médias
3. Na geração de forecast, substituir `Math.max(0, ...)` por um floor baseado na média:
   ```
   const recFloor = recAvg * 0.3;
   const recBase = Math.max(recFloor, (recAvg + recSlope * idx * slopeDampen) * seasonalFactor);
   ```
4. Continuar salvando TODOS os meses reais (incluindo o corrente) no banco para visualização, mas as projeções são baseadas apenas em meses completos

O `lastMonth` para calcular o início das projeções também deve ser ajustado para ser o mês corrente (não o último mês com dados), evitando gaps.

### Nenhuma mudança no frontend ou no `forecast-insights`
Os componentes já estão preparados -- o problema é exclusivamente que `receita_prev_base` e `despesa_prev_base` chegam como 0 do backend.

