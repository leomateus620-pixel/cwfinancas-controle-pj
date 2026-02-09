
# Design System Completo: CW Finanças - Controle PJ

## Visao Geral

Reformulacao completa do design da dashboard "CW Finanças Controle PJ" para um visual **premium fintech B2B**, clean e moderno, com identidade extraida diretamente da LOGO.

---

## A) DESIGN SYSTEM

### A1. Paleta de Cores (Baseada na Logo CW Finanças)

A logo utiliza tons de azul corporativo. A paleta sera construida com:

**Primary (Azul Institucional)**
```css
--primary-50: 213 100% 97%;   /* #F0F6FF - hover suave */
--primary-100: 213 95% 93%;   /* #DCE9FE */
--primary-200: 215 94% 85%;   /* #BDDAFE */
--primary-300: 217 93% 75%;   /* #8FC1FC */
--primary-400: 218 90% 62%;   /* #5A9CF8 */
--primary-500: 221 85% 53%;   /* #2D7EF3 - cor principal */
--primary-600: 223 82% 45%;   /* #1E63D6 */
--primary-700: 225 78% 38%;   /* #1850B0 */
--primary-800: 226 70% 32%;   /* #1A4190 */
--primary-900: 227 65% 26%;   /* #173574 */
```

**Secondary (Slate Profissional)**
```css
--secondary-50: 210 40% 98%;   /* #F8FAFC */
--secondary-100: 214 32% 91%;  /* #E2E8F0 */
--secondary-200: 213 27% 84%;  /* #CBD5E1 */
--secondary-500: 215 20% 65%;  /* #94A3B8 */
--secondary-800: 217 33% 17%;  /* #1E293B */
--secondary-900: 222 47% 11%;  /* #0F172A */
```

**Accent (Teal Complementar)**
```css
--accent-400: 172 66% 50%;     /* #2DD4BF - teal vibrante */
--accent-500: 173 80% 40%;     /* #14B8A6 */
```

**Semantic Colors**
```css
--success: 160 84% 39%;        /* #0D9866 - verde profissional */
--warning: 38 92% 50%;         /* #F59E0B - laranja atencao */
--danger: 0 72% 51%;           /* #DC2626 - vermelho erro */
--info: 199 89% 48%;           /* #0EA5E9 - azul informativo */
```

**Neutrals (Cinzas Frios)**
```css
--gray-50: 210 40% 98%;
--gray-100: 214 32% 91%;
--gray-200: 213 27% 84%;
--gray-300: 212 20% 77%;
--gray-400: 215 16% 57%;
--gray-500: 215 14% 44%;
--gray-600: 215 19% 35%;
--gray-700: 217 33% 24%;
--gray-800: 217 33% 17%;
--gray-900: 222 47% 11%;
```

**Chart Colors (Paleta Coerente)**
```css
--chart-1: 221 85% 53%;        /* Primary blue */
--chart-2: 160 84% 39%;        /* Success green */
--chart-3: 173 80% 40%;        /* Teal */
--chart-4: 262 83% 58%;        /* Purple */
--chart-5: 0 72% 51%;          /* Red para despesas */
```

---

### A2. Tipografia

**Familia Principal:** Inter (ja em uso - manter)
**Familia Alternativa:** JetBrains Mono (para numeros financeiros - opcional)

**Escala Tipografica (modular scale 1.250)**
```css
/* Display - Titulos principais */
--text-display: 2.25rem;     /* 36px - Dashboard titles */
--leading-display: 2.5rem;
--tracking-display: -0.025em;

/* Heading 1 */
--text-h1: 1.875rem;         /* 30px */
--leading-h1: 2.25rem;
--tracking-h1: -0.02em;

/* Heading 2 */
--text-h2: 1.5rem;           /* 24px */
--leading-h2: 2rem;
--tracking-h2: -0.015em;

/* Heading 3 */
--text-h3: 1.25rem;          /* 20px - Card titles */
--leading-h3: 1.75rem;
--tracking-h3: -0.01em;

/* Body Large */
--text-body-lg: 1.125rem;    /* 18px */
--leading-body-lg: 1.75rem;

/* Body */
--text-body: 1rem;           /* 16px - Texto base */
--leading-body: 1.5rem;

/* Body Small */
--text-body-sm: 0.875rem;    /* 14px - Labels, table cells */
--leading-body-sm: 1.25rem;

/* Caption */
--text-caption: 0.75rem;     /* 12px - Timestamps, hints */
--leading-caption: 1rem;

/* Numbers (Tabular) */
--text-kpi-large: 3rem;      /* 48px - Valores grandes */
--text-kpi-medium: 2.25rem;  /* 36px - Valores medios */
--text-kpi-small: 1.5rem;    /* 24px - Valores menores */
```

**Pesos**
- Regular (400): Corpo de texto
- Medium (500): Labels, navegacao
- Semibold (600): Titulos de cards
- Bold (700): KPIs, valores monetarios

---

### A3. Espacamento (Sistema 4/8px)

```css
--space-0: 0;
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-5: 1.25rem;   /* 20px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-10: 2.5rem;   /* 40px */
--space-12: 3rem;     /* 48px */
--space-16: 4rem;     /* 64px */
```

---

### A4. Border Radius (2 niveis)

```css
--radius-sm: 0.375rem;  /* 6px - Inputs, tags */
--radius-md: 0.5rem;    /* 8px - Buttons */
--radius-lg: 0.75rem;   /* 12px - Cards padrao */
--radius-xl: 1rem;      /* 16px - Modals, cards especiais */
--radius-2xl: 1.5rem;   /* 24px - Hero cards */
--radius-full: 9999px;  /* Pills, badges */
```

---

### A5. Sombras (3 niveis Premium)

```css
/* Elevation 1 - Cards em repouso */
--shadow-sm: 
  0 1px 2px 0 rgba(15, 23, 42, 0.03),
  0 1px 3px 0 rgba(15, 23, 42, 0.05);

/* Elevation 2 - Cards hover, dropdowns */
--shadow-md: 
  0 4px 6px -1px rgba(15, 23, 42, 0.05),
  0 2px 4px -2px rgba(15, 23, 42, 0.03),
  0 0 0 1px rgba(15, 23, 42, 0.02);

/* Elevation 3 - Modals, popovers */
--shadow-lg: 
  0 10px 25px -3px rgba(15, 23, 42, 0.08),
  0 4px 10px -4px rgba(15, 23, 42, 0.04);

/* Glow - Para destaques de marca */
--shadow-glow-primary: 0 0 24px -4px rgba(45, 126, 243, 0.25);
--shadow-glow-success: 0 0 24px -4px rgba(13, 152, 102, 0.25);
```

---

### A6. Grid e Layout

```css
--grid-columns: 12;
--container-max: 1440px;
--sidebar-width: 260px;
--sidebar-collapsed: 72px;
--header-height: 64px;
--content-padding: 24px;  /* Mobile: 16px */
```

---

### A7. Componentes Base

**Sidebar**
- Fundo: `--secondary-900` (dark) ou `white` (light)
- Logo destacada no topo com padding 20px
- Grupos de navegacao com labels uppercase 11px
- Item ativo: bg primary/10 + barra lateral 3px
- Hover: bg muted + transicao 200ms
- Icones 20px, texto 14px medium

**Topbar**
- Altura: 64px
- Fundo: white/95 + backdrop-blur 12px
- Sombra: shadow-sm
- Elementos: Search (240px), acoes icones 40px

**Cards**
- Padding: 24px (desktop), 16px (mobile)
- Border: 1px solid gray-100
- Radius: radius-lg (12px)
- Background: white
- Hover: translateY(-2px) + shadow-md

**Tabelas**
- Header: bg gray-50, text gray-500 uppercase 11px
- Rows: 56px height, hover bg gray-50
- Valores monetarios: alinhados a direita, tabular-nums
- Status badges: radius-full, padding 4px 10px

**Chips/Tags**
- Padding: 4px 10px
- Font: 12px medium
- Border-radius: full
- Variantes: filled, outlined, ghost

**Botoes**
```
Primary: bg primary-500, text white, hover primary-600
Secondary: bg white, border gray-200, hover bg gray-50
Ghost: bg transparent, hover bg gray-100
Destructive: bg danger, text white
Sizes: sm (32px), md (40px), lg (48px)
```

**Inputs**
- Height: 40px (md), 36px (sm), 48px (lg)
- Border: 1px gray-200
- Focus: ring 2px primary-200 + border primary-500
- Error: border danger, ring danger-100
- Placeholder: gray-400

**Dropdown/Select**
- Trigger: igual input
- Menu: bg white, shadow-lg, radius-lg
- Items: 36px height, hover bg gray-50
- Selected: bg primary-50, text primary-600

**Date Picker**
- Calendario com grid 7 colunas
- Hoje: ring primary-500
- Selecionado: bg primary-500, text white
- Range: bg primary-50 entre datas

**Modals**
- Overlay: black/50 + backdrop-blur 4px
- Container: max-width 520px, radius-xl, padding 24px
- Header: 56px, border-bottom
- Footer: border-top, gap 12px

**Toast**
- Position: bottom-right
- Width: 360px
- Variantes: success (green), error (red), info (blue)
- Duracao: 5s
- Animacao: slide-in-right 300ms

**Skeleton Loading**
- Base: gray-100
- Shimmer: gradiente linear movendo 2s
- Border-radius: mesmo do componente alvo

---

### A8. Estados de Componentes

```
Hover: 
- Opacity +10% (cores solidas)
- translateY(-2px) (cards)
- Underline (links)

Focus:
- Ring 2px offset 2px primary-200
- Border primary-500
- Remove outline nativo

Pressed/Active:
- Scale 0.98
- Bg primary-600 (botoes)

Disabled:
- Opacity 0.5
- Cursor not-allowed
- Sem hover effects

Selected:
- Bg primary-50
- Border primary-300
- Text primary-600

Error:
- Border danger
- Text danger
- Icon alert-circle

Success:
- Border success
- Text success
- Icon check-circle
```

---

### A9. Icones

**Biblioteca:** Lucide React (ja em uso - manter)

**Mapeamento por secao:**

Menu Principal:
- Dashboard: `LayoutDashboard`
- Receitas: `TrendingUp`
- Despesas: `TrendingDown`
- Fluxo de Caixa: `ArrowLeftRight`
- Balanco Patrimonial: `Scale`
- Previsoes: `LineChart`

Ferramentas:
- Notas Fiscais: `FileText`
- Google Sheets: `Sheet`
- Upload de Dados: `Upload`
- Insights IA: `Sparkles`
- Configuracoes: `Settings`

Acoes Comuns:
- Exportar: `Download`
- Filtrar: `Filter`
- Calendario: `Calendar`
- Sincronizar: `RefreshCw`
- Upload: `Upload`
- IA/Insights: `Sparkles`
- Adicionar: `Plus`
- Editar: `Pencil`
- Deletar: `Trash2`
- Buscar: `Search`
- Notificacoes: `Bell`
- Usuario: `User`
- Sair: `LogOut`
- Externo: `ExternalLink`
- Sucesso: `CheckCircle`
- Erro: `AlertCircle`
- Info: `Info`
- Fechar: `X`

Tamanhos padrao:
- Menu: 20px
- Botoes: 16px
- Badges: 14px
- Inline: 16px

---

## B) TELAS (High-Fidelity Specs)

### B1. Dashboard (Visao Geral)

**Layout:**
```
+--------------------------------------------------+
|  TOPBAR (busca, acoes, perfil)                   |
+--------+-----------------------------------------+
|        |  Header: "Dashboard Financeiro" + badge |
|        |  Date range picker                      |
| SIDE   +-----------------------------------------+
| BAR    |  HERO CARD: Saldo Total da Empresa      |
|        |  R$ 253.412 | +12,5% | Glow effect      |
|        +-----------------------------------------+
|        |  KPI GRID (4 cards):                    |
|        |  [Receita] [Lucro] [Despesas] [Margem]  |
|        +-----------------------------------------+
|        |  CHARTS ROW (2 colunas):                |
|        |  [Tendencia Receita] [Despesas Cat.]    |
|        +-----------------------------------------+
|        |  BOTTOM ROW (3 colunas):                |
|        |  [Profit Dist] [Transacoes] [Quality]   |
+--------+-----------------------------------------+
```

**Hero Card (Saldo Total):**
- Background: gradiente sutil primary-50 -> white
- Icone Wallet 32px em container 64px com bg primary/10
- Valor: 48px bold, animacao count-up
- Badge: "+12,5% vs mes anterior"
- Hover: glow effect primary

**KPI Cards:**
- 4 colunas em desktop, 2 em tablet, 1 em mobile
- Altura uniforme ~180px
- Icone + valor grande + label + trend badge
- Cores semanticas: primary (receita), success (lucro), default (despesas), success/warning (margem)

**Charts:**
- Area chart para tendencia (receita vs despesas)
- Pie/Donut para distribuicao de categorias
- Altura: 350px
- Tooltips glassmorphism

**Transacoes Recentes:**
- Lista 5 ultimas transacoes
- Row: icone + descricao + categoria tag + valor
- Hover: bg gray-50
- Empty state com ilustracao

**Data Quality Card:**
- Indicador circular de cobertura (%)
- Lista de items para revisao
- CTA para página de revisão

---

### B2. Fluxo de Caixa

**Layout:**
```
+--------------------------------------------------+
|  Header: "Fluxo de Caixa" + Date picker + Refresh|
+--------------------------------------------------+
|  KPI ROW (3 cards):                              |
|  [Total Entradas] [Total Saidas] [Saldo Liquido] |
+--------------------------------------------------+
|  MAIN CHART (full width):                        |
|  Area chart entradas/saidas com tooltips premium |
|  Altura: 400px                                   |
+--------------------------------------------------+
|  PROJECTION SECTION:                             |
|  Cenarios: Conservador | Base | Otimista         |
|  Projecao 12 meses em linha com confidence band  |
+--------------------------------------------------+
|  UPCOMING PAYMENTS:                              |
|  Lista de proximos vencimentos                   |
+--------------------------------------------------+
```

**Chart Principal:**
- Area chart com 2 series (entradas verde, saidas vermelho)
- Grid horizontal sutil
- Labels Y formatados: R$ XXk / R$ XXmi
- Crosshair no hover
- Active dot com glow
- Animacao draw-line 1.5s

**Projecao:**
- Toggle entre cenarios
- Linha pontilhada para dados projetados
- Confidence band (area semi-transparente)
- Tooltip indicando "projetado"

---

### B3. Integracao Google Sheets

**Empty State:**
- Container centralizado max-width 480px
- Ilustracao/icone grande (80px) animado float
- Titulo: "Conecte sua Conta Google"
- Descricao clara em 2-3 linhas
- CTA primario: "Conectar ao Google"
- Secao "Como Funciona" com steps numerados

**Estado Conectado:**
- Header com status "Conectado" badge verde
- Lista de planilhas conectadas em cards
- Cada card:
  - Nome da planilha + link externo
  - Aba selecionada
  - Status da sync (sucesso/erro/syncing)
  - Ultima sync timestamp
  - Linhas importadas
  - Botoes: Sync agora, Desconectar
- Toggle auto-sync
- Historico de sincronizacoes (tabela)
- Erros detalhados (lista expansivel)

**Profile Status Card:**
- Indicador de confianca (0-100%)
- Colunas detectadas
- Regras de parsing
- Botao "Revalidar"

---

### B4. Notas Fiscais / Upload de Dados

**Upload Area:**
- Dropzone com borda tracejada
- Icone upload 48px
- Texto: "Arraste arquivos ou clique para selecionar"
- Formatos aceitos em caption
- Progress bar durante upload
- Feedback visual: animacao checkmark ao completar

**Tabela de Arquivos:**
- Colunas: Nome, Tipo, Data upload, Status, Acoes
- Status badges: processando, sucesso, erro
- Linha expansivel para detalhes de erro
- Bulk actions no header

---

### B5. Insights IA

**Layout:**
```
+--------------------------------------------------+
|  Header: "Insights com IA" + Sparkles icon       |
+--------------------------------------------------+
|  GENERATE CTA (se nao houver insights):          |
|  Card premium com gradiente, CTA central         |
+--------------------------------------------------+
|  SUMMARY CARD:                                   |
|  Resumo executivo 2-3 frases                     |
+--------------------------------------------------+
|  SECTIONS (accordion ou tabs):                   |
|  [Destaques] [Riscos] [Oportunidades] [Perguntas]|
+--------------------------------------------------+
```

**Insight Card:**
- Icone semantico (TrendingUp/AlertTriangle/Lightbulb)
- Titulo bold
- Evidencia (numeros citados)
- Impacto
- Recomendacao em destaque
- Cor de fundo sutil por tipo

**Risk Card:**
- Badge de severidade (high/medium/low)
- Cores: high=red, medium=orange, low=yellow
- Mitigacao como action item

**Data Quality Warning:**
- Banner amarelo se cobertura < 95%
- Texto claro sobre limitacoes

---

### B6. Configuracoes

**Layout:**
- Sections em cards separados
- Max-width 720px centralizado
- Grupos: Perfil, Notificacoes, Aparencia, Dados, Seguranca

**Cada Section:**
- Titulo com icone
- Descricao curta
- Form fields ou toggles
- Save button quando aplicavel

---

## C) GRAFICOS (Padroes Premium)

### C1. Estilo Geral

**Grid:**
- Apenas linhas horizontais
- Cor: gray-100
- Stroke-dasharray: 4 4
- Opacidade: 0.5

**Labels:**
- Cor: gray-500
- Font: 12px medium
- Eixo Y: formatacao BR (R$ 10k, R$ 1mi)
- Eixo X: meses abreviados (Jan, Fev, Mar)

**Tooltips:**
- Background: white/95 + backdrop-blur
- Border: 1px gray-100
- Shadow: shadow-lg
- Padding: 16px
- Border-radius: 12px
- Animacao: fade-in + scale 200ms

**Active Dots:**
- Tamanho: 6-8px
- Stroke: 3px white
- Box-shadow: glow da cor do grafico

### C2. Tipos de Graficos

**Area Chart (Tendencias):**
- Gradient fill: cor principal 40% -> 0%
- Stroke: 3px
- Glow filter sutil
- Animacao draw: 1.5s ease-out

**Bar Chart (Comparativos):**
- Border-radius top: 4px
- Gap: 8px entre barras
- Hover: opacity 0.8 + tooltip

**Donut Chart (Distribuicao):**
- Inner radius: 60%
- Padding angle: 2-3 graus
- Legend abaixo centralizada
- Hover: slice expande 4px

**Line Chart (Projecoes):**
- Stroke: 2px solid (realizado), 2px dashed (projetado)
- Confidence band: area 10% opacidade

### C3. Cores por Serie

```
Serie 1 (Receita/Entradas): chart-1 (primary blue)
Serie 2 (Despesas/Saidas): chart-5 (red)
Serie 3 (Lucro): chart-2 (success green)
Serie 4 (Projecao): chart-3 (teal)
Categorias: rotacao chart-1 a chart-5
```

### C4. Formatacao de Numeros

```javascript
// Valores grandes
formatCurrency(1500000) -> "R$ 1,5mi"
formatCurrency(45000) -> "R$ 45k"
formatCurrency(1234.56) -> "R$ 1.234,56"

// Percentuais
formatPercent(0.1234) -> "12,34%"
formatPercent(0.5) -> "50%"

// Compacto em tooltips
formatCompact(1234567) -> "R$ 1,23mi"
```

---

## D) ANIMACOES

### D1. Microinteracoes

**Cards:**
- Hover: translateY(-2px) + shadow upgrade
- Duracao: 200ms
- Timing: ease-out
- Motivo: feedback de clicabilidade

**Botoes:**
- Hover: opacity change + scale 1.02
- Active: scale 0.98
- Duracao: 150ms
- Motivo: feedback tatil

**Tooltips:**
- Enter: fade-in + translateY(4px -> 0)
- Duracao: 200ms
- Delay: 100ms
- Motivo: prevenir flicker

**Dropdown/Modal:**
- Enter: scale 0.95 -> 1 + fade
- Exit: reverse
- Duracao: 200ms
- Timing: ease-out
- Motivo: continuidade espacial

### D2. Transicoes de Pagina

**Page Enter:**
- translateX(24px -> 0) + fade
- Duracao: 400ms
- Timing: cubic-bezier(0.25, 0.1, 0.25, 1)
- Motivo: direcionalidade

**Stagger Children:**
- Delay incremental: 60ms por item
- Max 8 items com delay
- Motivo: hierarquia visual

### D3. Loading States

**Skeleton:**
- Shimmer sweep: 2.5s linear infinite
- Gradiente: transparent -> primary/8 -> transparent
- Motivo: indicar carregamento ativo

**Spinners:**
- Rotate: 360deg / 0.8s linear
- Opacity pulse: 1 -> 0.5 -> 1 / 2s
- Motivo: processo em andamento

### D4. Data Animations

**Count-up Numbers:**
- Duracao: 1.5s
- Easing: ease-out-expo
- Emphasis: scale 1.02 ao final
- Motivo: impacto visual em KPIs

**Chart Draw:**
- Stroke-dashoffset animation
- Duracao: 1.5s staggered por serie
- Motivo: narrativa visual

**Progress Bars:**
- Width 0 -> target
- Duracao: 1s ease-out
- Motivo: progresso perceptivel

---

## E) ICONES (Lucide React)

### E1. Mapeamento Completo

**Navegacao:**
```
Dashboard         -> LayoutDashboard
Receitas          -> TrendingUp
Despesas          -> TrendingDown
Fluxo de Caixa    -> ArrowLeftRight
Balanco           -> Scale
Previsoes         -> LineChart
Notas Fiscais     -> FileText
Google Sheets     -> Sheet (ou FileSpreadsheet)
Upload            -> Upload
Insights IA       -> Sparkles
Configuracoes     -> Settings
```

**Acoes:**
```
Adicionar         -> Plus
Editar            -> Pencil
Deletar           -> Trash2
Exportar          -> Download
Importar          -> Upload
Filtrar           -> Filter
Buscar            -> Search
Calendario        -> Calendar
Sincronizar       -> RefreshCw
Atualizar         -> RefreshCw
Ver detalhes      -> Eye
Link externo      -> ExternalLink
Fechar            -> X
Voltar            -> ArrowLeft
Avancar           -> ArrowRight
Expandir          -> ChevronDown
Recolher          -> ChevronUp
```

**Status:**
```
Sucesso           -> CheckCircle
Erro              -> AlertCircle
Aviso             -> AlertTriangle
Info              -> Info
Carregando        -> Loader2
Pendente          -> Clock
Ativo             -> Circle (filled)
Inativo           -> Circle (outline)
```

**Financeiro:**
```
Dinheiro          -> DollarSign
Carteira          -> Wallet
Banco             -> Building2
Entrada           -> ArrowDownLeft
Saida             -> ArrowUpRight
Lucro             -> TrendingUp
Prejuizo          -> TrendingDown
Margem            -> PiggyBank
```

**Usuario:**
```
Perfil            -> User
Notificacoes      -> Bell
Sair              -> LogOut
Equipe            -> Users
Seguranca         -> Shield
Aparencia         -> Palette
Dados             -> Database
```

### E2. Regras de Uso

- Stroke width: 2px (padrao Lucide)
- Cores: inherit (herda do texto pai)
- Tamanhos consistentes por contexto
- Nunca usar icones customizados fora da biblioteca
- Sempre usar o nome exato do Lucide

---

## F) CHECKLIST DE CONSISTENCIA

### F1. Verificacoes Visuais

- [ ] Todas as cores usam tokens CSS (nao hex direto)
- [ ] Tipografia segue escala definida
- [ ] Espacamentos multiplos de 4px
- [ ] Border-radius consistente por tipo de componente
- [ ] Sombras usam os 3 niveis definidos
- [ ] Icones todos de Lucide, tamanhos padronizados

### F2. Verificacoes de Interacao

- [ ] Todos botoes tem estados hover/focus/active/disabled
- [ ] Inputs tem focus ring visivel (acessibilidade)
- [ ] Links tem underline no hover
- [ ] Cards clicaveis tem cursor pointer + hover effect
- [ ] Transicoes <= 300ms para feedback imediato

### F3. Verificacoes de Acessibilidade

- [ ] Contraste texto/fundo >= 4.5:1 (AA)
- [ ] Contraste elementos UI >= 3:1
- [ ] Focus visible em todos elementos interativos
- [ ] Tamanho minimo touch target: 44x44px
- [ ] Alt text em imagens
- [ ] Roles ARIA onde necessario

### F4. Verificacoes de Responsividade

- [ ] Layout adapta em breakpoints: 640, 768, 1024, 1280px
- [ ] Sidebar colapsa em mobile
- [ ] Tabelas com scroll horizontal em mobile
- [ ] KPIs empilham em 1 coluna em mobile
- [ ] Touch-friendly em dispositivos moveis

### F5. Verificacoes de Marca

- [ ] Logo presente no sidebar (40x40px, arredondada)
- [ ] Primary blue usado em CTAs principais
- [ ] Gradientes sutis em hero sections
- [ ] Empty states com ilustracoes/icones da marca
- [ ] Loading states mantem identidade visual

---

## Arquivos a Modificar

1. `src/index.css` - Atualizar tokens CSS completos
2. `tailwind.config.ts` - Sincronizar tokens com Tailwind
3. `src/components/layout/AppSidebar.tsx` - Refinar navegacao
4. `src/components/layout/DashboardHeader.tsx` - Polir topbar
5. `src/pages/*.tsx` - Aplicar novos padroes em cada tela
6. `src/components/dashboard/*.tsx` - Refinar KPIs e charts
7. `src/components/ui/*.tsx` - Garantir consistencia nos primitivos

---

## Resultado Esperado

Um dashboard financeiro **premium, clean e profissional** que:
- Transmite confianca e credibilidade
- Prioriza legibilidade dos numeros
- Usa cores com proposito (semantica)
- Anima com sutileza (sem exageros)
- E consistente em todas as telas
- Funciona perfeitamente em todos os dispositivos
