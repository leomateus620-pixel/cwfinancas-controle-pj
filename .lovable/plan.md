

# Correcao: Sidebar Desaparecida

## Problema

A sidebar esta "invisivel" porque o estilo `.sidebar-glass` (gradiente dark, borda azul, box-shadow) esta aplicado no div externo fixo do componente Sidebar, mas o div interno (`[data-sidebar="sidebar"]`) tem uma classe `bg-sidebar` que pinta um fundo solido por cima, cobrindo todo o efeito visual. Alem disso, a borda e sombras do div externo ficam atras do div interno.

## Solucao

Adicionar uma regra CSS que torna o fundo do div interno transparente quando esta dentro de `.sidebar-glass`, e mover os estilos visuais principais para serem aplicados corretamente.

## Mudanca Unica

### `src/index.css` — Adicionar regra para o div interno

Adicionar ao bloco `.sidebar-glass`:

```css
.sidebar-glass [data-sidebar="sidebar"] {
  background: transparent !important;
}
```

Isso faz o div interno ficar transparente, revelando o gradiente dark, a borda azul e o box-shadow do div pai (`.sidebar-glass`).

Nenhum outro arquivo precisa ser alterado.
