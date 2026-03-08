

## Plan: KPIs por nucleo selecionado na DRE LCF

### Problema
No modo "Por Nucleo", os cards de resumo (KPIs) sempre mostram dados consolidados. O usuario quer ver os KPIs do nucleo especifico selecionado.

### Solucao

#### 1. `src/pages/DREPage.tsx`
- Adicionar estado `selectedNucleo` (default: primeiro nucleo disponivel)
- Quando `viewMode === "by_nucleo"`, mostrar um `Select` de nucleo no header (ex: AMBIENTAL, PENAL)
- Filtrar as linhas pelo nucleo selecionado antes de passar para `calculateKPIs`
- Passar `selectedNucleo` para controlar quais linhas vao para os cards e o story flow

Logica de KPIs no modo by_nucleo:
```typescript
const kpiLines = viewMode === "by_nucleo" && selectedNucleo
  ? lines.filter(l => l.nucleo === selectedNucleo)
  : lines;
const kpis = calculateKPIs(kpiLines, viewMode);
```

#### 2. `src/hooks/useDRE.ts`
- Na funcao `calculateKPIs`, quando `viewMode === "by_nucleo"`, usar `calculateLcfKPIs` com as linhas ja filtradas por nucleo (em vez de forcar consolidado)
- Mudar linhas 193-196 para respeitar o viewMode:

```typescript
if (activeTemplate === "LCF_NUCLEO") {
  if (viewMode === "by_nucleo") {
    return calculateLcfKPIs(filtered); // filtered ja vem com nucleo especifico
  }
  const consolidatedLines = lines.filter(l => l.nucleo === null);
  return calculateLcfKPIs(consolidatedLines);
}
```

#### 3. Sem mudancas em:
- `DreSummaryCards` (recebe os mesmos props)
- `DreStoryFlow` (recebe os mesmos props)
- `DreDetailsAccordion` (continua mostrando todos os nucleos no accordion)
- Outros templates de DRE (DEFAULT, SAH, etc.) - nao sao afetados

### Resultado
- Consolidado: comportamento identico ao atual
- Por Nucleo: seletor de nucleo aparece, cards mostram KPIs do nucleo escolhido, accordion continua mostrando todos os nucleos expandiveis

