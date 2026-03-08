

## Plan: Melhorar Seletor de Período

### Problema atual
O seletor usa dois calendários `mode="single"` separados (Início e Fim), o que exige múltiplos cliques e não oferece feedback visual do intervalo selecionado. A experiência é desconectada.

### Solução
Substituir os dois calendários por **um único calendário `mode="range"`** do `react-day-picker`, que permite selecionar início e fim com dois cliques no mesmo componente, com highlight visual do intervalo entre as datas. Também melhorar o layout geral do popover.

### Mudanças

**`src/components/layout/GlobalDateRangeFilter.tsx`** — Único arquivo:

1. **Calendário range unificado**: Trocar os dois `Calendar mode="single"` por um único `Calendar mode="range" numberOfMonths={2}` que exibe 2 meses lado a lado
2. **Seleção visual**: O `react-day-picker` em mode range automaticamente destaca o intervalo entre as datas com background colorido
3. **Inputs de data**: Adicionar dois campos de texto (dd/mm/aaaa) acima do calendário mostrando as datas selecionadas, para referência rápida e edição direta
4. **Presets mais descritivos**: Adicionar subtítulo com o range resultante abaixo de cada preset ao fazer hover
5. **Feedback visual**: Mostrar o range selecionado formatado no rodapé antes de "Aplicar"
6. **Liquid Glass**: Manter o estilo glass do popover, aplicar nos inputs de data

### Fluxo do usuário
1. Clica no trigger → abre popover
2. Pode escolher preset (aplica imediato) OU
3. Na seção "Personalizar": vê 2 meses, clica na data início, clica na data fim → range destacado visualmente → clica "Aplicar"

### O que NÃO muda
- `DateRangeContext` (toda a lógica de estado, persistência e URL sync)
- Rotas permitidas
- Presets disponíveis

