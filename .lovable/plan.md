

## Plan: Tornar seção "Personalizar" colapsável

### Mudança

**`src/components/layout/GlobalDateRangeFilter.tsx`** — Único arquivo:

1. Adicionar estado `showCustom` (default `false`)
2. Transformar o título "Personalizar" em um botão clicável com ícone chevron que alterna `showCustom`
3. Envolver inputs de data, calendário e footer em condicional `{showCustom && (...)}`
4. Quando o preset ativo for `"custom"`, abrir automaticamente a seção ao abrir o popover
5. Animar com `transition-all` para suavizar abertura/fechamento

O popover abre compacto mostrando apenas os presets. Ao clicar em "Personalizar", expande para mostrar calendário e inputs.

