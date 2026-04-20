

## Plano: Carrossel animado de highlights (1 card por vez)

### O que muda

Substituir o grid 2x3 de highlights por um **carrossel automático** que exibe **um card por vez** com animação de transição suave (saída + entrada).

### Solução

**Arquivo:** `src/pages/LandingPage.tsx`

#### 1. Estado e timer de rotação
Adicionar `useState` para o índice ativo e `useEffect` com intervalo de ~4 segundos para avançar automaticamente entre os 6 cards. Adicionar também estado de `isTransitioning` para controlar a fase de saída/entrada.

#### 2. Animação de transição
Cada troca de card segue o ciclo:
1. **Saída** (400ms): card atual faz `opacity: 0 + translateY(20px) + scale(0.95)` com blur sutil
2. **Troca** do índice (instantâneo)
3. **Entrada** (500ms): novo card faz `opacity: 0 → 1 + translateY(-20px) → 0 + scale(0.95 → 1)` com easing `cubic-bezier(0.34, 1.56, 0.64, 1)` (back-out) para sensação premium

CSS via `transition` inline controlado pelo estado `isTransitioning`.

#### 3. Layout do card único
- Card maior que os atuais (ocupa toda a largura da seção de highlights)
- Mesma estética Liquid Glass: gradiente de borda colorido, ícone com glow, tag "Novo"
- Ícone maior (w-14 h-14), título maior (text-base font-bold), descrição com text-sm
- Indicadores de progresso embaixo: 6 dots/pills com o ativo preenchido na cor do card atual (animação de largura)

#### 4. Indicadores de navegação
- Barra de 6 dots horizontais abaixo do card
- Dot ativo: pill expandida (w-6) com cor `accent` do card
- Dots inativos: círculos pequenos (w-2) translúcidos
- Clique no dot avança para aquele card (reseta o timer)

#### 5. Pausar no hover
- `onMouseEnter` pausa o timer automático
- `onMouseLeave` retoma

### Resultado esperado
- Um único card Liquid Glass exibido por vez, trocando automaticamente a cada ~4s
- Transição suave com efeito de profundidade (scale + translate + opacity)
- Dots de navegação interativos
- Mesmo conteúdo dos 6 highlights atuais, apenas apresentação diferente

| Acao | Arquivo |
|------|---------|
| Editar | `src/pages/LandingPage.tsx` |

