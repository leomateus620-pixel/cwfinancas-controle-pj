

## Plano: Reestruturar "Evolução do Caixa" com dados do "Caixa Atual"

### Problema atual

O gráfico "Evolução do Caixa" usa dados de transações acumuladas (dia 5 de cada mês). O card "Caixa Atual" usa a tabela `bank_balances` com saldos reais por banco/mês. Os dois não são consistentes.

### Arquitetura proposta

**1. Novo hook centralizado: `src/hooks/useCashPosition.ts`**

Consulta TODOS os registros de `bank_balances` (sem filtro de período) para o usuário. Retorna:
- `positionHistory`: array cronológico com estrutura por período, contendo contas individuais e total consolidado
- `accountNames`: lista dinâmica de contas distintas encontradas
- `isLoading`, `isEmpty`

Estrutura do dado:
```typescript
interface CashPositionPeriod {
  period: string;        // "2025-12"
  label: string;         // "Dez/25"
  totalBalance: number;  // soma dos closing_balance
  accounts: Record<string, number | null>; // { "Sicredi": 49500, "Asaas": 21500 }
}
```

Pipeline de saneamento:
- Trim e normalização de `bank_name`
- Conversão para number, proteção contra NaN
- Deduplicação por `bank_name + period_key`
- Ordenação cronológica
- `null` para conta ausente em um período (não 0)

**2. Refatorar `useHomeDashboard.ts`**

- Remover o bloco `allTxForCash` e `cashPositionTrend` (linhas 134-186)
- Importar `useCashPosition` e expor `cashPositionHistory` e `accountNames` no retorno
- Manter todo o restante intacto

**3. Reescrever `CashEvolutionChart.tsx`**

Nova interface de props:
```typescript
interface CashEvolutionChartProps {
  data: CashPositionPeriod[];
  accountNames: string[];
  insights: string[];
  delay?: number;
}
```

Gráfico com múltiplas linhas:
- Até 2 `<Line>` (uma por conta), com cores distintas (azul primário + verde)
- `<Area>` preenchida sutil apenas para o total consolidado (ou conta principal)
- Quando só 1 conta: renderiza apenas 1 linha
- `connectNulls={false}` para tratar ausência real de conta
- Tooltip premium customizado: mês, nome de cada conta, saldo, total consolidado, variação vs mês anterior
- Legenda responsiva com nome das contas
- Eixo Y com `formatCompactBR`
- Eixo X com `interval` adaptativo (menos labels em mobile)

Visual premium:
- Gradientes por conta com cores de banco (reutilizar `getBankColor`)
- Dots refinados (r=3, hover r=5)
- Animação de entrada suave (1200ms)
- Skeleton loading quando `data.length === 0 && !isEmpty`
- Empty state elegante quando `isEmpty`
- Grid lines discretas, apenas horizontais

**4. Atualizar `HomePage.tsx`**

- Passar `cashPositionHistory` e `accountNames` ao `CashEvolutionChart`
- Adaptar geração de `insights` para usar dados de `bank_balances`:
  - Variação percentual entre últimos 2 meses
  - Detecção de 3 meses consecutivos de queda/alta
  - Posição do último mês disponível
  - Detecção de volatilidade
  - Guard para histórico insuficiente (<2 meses)

**5. Responsividade**

- Mobile: altura do gráfico 120px, XAxis com interval maior, legenda colapsada
- Tablet: altura 140px
- Desktop: altura 160px
- Tooltip adaptado para toque
- Sem overflow horizontal

### Arquivos modificados

| Arquivo | Ação |
|---|---|
| `src/hooks/useCashPosition.ts` | **Novo** — hook centralizado |
| `src/hooks/useHomeDashboard.ts` | Remover lógica de `cashPositionTrend`, usar `useCashPosition` |
| `src/components/home/CashEvolutionChart.tsx` | Reescrever com multi-line, tooltip premium, responsivo |
| `src/pages/HomePage.tsx` | Adaptar props e insights |

### Consistência garantida

- "Caixa Atual" e "Evolução do Caixa" ambos leem de `bank_balances`
- O total do último mês no gráfico = soma dos `closing_balance` do mesmo mês no card
- Sem dados mockados, sem fonte paralela

