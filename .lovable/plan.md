

## Plan: Show Saldo Inicial and Saldo Final per Bank in Caixa Atual Card

Currently each bank sub-card only displays the closing balance as a big number, with the delta shown as a small badge. The user needs both **Saldo Inicial** and **Saldo Final** clearly visible, matching the spreadsheet layout.

### Changes in `src/components/home/CaixaAtualCard.tsx`

**Replace the current single-value layout (lines ~182-222) with a structured layout per bank card:**

1. Keep bank logo + name at the top (centered)
2. Below, show a **2-column grid** with labeled values:
   - **Saldo Inicial** — `opening_balance` formatted with `formatCompactBR`
   - **Saldo Final** — `closing_balance` formatted with `formatCompactBR` (slightly larger/bolder to emphasize)
3. Below the grid, show the **delta badge** (existing % change between opening → closing)

```text
┌──────────────────────┐
│     [Logo/Icon]      │
│     SICREDI          │
│                      │
│  Saldo Inicial       │
│  R$ 4.682,49         │
│                      │
│  Saldo Final         │
│  R$ 209,06           │
│                      │
│        ▼ -95.5%      │
└──────────────────────┘
```

The Saldo Final value will be the prominent number (larger font), and Saldo Inicial will be slightly smaller but clearly labeled and visible. The delta badge stays as context.

No changes to hooks or edge functions — all data (`opening_balance`, `closing_balance`) is already fetched and available in `rows`.

