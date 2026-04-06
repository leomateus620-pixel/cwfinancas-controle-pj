

## Plano: Refatoração Premium do Menu Cartão de Crédito — Estado Dinâmico + Ciclo Selecionado

### Diagnóstico

**Estado atual**: O hero aparece SEMPRE (com e sem dados). Não há seletor de ciclo — todos os KPIs, categorias e lançamentos mostram dados agregados de todos os ciclos juntos. O hook retorna `latestCycle` mas a página não usa para filtrar.

### Arquitetura de Mudanças

```text
┌─ SEM DADOS ──────────────────────────────────┐
│  CreditCardHero (onboarding, CTA, 3D card)   │
└──────────────────────────────────────────────┘

┌─ COM DADOS ──────────────────────────────────┐
│  ConnectedHeader (3D card + fatura recente)   │
│  CycleSelector (tabs: Mar/26, Fev/26, Todos) │
│  KPIs (filtrados por ciclo)                   │
│  Categorias + Lançamentos (filtrados)         │
│  Review Queue                                 │
└──────────────────────────────────────────────┘
```

### Mudanças

#### 1. Novo componente `CreditCardConnectedHeader`

Header horizontal premium com duas colunas:
- **Esquerda**: `CreditCard3D` usando o asset do banco detectado no ciclo selecionado (via `cardCatalog`)
- **Direita**: Nome do cartão, banco, vencimento da fatura mais recente, valor líquido, quantidade de lançamentos, reembolsos, status badge, botão "Reprocessar"

Substitui o `CreditCardHero` quando `hasData === true`.

#### 2. Novo componente `CreditCardCycleSelector`

Barra horizontal de chips/tabs para selecionar ciclo:
- Ciclo mais recente selecionado por padrão
- Labels: "Mar/2026", "Fev/2026", etc. (derivados de `due_date`)
- Opção "Todos" como última tab (visão secundária)
- Visual: chips pill com estado ativo/inativo em liquid glass

#### 3. Refatorar `CreditCardPage.tsx`

- Estado `selectedCycleId: string | "all"` (default = `cycles[0]?.id`)
- Quando `hasData`: renderizar `ConnectedHeader` + `CycleSelector` em vez do Hero
- Quando `!hasData`: manter Hero atual
- Derivar `filteredTransactions`, `filteredCategories`, `filteredKPIs` com base no ciclo selecionado
- Ao trocar ciclo: atualizar cartão 3D (brand do ciclo), KPIs, categorias, lançamentos

#### 4. Refatorar KPIs por ciclo

Quando um ciclo específico está selecionado, KPIs vêm do ciclo:
- `grossAmount` = `cycle.gross_amount`
- `netAmount` = `cycle.net_amount`
- `reimbursementAmount` = `cycle.reimbursement_amount`
- `transactionCount` = transações filtradas
- `cycleCount` = 1 (ou total se "Todos")

Quando "Todos": manter agregação atual.

#### 5. Categorias filtradas por ciclo

O `useMemo` de `categories` atualmente agrega todas as transações. Mover para dentro da página e filtrar por `selectedCycleId`. Melhorar layout: legendas maiores, spacing, truncamento com tooltip.

#### 6. Lançamentos filtrados por ciclo

A tabela já mostra `filteredTx` — adicionar filtro por `cycle_id` antes do filtro de busca.

#### 7. Animação do gráfico de categorias

Adicionar `animationBegin` e `animationDuration` ao Pie para entrada suave. Sombra sutil via `filter: drop-shadow` no container SVG.

### Arquivos

| Ação | Arquivo |
|------|---------|
| Criar | `src/components/credit-card/CreditCardConnectedHeader.tsx` |
| Criar | `src/components/credit-card/CreditCardCycleSelector.tsx` |
| Reescrever | `src/pages/CreditCardPage.tsx` (estado dinâmico + filtros por ciclo) |
| Preservar | `src/components/credit-card/CreditCardHero.tsx` (usado apenas no empty state) |
| Preservar | `src/components/credit-card/CreditCard3D.tsx` (reutilizado no connected header) |
| Preservar | `src/hooks/useCreditCardDashboard.ts` (sem alterações) |
| Preservar | `src/lib/cardCatalog.ts` (sem alterações) |

### Escopo restrito
- Zero alteração no hook, edge function, tabelas ou detecção
- Zero novos assets — usa os 4 assets de banco já existentes via `cardCatalog`
- Zero impacto em outros menus/páginas
- Lógica de filtragem por ciclo é 100% frontend (useMemo)

