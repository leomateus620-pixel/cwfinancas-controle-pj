

# Aumentar o tamanho da logo na sidebar

## O que muda

A logo no header da sidebar esta pequena (limitada a `max-w-[160px]`). Vamos aumentar o tamanho maximo e o padding do container para que a logo ocupe mais espaco visivel.

## Mudanca unica: `src/components/layout/AppSidebar.tsx` (linha 70)

Alterar a classe da imagem de `max-w-[160px]` para `max-w-[200px]` e aumentar o padding do container de `p-4` para `p-5`, dando mais destaque a logo no header da sidebar.

Quando collapsed, o icone continua compacto (`w-8 h-8`) sem alteracao.

