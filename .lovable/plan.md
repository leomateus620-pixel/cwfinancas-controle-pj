## Objetivo

Restaurar exatamente o alinhamento e a respiração da tela inicial conforme estavam antes da adição do Card 3D (versão do print enviado), mantendo o novo carrossel com os 2 cards 3D (Demanda Inteligente + Dashboard), e reduzir drasticamente os efeitos de luz ao redor do card para algo sutil e polido — sem aquele "halo" exagerado.

## O que mudar

### 1. `src/pages/LandingPage.tsx` — voltar layout original

- Grid: `lg:grid-cols-[1fr_1.1fr]` (era `1.05fr_1fr`)
- Gap: `gap-8 lg:gap-12` (era `lg:gap-16 xl:gap-20`)
- Remover `lg:pl-4 xl:pl-8` do wrapper da coluna direita

Isso devolve à coluna esquerda a largura natural (textos, highlights e CTAs deixam de ficar retraídos) e reaproxima o card 3D para o centro óptico da tela, como no print.

### 2. `src/components/landing/HeroMockCarousel.tsx` — efeitos sutis

Substituir o sistema de 5 camadas atual (conic haze + fresnel lateral + caustic floor + contact shadow + specular arc) por uma versão **mínima e refinada**, mais próxima do print original:

- **Halo único e suave**: 1 radial `blur(80px)` com `opacity ~0.18`, paleta do slide ativo, atrás do card. Sem conic gradient, sem saturação alta.
- **Contact shadow**: sombra curta abaixo (`h-2`, blur 14px, opacity 0.25) para ancorar o card.
- **Specular arc no topo**: mantido, mas com `opacity 0.35` em vez de 0.55.
- **Remover**: fresnel lateral esquerda/direita (causavam o "blur azul" reclamado), conic haze, caustic floor saturado.
- Transição de tonalidade entre slides via `transition: opacity/background 700ms`.

Resultado: o card "flutua" com leveza, sem competir visualmente com o texto à esquerda.

### 3. Manter intacto

- `MockDemandCard.tsx` e `MockDashboardCard.tsx` (sem alterações)
- Carrossel: autoplay 6.5s, pausa no hover, dots, swipe, `prefers-reduced-motion`
- Tudo o que está em volta (logo, hero, highlights carousel, CTAs, footer)

## Arquivos editados

- `src/pages/LandingPage.tsx` (3 ajustes de classe no grid e wrapper)
- `src/components/landing/HeroMockCarousel.tsx` (simplificação do bloco de efeitos)

## Validação

Após implementar: comparar visualmente com o print — coluna esquerda com mesma largura/respiração, card 3D centralizado no lado direito, halo discreto.