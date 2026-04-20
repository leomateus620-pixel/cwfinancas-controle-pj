

## Plano: Mockup 3D + Highlights Premium na Landing

### Anexo 1 — Mockup do app em 3D com gráfico real

**Arquivo:** `src/pages/LandingPage.tsx` (lado direito do hero)

#### 1. Perspectiva 3D no mock window
Envolver o `liquid-glass` (linha 179) num wrapper com `perspective: 1200px` e aplicar transform 3D no card:
```css
transform: rotateY(-12deg) rotateX(6deg) rotateZ(-1deg);
transformStyle: preserve-3d;
```
- Sombra projetada inclinada à direita para reforçar profundidade
- Reflexo/glow ampliado embaixo
- Hover sutil: reduz rotação para `-6deg/3deg` (efeito "approach")
- Brilho de glare diagonal sobre a janela (gradiente branco translúcido fixo)

#### 2. Atualização do menu (sidebar) com itens reais do sistema
Substituir/expandir a lista `features` para refletir o sistema atual:
- Home, Dashboard, Receitas, Despesas, **Cartão de Crédito** (novo), Fluxo de Caixa, DRE, Contas a Pagar/Receber, Previsões, **Insights IA** (novo), **Minha Empresa** (novo)
- Animação de entrada escalonada mantida, ícones com leve `translateZ(20px)` para parecer flutuando sobre a sidebar

#### 3. Novo gráfico real em "Evolução Mensal" (substituir barras fake)
Substituir o array de barras por um **gráfico SVG composto**:
- Área degradê (azul→transparente) com path suavizado (curva `Q`/`T`)
- Linha de receita (verde) + linha de despesa (vermelha) sobrepostas
- 3 dots destacados nos picos com pulse glow
- Animação `stroke-dashoffset` para desenhar as linhas (similar ao `FinanceIntroAnimation`)
- Eixo X minimalista com 6 labels de mês (Jul–Dez)
- Tooltip estático no último ponto: "Dez · R$ 31.4k"

#### 4. Animação aprimorada dos ícones do menu
- Entrada: `scale(0.6) + rotateY(-30deg) → scale(1) + rotateY(0)` com cubic-bezier tipo "back-out"
- Hover: `translateZ(8px) + scale(1.15)` no ícone, glow colorido pulsando
- Adicionar microanimação contínua suave (float infinito, delay variado por item)

#### 5. KPIs com efeito 3D leve
Pequena `translateZ` nos cards de Receitas/Despesas/Lucro + sombra colorida abaixo de cada um.

---

### Anexo 2 — Highlights "DRE", "Previsões", "Dados" com upgrade

**Arquivo:** `src/pages/LandingPage.tsx` (array `highlights` linhas 34-50 + render linhas 121-134)

#### 1. Atualizar conteúdo (refletindo novidades do sistema)
Expandir de 3 para **6 highlights** em grid 2x3 (ou carrossel horizontal de pills):
1. **DRE Inteligente** — Múltiplos modelos (LCF, Standard, Matricial) com validação automática
2. **Previsões com IA** — Cenários Conservador/Base/Otimista, projeção de 12 meses
3. **Cartão de Crédito** — Detecção automática de faturas e reembolsos
4. **Conversor de Extratos** — PDFs viram CSVs prontos via OCR
5. **Insights Premium** — 4 pilares analíticos (Saúde, Riscos, Oportunidades, Anomalias)
6. **Dados Protegidos** — RLS + criptografia + LGPD compliant

#### 2. Redesign visual de cada pill
- Trocar `liquid-glass-compact px-4 py-3` por um card maior com:
  - Gradiente de borda colorido (cor por categoria)
  - Ícone num container 11x11 com **gradient + ring colorido + sombra projetada**
  - Título mais destacado (text-sm font-bold)
  - Descrição em 2 linhas com leading confortável
  - Hover: leve `-translate-y-1 + scale-[1.02]` + brilho na borda
  - Pequena tag/chip "Novo" nos itens recém-adicionados (Cartão, Conversor, Insights)

#### 3. Layout responsivo
- Mobile: stack vertical
- Desktop: grid 2 colunas × 3 linhas (compacto, cabe ao lado do mock)

---

### Detalhes Técnicos

| Ação | Arquivo |
|------|---------|
| Editar | `src/pages/LandingPage.tsx` |

- Manter design system Liquid Glass (sem novos componentes)
- Todas animações via Tailwind classes existentes (`animate-fade-in-up`, `animate-float`, etc.) + inline `transform` para 3D
- Sem dependências novas — gráfico em SVG puro
- Sem impacto no resto do sistema (alteração isolada na landing)

