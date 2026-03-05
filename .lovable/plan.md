

## Plan: Improve Contrast in Drawer Details

The drawer's text labels and values have low contrast due to heavy use of opacity modifiers (`text-muted-foreground/50`, `text-foreground/80`, etc.). I'll increase contrast across all text in the drawer.

### Changes in `src/components/home/CaixaAtualCard.tsx`

**Section headers** (~lines 172, 225): `text-muted-foreground/60` → `text-muted-foreground`

**Per-bank drawer cards (~lines 204-220):**
- "INICIAL" / "FINAL" / "VARIAÇÃO" labels: `text-muted-foreground/50` → `text-muted-foreground/80`
- Opening balance value: `text-foreground/80` → `text-foreground`
- Variation value (negative): `text-destructive/80` → `text-destructive`
- Variation value (positive): `text-foreground/70` → `text-foreground`

**Monthly summary cards (~lines 230-250):**
- "ENTRADAS" / "SAÍDAS" / "RESULTADO" labels: `text-muted-foreground/50` → `text-muted-foreground/80`
- Result negative: `text-destructive/80` → `text-destructive`

