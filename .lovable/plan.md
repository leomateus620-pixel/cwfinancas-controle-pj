

## Plan: Corrigir visualização "Por Núcleo" na DRE

### Problema

Quando o usuário alterna para "Por Núcleo", dois bugs ocorrem:

1. **KPIs (cards de resumo)**: O `calculateKPIs` para `LCF_NUCLEO` **ignora o `viewMode`** e sempre usa linhas consolidadas (`nucleo === null`). Os cards nunca mudam.

2. **Detalhamento (accordion)**: O `displayLines` no modo `by_nucleo` mostra **todas as linhas** (consolidadas + AMBIENTAL + PENAL misturadas), resultando em "RECEITA BRUTA TOTAL" aparecendo 3 vezes sem distinção.

### Dados no banco

Cada período tem 3 conjuntos de linhas:
- `nucleo = NULL` → consolidado (~72 linhas)
- `nucleo = "AMBIENTAL"` → (~72 linhas)
- `nucleo = "PENAL"` → (~47 linhas)

### Solução

#### 1. `src/pages/DREPage.tsx`
- No modo `by_nucleo`, filtrar `displayLines` para mostrar **apenas linhas com nucleo NOT NULL** (excluir consolidadas)
- Mostrar KPIs consolidados no topo (não muda — faz sentido manter o total)
- Renderizar o accordion uma vez por núcleo, com título separador visual

#### 2. `src/components/dre/DreDetailsAccordion.tsx`
- Aceitar prop opcional `nucleos?: string[]` e `viewMode?: string`
- Quando `viewMode === "by_nucleo"`, agrupar linhas por nucleo e renderizar seções separadas com cabeçalho de nucleo (ex: "AMBIENTAL", "PENAL") antes de cada bloco
- Manter comportamento atual para modo consolidado

#### 3. `src/components/dre/DreSummaryCards.tsx` — Sem mudanças
Os KPIs consolidados são mantidos no topo em ambos os modos (representam o total da empresa).

#### 4. `src/hooks/useDRE.ts` — Sem mudanças
A lógica de `calculateKPIs` para LCF já usa consolidado, que é o comportamento correto para os cards de resumo.

### Resultado esperado

- **Consolidado**: Exatamente como hoje (72 linhas, KPIs totais)
- **Por Núcleo**: KPIs totais no topo + accordion com seção "AMBIENTAL" (72 linhas) e seção "PENAL" (47 linhas) claramente separadas, sem linhas consolidadas misturadas

### O que NÃO muda
- Pipeline de sync/importação DRE
- Cálculo de KPIs (sempre consolidado)
- Outros templates (DEFAULT, Matricial, SAH, etc.)
- Componentes `DreStoryFlow` e `DreSummaryCards`

