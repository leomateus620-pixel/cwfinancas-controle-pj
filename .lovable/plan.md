

## Plan: Enlarge Bank Logos in Caixa Atual Card

The bank logos are currently `w-8 h-8` (32px) which is too small. I'll increase them and improve their presentation.

### Changes in `src/components/home/CaixaAtualCard.tsx`

**Main card (lines 92-107):** Change layout to stack logo above bank name (centered), increase logo to `w-12 h-12` (48px):
```
<div className="flex flex-col items-center mb-3">
  <img className="w-12 h-12 rounded-xl object-contain ..." />
  <p className="text-xs font-semibold ...">bank name</p>
</div>
```

**Drawer section (~lines 165-180):** Increase drawer logos from `w-7 h-7` to `w-10 h-10`.

**Fallback icon (no logo):** Scale up to match `w-12 h-12` / `w-10 h-10`.

