
# Home Dashboard: Saude Financeira Ativa + Top Despesas + Alertas + Qualidade do Lucro

## Resumo

Refatorar a Home para que o bloco "Saude Financeira" use calculos reais (sem "Contas a Receber"), melhorar os cards "Top Despesas" e "Alertas", e criar um novo card premium "Qualidade do Lucro" no lugar do "QuickLinks" (ou em uma 4a coluna).

## Mudancas Detalhadas

### 1. Hook `useHomeDashboard.ts` - Refatorar calculos

**Saude Financeira (3 fatores, pesos 40/40/20):**

- **Resultado do Periodo (peso 40):** Receitas Operacionais - Despesas Operacionais (exclui TRANSFER). Score: margem > 20% = 40, > 10% = 25, > 0 = 15, <= 0 = 0.
- **Folego de Caixa (peso 40):** `CaixaAtual / (abs(despesas_operacionais) / dias_com_dados)`. Se queima = 0 e caixa > 0 = 40. Se caixa <= 0 = 0. Se > 90 dias = 40, > 60 = 30, > 30 = 15, else 5.
- **Tendencia (peso 20):** Comparar resultado dos ultimos 30 dias vs 30 dias anteriores. Melhorando (> +5%) = 20, Estavel (-5% a +5%) = 12, Piorando (< -5%) = 4.

Remover "Contas a Receber" completamente do calculo.

**Alertas (baseados em dados reais):**
1. Folego baixo: folego < 30 dias
2. Concentracao de despesas: Top1 categoria > 40%
3. Queda de receita: receita ultimos 30d caiu > 20% vs 30d anteriores
4. Divergencia DRE: quando houver dados DRE e diff > 15%

**Top Despesas:** Aumentar para Top 5 categorias (ja retorna 5 de `usePeriodMetrics`, mas o hook atual calcula apenas 3). Adicionar link "Ver detalhes" que navega para `/expenses`.

**Qualidade do Lucro (novo KPI):**
- Formula: `(Fluxo de Caixa Operacional / Lucro Liquido DRE) * 100`
- Fluxo de Caixa Operacional = Receitas Operacionais - Despesas Operacionais (das transacoes)
- Lucro Liquido = Lido da aba DRE (linha "RESULTADO MES" ou "Lucro Liquido")
- Se nao houver DRE: exibir "--" com tooltip explicativo
- Comparacao vs mes anterior
- Mini sparkline dos ultimos meses disponiveis

### 2. Componente `HealthScore.tsx` - Atualizar fatores

- Atualizar tooltip para refletir os 3 fatores (Resultado 40pts, Folego 40pts, Tendencia 20pts)
- Exibir labels: "Resultado operacional", "Folego de caixa", "Tendencia"
- Adicionar indicador de tendencia (seta + texto "Melhorando/Estavel/Piorando")

### 3. Componente `TopCategories.tsx` - Melhorar

- Aumentar para 5 categorias
- Adicionar valor formatado com 2 casas (usar `formatCurrencyBR`)
- Adicionar botao "Ver detalhes" que navega para `/expenses`

### 4. Componente `AlertsPanel.tsx` - Sem mudancas estruturais

Os alertas ja sao gerados no hook. Apenas ajustar a logica no hook para os 4 tipos definidos.

### 5. Novo Componente: `ProfitQuality.tsx`

Card premium com:
- Gauge circular ou valor grande "XX%"
- Subtexto "Conversao de lucro em caixa"
- Badge de variacao vs mes anterior
- Mini sparkline (recharts `ResponsiveContainer` + `Line`) dos ultimos 6-12 meses
- Faixas: > 100% Excelente (verde), 70-100% Normal (azul), < 70% Alerta (amber)
- Se nao houver DRE: estado vazio elegante com orientacao

### 6. `HomePage.tsx` - Reorganizar layout

Layout do bottom row (3 colunas):
- Coluna 1: Top Despesas
- Coluna 2: Alertas
- Coluna 3: Qualidade do Lucro (substitui QuickLinks)

QuickLinks sera removido do bottom row. Os atalhos ja existem na sidebar.

## Detalhes Tecnicos

### Fonte de dados para Qualidade do Lucro

O hook `useDRE` ja tem `calculateKPIs()` que retorna `resultado` (lucro liquido). Para obter dados mensais, sera necessario buscar os periodos DRE dentro do intervalo selecionado e calcular o resultado por mes.

No `useHomeDashboard`, adicionar:
1. Query aos `dre_periods` + `dre_lines` para os meses do periodo
2. Para cada mes: extrair lucro liquido via `calculateKPIs` logica inline
3. Calcular fluxo de caixa operacional do mesmo mes (ja disponivel via transacoes)
4. Dividir: `profitQuality = (cashFlowOperacional / lucroLiquidoDRE) * 100`

### Consistencia com periodo selecionado

A Home atualmente usa `startOfMonth(now)` / `endOfMonth(now)` fixo. As mudancas devem respeitar isso (a Home mostra sempre o mes corrente, diferente do Dashboard que usa o filtro global). Os calculos de tendencia usam os ultimos 30 dias vs 30 dias anteriores, independente do filtro global.

## Arquivos criados/modificados

| Arquivo | Acao |
|---|---|
| `src/hooks/useHomeDashboard.ts` | Refatorar: remover receivables do health, novo calculo 3 fatores (40/40/20), top 5 categorias, alertas melhorados, dados para Qualidade do Lucro |
| `src/components/home/HealthScore.tsx` | Atualizar tooltip, labels dos fatores, indicador de tendencia |
| `src/components/home/TopCategories.tsx` | Top 5, botao "Ver detalhes" |
| `src/components/home/ProfitQuality.tsx` | **CRIAR** - Novo card Qualidade do Lucro com gauge + sparkline |
| `src/pages/HomePage.tsx` | Reorganizar bottom row: TopCategories + Alertas + ProfitQuality, remover QuickLinks, limpar referencia a receivables nos insights |
