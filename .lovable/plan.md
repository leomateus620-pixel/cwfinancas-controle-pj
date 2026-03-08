

## Fix: Blank Space Bug in Contas a Pagar/Receber Cards

### Root Cause

The CSS rule `.liquid-glass-card > * { position: relative; z-index: 1; }` has higher specificity than Tailwind's `.absolute` class. This forces the three decorative gradient orbs in each card to render as `position: relative` instead of `absolute`. Since these orbs have large dimensions (w-44/h-44, w-36/h-36, w-24/h-24), they occupy vertical flow space, creating the large blank area above the card content.

### Solution

Wrap all three decorative orbs in a single `div` with inline `style={{ position: 'absolute', inset: 0 }}` and `pointer-events-none` so:
- Only ONE direct child is affected by the `> *` rule
- The wrapper uses inline style to guarantee `position: absolute` (inline styles beat class specificity)
- Orbs inside the wrapper are no longer direct children of `.liquid-glass-card`, so they get proper `absolute` positioning

### Files to Change

**`src/components/accounts/PayableCard.tsx`**
- Wrap the 3 decorative orb divs (lines 43-45) in a single absolute container:
```tsx
<div style={{ position: 'absolute', inset: 0 }} className="pointer-events-none overflow-visible">
  <div className="absolute -top-16 -right-16 w-44 h-44 ..." />
  <div className="absolute -bottom-12 -left-12 w-36 h-36 ..." />
  <div className="absolute top-1/2 right-1/4 w-24 h-24 ..." />
</div>
```

**`src/components/accounts/ReceivableCard.tsx`**
- Same wrapping pattern for the 3 emerald-colored orbs (lines 43-45)

### No Other Changes
- No CSS modifications needed
- No layout or AccountsPage changes
- KPIs, toggle, and table remain unchanged

