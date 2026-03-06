

## Plan: Premium Liquid Glass Redesign — Card "Caixa Atual"

### Overview

Full visual redesign of `CaixaAtualCard.tsx` and supporting CSS in `index.css`, elevating the component to an Apple-inspired Liquid Glass premium aesthetic while preserving all functional architecture (data, hooks, logos, drawer, month selector, comparison bar).

### 1. New CSS Classes in `src/index.css`

Add dedicated premium glass classes at the end of the file:

- **`.liquid-glass-caixa`** — outer card: higher blur (32px), multi-layer borders with subtle blue luminance, refined inset shadow with white highlight on top + left, noise texture overlay via `::after`, gentle gradient sheen via `::before`
- **`.liquid-glass-bank-card`** — inner bank sub-cards: lower blur (16px) for hierarchy, translucent white bg, luminous border with opacity gradient, subtle inset glow, smooth hover with slight scale + border brightening (200ms)
- **`.liquid-glass-chip`** — month selector pills: glass background, subtle border, refined active state with primary tint
- **`.liquid-glass-detail-card`** — drawer detail cards: consistent glass treatment

### 2. Component Redesign in `src/components/home/CaixaAtualCard.tsx`

**A. Bank name color mapping — new helper function `getBankColor()`:**
```typescript
function getBankColor(name: string): { text: string; accent: string } {
  const n = name.toLowerCase();
  if (n.includes("asaas")) return { text: "text-[#1a56db]", accent: "bg-[#1a56db]/8" };
  if (n.includes("sicredi")) return { text: "text-[#2d8c3c]", accent: "bg-[#2d8c3c]/8" };
  if (n.includes("caixinha")) return { text: "text-[#8b6914]", accent: "bg-[#8b6914]/8" };
  return { text: "text-foreground/70", accent: "bg-muted/30" };
}
```

**B. Outer card wrapper:**
- Replace `GlassCard variant="highlight"` with a custom div using `liquid-glass-caixa` class
- Add `relative overflow-hidden` for pseudo-element effects
- Increase padding to `p-6 md:p-8` for more breathing room

**C. Header refinement:**
- Wallet icon in a glass pill with subtle gradient background
- "Caixa Atual" label with slightly larger tracking, `text-[12px]`
- Period subtitle with improved opacity `text-foreground/50`

**D. Month selector chips:**
- Use `liquid-glass-chip` class
- Active state: glass bg with primary border glow
- Inactive: subtle glass with hover transition

**E. Bank sub-cards — major visual upgrade:**
- Use `liquid-glass-bank-card` class (replaces inline styles)
- Logo area: add subtle glass background pill behind logo
- Bank name: use `getBankColor()` for brand-colored typography, `text-[11px] font-bold uppercase tracking-[0.15em]`
- Reorder values: **Saldo Final first** (primary visual), then Saldo Inicial (secondary)
- Saldo Final: `text-2xl md:text-3xl font-extrabold tabular-nums tracking-tight`
- Saldo Inicial: `text-sm font-medium text-foreground/60 tabular-nums` with "Saldo Inicial" label at `text-[9px]`
- Labels: refined with `text-[9px] font-semibold uppercase tracking-[0.2em] text-foreground/40`
- Delta badge: pill with glass background, refined colors (emerald for positive, soft red for negative), no harsh destructive color
- Add subtle separator line between saldo final and saldo inicial using `border-t border-white/30`
- More spacing: `space-y-3` and `p-6` padding

**F. Comparison bar refinement:**
- Glass pill background
- Better label/value separation
- Arrow icon with smoother animation

**G. "Ver detalhes" link:**
- Glass-style hover underline
- Slightly larger text `text-[11px]`
- Smooth icon transition

**H. Drawer content upgrade:**
- Section headers with glass separator lines
- Detail bank cards use `liquid-glass-detail-card` class
- Grid values with better spacing and hierarchy
- "Movimentações do Mês" cards with glass treatment
- Resultado value: colored based on positive/negative with glass badge

### 3. Microinteractions

- Bank cards: `transition-all duration-300 ease-out` on hover with `hover:scale-[1.01]` and border brightening
- Month chips: color transition 200ms
- Drawer open: existing Vaul animation (no change needed)
- Values: existing `animate-fade-in-up` with staggered delays (keep)

### Files Modified

1. **`src/index.css`** — Add ~60 lines of new premium glass CSS classes
2. **`src/components/home/CaixaAtualCard.tsx`** — Full visual class replacement + `getBankColor()` helper + reordered layout hierarchy

### What Does NOT Change

- All hooks (`useBankBalances`, `useAllBankBalancePeriods`)
- Logo positions, format, and imports
- Data structure and calculations
- Drawer functionality
- Month selector logic
- Comparison bar logic
- Component props and exports

