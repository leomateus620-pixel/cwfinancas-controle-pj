

# Correcao: Sidebar posicionada no fundo da tela

## Problema

A classe `.sidebar-glass` esta aplicada no div externo do componente `<Sidebar>`. Esse div externo **nao tem posicionamento fixo** — ele e apenas um "spacer" que reserva espaco no layout. O div que realmente renderiza a sidebar visivel e o div filho com `fixed inset-y-0`.

Resultado: os estilos visuais (gradiente dark, borda azul) ficam no spacer invisivel, e o div fixo (que aparece na tela) fica sem fundo, "flutuando" na posicao errada.

## Solucao

Mover os estilos visuais do `.sidebar-glass` para que atinjam o div fixo interno, nao o div externo.

### Mudanca unica: `src/index.css`

Alterar o seletor `.sidebar-glass` para aplicar os estilos visuais no div fixo interno que contem `[data-sidebar="sidebar"]`:

**Antes:**
```css
.sidebar-glass {
  background: linear-gradient(...);
  border-right: ...;
  box-shadow: ...;
  position: relative;
}
.sidebar-glass::after { /* noise texture */ }
.sidebar-glass > * { position: relative; z-index: 1; }
.sidebar-glass [data-sidebar="sidebar"] { background: transparent !important; }
```

**Depois:**
- `.sidebar-glass` fica sem estilos visuais (apenas container)
- `.sidebar-glass > div:last-child` (o div fixo) recebe o gradiente, borda e shadow
- `.sidebar-glass > div:last-child::after` recebe a textura noise
- `.sidebar-glass [data-sidebar="sidebar"]` continua transparente

Isso garante que os estilos visuais fiquem no div `fixed inset-y-0` que e realmente visivel na tela, na posicao correta (lateral esquerda, altura total).

