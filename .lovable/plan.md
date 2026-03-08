

## Plan: Improve Header Text Contrast in Caixa Atual Card

The "CAIXA ATUAL" label and "Março 2026" subtitle use low-opacity classes making them nearly invisible.

### Changes in `src/components/home/CaixaAtualCard.tsx`

- **"CAIXA ATUAL"** (~line 64): `text-muted-foreground` → `text-foreground/80` — stronger contrast
- **"Março 2026"** (~line 67): `text-muted-foreground/40` → `text-muted-foreground/70` — visible but still secondary
- **Wallet icon** (~line 61): `text-muted-foreground` → `text-foreground/60` — slightly bolder to match

