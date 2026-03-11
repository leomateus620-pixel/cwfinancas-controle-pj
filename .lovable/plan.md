

## Plano: Evolução do Caixa — Posição no dia 5 de cada mês

### Problema

1. **"Invalid Date"**: O tooltip usa `new Date(l + "T00:00:00")` onde `l` é a label do eixo X. Se `l` não for uma string `yyyy-MM-dd` válida, retorna "Invalid Date".
2. **Dados sem sentido**: O gráfico atual mostra saldo acumulado diário dos últimos 30 dias (cumulative sum de entradas/saídas). Não reflete a posição real de caixa da empresa.
3. **Título enganoso**: "Resumo do Dia" com seletores de 7d/14d/30d não comunica nada útil.

### Solução: "Evolução do Caixa"

Transformar o componente em um gráfico de **posição de caixa no dia 5 de cada mês**, mostrando a fotografia real do saldo acumulado até o 5º dia de cada mês disponível nos dados.

**Lógica de dados** (no `useHomeDashboard`):
- Buscar TODAS as transações do usuário (sem filtro de período) com select mínimo
- Para cada mês com dados, calcular o saldo acumulado até o dia 5 (inclusive)
- Gerar array: `{ month: "2025-01", label: "Jan/25", value: 45320.50 }`
- Seletores mudam de 7d/14d/30d para **6m / 12m / Tudo**

**Cálculo do saldo no dia 5**:
- Para cada mês M, somar todas as transações operacionais com `date <= "M-05"`
- O saldo é cumulativo desde o início dos dados até o dia 5 daquele mês

**Design upgrade**:
- Título: "Evolução do Caixa" com subtítulo "Posição no dia 5 de cada mês"
- Gráfico de área com gradiente (não apenas linha)
- Dots visíveis nos pontos de dados
- Tooltip com mês formatado ("Jan/25") e valor em R$
- Área preenchida com gradiente azul→transparente
- Seletores: 6m, 12m, Tudo

**Insights upgrade** (escritas melhoradas):
- Comparar último mês vs anterior: "Seu caixa cresceu 12,3% entre Fev e Mar."
- Tendência de 3 meses: "Tendência positiva nos últimos 3 meses."
- Valor absoluto: "Posição atual: R$ 89.721,14 em 05/Mar."

### Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `src/hooks/useHomeDashboard.ts` | Nova query para posição de caixa no dia 5; substituir `dailyTrend` por `cashPositionTrend` |
| `src/components/home/DailySummary.tsx` | Renomear para `CashEvolutionChart.tsx` — novo design com área, seletores 6m/12m/Tudo, tooltip corrigido, título e subtítulo atualizados |
| `src/pages/HomePage.tsx` | Atualizar import e props; melhorar geração de insights com dados da posição de caixa |

