
# Plano — Upgrade "AI Chip" para versão Premium dimensional

## Diagnóstico

Hoje o chip está pequeno (slot 132×96) com viewBox 240×120, sem profundidade visual e sem hierarquia de elementos. Compete em tamanho com o ícone Lucide dos outros slides ao invés de ser uma cena cinematográfica.

## O que muda

### 1. Redesenho do chip — `src/components/landing/AIChipPulse.tsx`

Reescrita do componente para um visual **2x maior, dimensional e premium**, mantendo a mesma API (`accent`, `active`).

**Chip central (escala 2.5x maior):**
- Corpo 60×60 (antes 30×30) com cantos rx=11, ocupando posição dominante
- **Bevel highlight** (gradiente vertical claro→escuro) simulando topo iluminado
- **Painel interno embutido** mais escuro com leve sheen radial diagonal
- **Traços de circuito** ornamentais nos 4 cantos do painel
- **16 pinos longos** (4 por lado, antes eram 12 curtos) com sheen metálico em cada pino
- **"AI" tipografado** no centro em fonte black, branco luminoso com `drop-shadow` colorido — substitui o ícone sparkle anterior
- Sparkle largo desbotado **atrás** do texto AI como auréola
- Marcador de orientação (ponto branco no canto sup-esquerdo)
- Sombra projetada abaixo do chip

**Halo e glow em camadas:**
- **Halo atmosférico externo** (radial gradient, ~80px de raio, blur forte) que pulsa suavemente
- **Glow interno** próximo ao chip que pulsa intensamente na sístole
- Texto "AI" tem brilho próprio que aumenta no batimento

**Anel orbital:**
- Círculo tracejado em volta do chip (raio 50) com 3 marcadores luminosos rotacionando lentamente — sensação de "sistema vivo"

**Linha de ECG:**
- Trace estilo eletrocardiograma na parte inferior do canvas que "rola" continuamente, com opacidade pulsando junto ao batimento

**Veias enriquecidas (10 paths):**
- 6 veias principais (stroke 1.8) + 4 capilares (stroke 1.2)
- Distribuídas em **todas as direções** (incluindo loops superior/inferior e tendrils à esquerda) — não mais só para a direita
- Cada batimento dispara **2 pulsos por veia principal** (antes 1) — densidade visual muito maior
- Total de até **32 pulsos simultâneos** percorrendo a rede

**Shockwaves duplas:**
- Dois anéis (um colorido, um branco) expandindo com 110ms de defasagem — efeito tipo "lub-dub" visual sincronizado com o batimento

**Partículas atmosféricas:**
- 10 pontos de luz flutuando (antes 6), tamanhos variados, distribuídos por todo o canvas

### 2. Slot maior no card — `src/pages/LandingPage.tsx`

- Aumentar o slot da cena de **132×96 para 200×150**
- Aumentar `min-h` do card de **140px para 170px** (afeta todos os slides para evitar saltos no carrossel)
- ViewBox do SVG passa de 240×120 para **280×200** (mais espaço para veias respirarem)

## Física preservada

Todo o sistema de física (gaussiana dupla para o batimento, drag nos pulsos, easing cúbico nas shockwaves, sort por novidade para priorizar pulsos brilhantes) é mantido e refinado:
- Período do batimento: 880ms (~68bpm, ligeiramente mais cinematográfico que 70bpm)
- Stagger de pulsos dentro de uma mesma veia para criar trilha
- `prefers-reduced-motion` continua respeitado (cena estática elegante)

## Não muda

- API do componente (`accent`, `active`)
- Lógica do carrossel, dots, auto-advance
- Outros 5 slides do carrossel
- Texto "Insights Premium" e badge "Novo"

## Validação

- Comparar visualmente com slides irmãos: o chip deve ser claramente o **elemento mais rico do carrossel**, justificando o badge "Novo"
- Verificar que o card mantém legibilidade do texto à direita
- Confirmar que `active=false` (durante transição) ainda pausa o rAF
