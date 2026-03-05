

## Plan: Premium Liquid Glass CaixaAtualCard with Bank Logos

### What Changes

1. **Copy bank logo images** into `src/assets/`:
   - `user-uploads://6073235.png` → `src/assets/bank-caixinha.png` (money icon for Caixinha)
   - `user-uploads://HORIZONTAL_PREFERENCIAL_COLORIDA_CMYK.jpg` → `src/assets/bank-sicredi.jpg` (Sicredi logo)

2. **Redesign `CaixaAtualCard.tsx`** with premium liquid glass aesthetic:
   - Each bank sub-card gets a **bank logo/icon** (32x32 rounded) next to the bank name
   - Bank name mapping: if name contains "caixinha" → cash icon, "sicredi" → Sicredi logo
   - Refined typography: bank name in `text-xs font-semibold` with proper letter-spacing
   - Values in `text-[1.6rem]` with `font-bold tracking-tight` — clean, no glow
   - Sub-cards with deeper glass texture: `bg-white/60 dark:bg-card/50 backdrop-blur-xl border border-white/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]`
   - Delta badge refined: smaller pill with subtle background
   - Staggered entry animations maintained
   - Drawer detail view also upgraded with bank logos and cleaner layout

### Files

| File | Action |
|------|--------|
| `src/assets/bank-caixinha.png` | **Copy** from upload |
| `src/assets/bank-sicredi.jpg` | **Copy** from upload |
| `src/components/home/CaixaAtualCard.tsx` | **Edit** — add logo imports, bank logo mapping, premium glass styling |

