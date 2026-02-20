

# Corrigir variacao "% vs mes anterior" e calculo do Score de Saude Financeira

## Problema 1: "+0,0% vs mes anterior" sempre zero

A chamada `useTransactions({ startDate: homeStart, endDate: homeEnd })` busca apenas transacoes do mes corrente. Na linha 147 do hook, o filtro `prevMonthTx` tenta encontrar transacoes do mes anterior dentro desse dataset — mas elas nao existem porque nunca foram buscadas do banco.

Resultado: `prevMonthIncome = 0`, `prevMonthExpense = 0`, `prevMonthResult = 0`, e a variacao e sempre 0%.

### Solucao

Expandir o range de busca de transacoes para incluir o mes anterior. Mudar `homeStart` de `startOfMonth(now)` para `startOfMonth(subMonths(now, 1))`, garantindo que as transacoes dos dois meses estejam disponiveis no dataset.

## Problema 2: Resultado Operacional no Score de Saude

O calculo da margem usa `monthResult / monthIncome`. Se `monthResult` e negativo (como -R$ 8,7 mil), a margem e negativa e o score e 0/40. Isso esta correto pela logica atual. Porem, o score total fica distorcido porque o Folego mostra "0 dias" (5/40) e o Resultado mostra 0/40, resultando em score baixo (17).

O calculo em si esta correto — o problema principal e que os dados do mes anterior nao existem, distorcendo a tendencia e a variacao. Com os dados corretos do mes anterior, a tendencia e os alertas tambem passarao a funcionar.

## Mudanca necessaria

| Arquivo | Acao |
|---|---|
| `src/hooks/useHomeDashboard.ts` | Expandir range de busca para incluir mes anterior; tambem expandir para 60 dias atras para trend 30d vs 30d |

### Detalhe tecnico

Linha 68 do `useHomeDashboard.ts`, mudar:

```text
// ANTES:
const homeStart = format(startOfMonth(now), "yyyy-MM-dd");

// DEPOIS:
const homeStart = format(startOfMonth(subMonths(now, 1)), "yyyy-MM-dd");
```

Isso faz com que `useTransactions` busque transacoes do mes anterior E do mes atual. Os filtros internos (`currentMonthTx`, `prevMonthTx`, `last30`, `prev30`) ja existem e funcionarao corretamente com os dados disponiveis.

Adicionalmente, para garantir que a tendencia (30d vs 30d anteriores) tambem funcione, expandir ainda mais o range para cobrir 60 dias atras:

```text
const homeStart = format(subDays(now, 60), "yyyy-MM-dd");
```

Isso cobre: mes anterior completo + 60 dias de tendencia, sem buscar dados desnecessarios.

