

## Plan

### Task 1: Clean up DRE empty state design
**File:** `src/pages/DREPage.tsx` (lines 139-159)

Remove the "Formatos aceitos" block (lines 145-153) with the bullet list. Replace the entire empty state card with a cleaner, more professional liquid glass design:
- Keep the icon, title, and description
- Remove the `bg-muted/30` box with format list entirely
- Add subtle decorative gradient elements for polish
- Keep the "Importar DRE" button

### Task 2: Change KPI resultado priority — "Lucro Líquido" before "Resultado do Exercício"
**File:** `src/hooks/useDRE.ts` (lines 306-312)

The current priority order for finding the final result is:
```
1. "resultado do exercicio"  ← picks line 97 (after distributions)
2. "resultado exercicio"
3. "resultado final"
4. "lucro liquido"           ← this is what we want (line 92)
```

Change the order to:
```
1. "lucro liquido"           ← now first priority (line 92)
2. "resultado do exercicio"  ← fallback if no lucro liquido
3. "resultado exercicio"
4. "resultado final"
```

This works because:
- In "Sonho de Consumo", both "LUCRO LÍQUIDO" (line 92) and "RESULTADO DO EXERCÍCIO" (line 97) exist. By checking "lucro liquido" first, we get line 92.
- In other DREs that only have "resultado do exercicio" (no "lucro liquido" line), it still falls through to the correct value.
- DREs that only have "lucro liquido" already work since it was in the chain.
- LCF and other specialized templates use their own `calculateLcfKPIs` function, completely unaffected.

### Files to modify
| File | Change |
|------|--------|
| `src/pages/DREPage.tsx` | Remove "Formatos aceitos" block, polish empty state |
| `src/hooks/useDRE.ts` | Reorder resultado lookup: lucro liquido → resultado do exercicio |

