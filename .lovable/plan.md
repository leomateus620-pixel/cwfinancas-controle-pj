

## Diagnóstico: Previsões Financeiras com dados zerados

### Problema raiz

A Edge Function `build-forecast` classifica receitas e despesas pelo **sinal do amount** (`tx.amount > 0` = receita, `tx.amount < 0` = despesa). No entanto, **todos os amounts no banco são positivos**. A distinção real está no campo `movement_type` (`INCOME`, `EXPENSE`, `TRANSFER`).

Resultado: despesas sempre = 0, receitas infladas (incluem despesas), e todas as projeções de despesa = R$ 0. Os insights da IA recebem dados distorcidos e geram análises genéricas/alarmistas.

Dados atuais no banco:
- INCOME: 58 transações, total R$ 103k (amounts positivos)
- EXPENSE: 205 transações, total R$ 116k (amounts positivos)
- TRANSFER: 2 transações, total R$ 5.4k

### Plano de correção

#### 1. Edge Function `build-forecast/index.ts` -- Corrigir classificação

Mudar a lógica de agrupamento mensal de:
```ts
if (tx.amount > 0) { m.receitas += ... }
else { m.despesas += ... }
```
Para usar `movement_type`:
```ts
if (tx.movement_type === "INCOME") { m.receitas += ... }
else if (tx.movement_type === "EXPENSE") { m.despesas += ... }
// TRANSFER é ignorado na projeção
```

Também adicionar `movement_type` ao select das transações (`select("date, amount, type, category, movement_type")`).

Ajustar a lógica de categorização para usar `movement_type` em vez do sinal:
```ts
const catKey = `${tx.movement_type === "INCOME" ? "R" : "D"}:${tx.category}`;
```

#### 2. Edge Function `forecast-insights/index.ts` -- Enriquecer prompt da IA

Passar dados mais detalhados ao prompt:
- Receita e despesa reais de cada mês (não apenas médias)
- Top 5 categorias de despesa e receita com valores
- Saldo acumulado projetado
- Meses com margem negativa projetada

Buscar as categorias diretamente das transações para dar contexto real à IA. Isso permite insights acionáveis em vez de genéricos.

Atualizar o prompt para incluir:
- Tabela mensal com receita, despesa e saldo reais
- Tabela de projeções por mês
- Top categorias de despesa com % do total
- Top categorias de receita com % do total
- Solicitar à IA recomendações baseadas nas categorias específicas

#### 3. Frontend -- Melhorias nos componentes

**ForecastKPIs.tsx**: Adicionar KPI de "Saldo Projetado Acumulado" (soma dos saldos previstos) substituindo o KPI de tendência de despesas que é redundante quando não há dados suficientes. Quando `older.length === 0`, mostrar valores absolutos em vez de variações percentuais.

**ForecastChart.tsx**: Conectar a linha real com a linha de previsão no ponto de transição para não haver gap visual entre dados reais e projetados. Adicionar o último ponto real como primeiro ponto da série prevista.

**ForecastCashFlow.tsx**: Mostrar também o acumulado do saldo projetado, não apenas o saldo mensal isolado.

**ForecastInsightsPanel.tsx**: Sem mudanças estruturais -- os dados virão melhores do backend.

### Arquivos modificados
- `supabase/functions/build-forecast/index.ts` (classificação por movement_type)
- `supabase/functions/forecast-insights/index.ts` (prompt enriquecido com categorias e dados mensais)
- `src/components/forecast/ForecastKPIs.tsx` (KPI de saldo acumulado, tratamento de dados insuficientes)
- `src/components/forecast/ForecastChart.tsx` (conexão visual real→previsão)
- `src/components/forecast/ForecastCashFlow.tsx` (saldo acumulado)

