

## Plano: Vídeo Marketing CW Finanças — Instagram Feed 1:1

### Formato
- **1080x1080** (feed quadrado Instagram)
- **15 segundos** (450 frames a 30fps) — ideal para atenção no feed
- **Sem áudio** (muted autoplay no Instagram)

### Direção Criativa

**Estética**: Liquid Glass Premium — superfícies translúcidas com blur, bordas luminosas, gradientes mesh azul/teal sobre fundo dark navy. Consistente com o design system existente do app.

**Paleta** (da brand):
- Primary: `#3B82F6` (azul institucional)
- Teal accent: `#14B8A6`
- Navy BG: `hsl(222 47% 11%)`
- Success: `#059669`
- Destructive: `#DC2626`
- White/glass: `rgba(255,255,255,0.08-0.15)`

**Tipografia**: Inter (já usada no app)

**Frase destaque**: "Seu Financeiro Controlado com um Clique"

### Estrutura de Cenas (5 cenas, ~15s total)

| Cena | Frames | Duração | Conteúdo |
|------|--------|---------|----------|
| 1 — Logo Reveal | 0-75 | 2.5s | Logo CW com efeito glass blur-in, tagline "Controle PJ" |
| 2 — Features Grid | 75-180 | 3.5s | 6 ícones de features aparecendo em stagger (Receitas, Despesas, Fluxo de Caixa, DRE, Contas, Previsões) com glass cards |
| 3 — KPI Showcase | 180-270 | 3s | KPIs animados (Receita +84.2k, Despesas -52.8k, Lucro +31.4k) com gráfico SVG crescendo |
| 4 — Frase Destaque | 270-375 | 3.5s | "Seu Financeiro Controlado com um Clique" — tipografia cinematográfica com glow azul |
| 5 — CTA Final | 375-450 | 2.5s | Logo + "cwfinancas.app" + glass orbs |

### Efeitos Visuais
- **Background persistente**: Mesh gradient navy animado com orbs flutuantes (azul/teal) em slow drift
- **Glass cards**: `backdrop-filter` substituído por `background: rgba(255,255,255,0.08)` + border luminosa (sem `backdropFilter` por limitação do sandbox)
- **Transições**: Wipe e fade entre cenas via `@remotion/transitions`
- **Motion system**: Spring entrada (damping: 20, stiffness: 200), fade exit

### Assets
- Logo: `src/assets/logo-cw-pj.png` e `src/assets/logo-full.png` — copiar para `remotion/public/`
- Ícones: Renderizados via SVG inline (Lucide-style)

### Arquivos Remotion

```
remotion/
  src/
    index.ts
    Root.tsx
    MainVideo.tsx
    scenes/
      LogoReveal.tsx
      FeaturesGrid.tsx
      KPIShowcase.tsx
      HeroPhrase.tsx
      CTAFinal.tsx
    components/
      GlassBackground.tsx
      GlassCard.tsx
  public/
    logo-cw-pj.png
    logo-full.png
  scripts/
    render-remotion.mjs
```

### Entrega
- Renderizar via script programático para `/mnt/documents/cw-financas-marketing.mp4`
- QA visual com `bunx remotion still` em frames-chave antes do render final

