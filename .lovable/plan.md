

## Plano: Correção de bugs UI/UX no menu Cartão de Crédito

### Problemas identificados

1. **Meses duplicados no seletor de ciclos**: "jan de 2026" aparece duas vezes como chips separados (Unicred + Cartão genérico) em vez de agrupados. Causa provável: `period_key` diferente entre ciclos do mesmo mês, ou um deles com `period_key` nulo — o fallback usa `due_date.substring(0,7)` que pode gerar chave diferente.

2. **Cor accent da Unicred muito escura** (`#003366`): Navy profundo fica invisível contra fundo escuro do tema. O dot, o texto do header e o glow do chip selecionado ficam imperceptíveis.

3. **Chip selecionado sem contraste suficiente**: O estado ativo usa `${ac}55` (alpha hex) que com cores escuras fica praticamente transparente. O chip "jan de 2026 Cartão" na screenshot 3-4 tem borda quase invisível.

4. **Header "Cartão Unicred"**: O texto com gradient + drop-shadow usando `#003366` resulta em texto ilegível sobre fundo escuro.

5. **Ícones dos MiniKPIs genéricos**: Os 4 KPIs no header usam ícones repetidos (2x ReceiptText) e cores estáticas sem relação com o brand.

### Correções planejadas

**A. Corrigir agrupamento de meses no `CreditCardCycleSelector`**

Normalizar o `period_key` usando sempre `due_date.substring(0,7)` como chave de agrupamento, ignorando o `period_key` do banco que pode variar entre cards. Isso garante que dois ciclos com vencimento em janeiro se agrupem no mesmo chip.

**B. Atualizar accent color da Unicred no `cardCatalog.ts`**

Trocar `#003366` → `#4DA6FF` (azul claro vibrante) para garantir visibilidade em tema escuro. Ajustar o gradient para manter coerência.

**C. Melhorar contraste do chip ativo no `CreditCardCycleSelector`**

- Aumentar opacidade do background ativo: `${ac}55` → `${ac}88`
- Aumentar brilho do boxShadow
- Adicionar `ring-1` sutil para reforçar borda
- No chip "Todos", aumentar opacidade do background ativo

**D. Melhorar header `CreditCardConnectedHeader`**

- Usar `filter: brightness(1.5)` no texto do brand quando accent é escuro
- Garantir que o drop-shadow tenha opacidade visível
- Diversificar ícones dos MiniKPIs (usar `CreditCard`, `TrendingDown`, `ArrowUpRight`, `Hash`)

**E. Ajustar alinhamento geral**

- Cards de categorias e ciclos: garantir `items-stretch` no grid para alturas iguais
- Espaçamento consistente entre header, seletor e cards
- Melhorar padding do cycle selector container

### Arquivos a editar

| Arquivo | Mudança |
|---------|---------|
| `src/lib/cardCatalog.ts` | Unicred accentColor mais clara |
| `src/components/credit-card/CreditCardCycleSelector.tsx` | Fix agrupamento + melhorar contraste ativo |
| `src/components/credit-card/CreditCardConnectedHeader.tsx` | Fix visibilidade header + ícones MiniKPIs |
| `src/pages/CreditCardPage.tsx` | Ajustes de alinhamento e grid |

