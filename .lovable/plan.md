
# Tela Home Premium — Liquid Glass Dashboard

## Visao Geral

Criar uma nova rota `/home` que sera a tela inicial apos login, com visual "liquid glass" sobre fundo dark premium. A rota `/` (OverviewPage) continua existindo como "Dashboard detalhado". A Home e o resumo executivo diario do cliente.

---

## Arquitetura de Dados

### Fontes de dados (hooks existentes)

| KPI | Hook | Calculo |
|-----|------|---------|
| Caixa Atual (saldo) | `useTransactions()` | `totals.balance` (income - expense de TODAS transacoes) |
| Entradas do mes | `useTransactions({ type: "income", startDate, endDate })` | Soma filtrada pelo mes corrente |
| Saidas do mes | `useTransactions({ type: "expense", startDate, endDate })` | Soma filtrada pelo mes corrente |
| Resultado do mes | Calculado | entradas - saidas do mes |
| Contas a receber | `useInvoices({ status: "pending" })` | `summary.pendingValue` |
| Contas a pagar | `useTransactions` filtrado | Transacoes futuras type=expense |
| Variacao vs mes anterior | `useCashFlow()` | `totals.trend` (ja calculado) |
| Runway (dias) | Calculado | saldo / (media despesas diarias ultimos 3 meses) |
| Top 3 categorias | `useTransactions` | Agrupado por `category`, sorted, top 3 |
| Alertas | Calculado | Regras sobre os dados acima |
| Ultima sync | `useSyncStatus()` | `connections[0].last_sync_at` |
| Nome empresa | `useProfile()` | `profile.company_name` |

### Novo hook: `useHomeDashboard`

Centraliza TODOS os calculos da Home numa unica composicao de hooks existentes, sem duplicar queries. Retorna objeto estruturado com todos KPIs, alertas, top categorias, sparkline data e score de saude.

---

## Arquivos a Criar

### 1. `src/hooks/useHomeDashboard.ts`

Hook principal que compoe:
- `useProfile()` -> company_name
- `useTransactions()` -> todos os dados do mes atual + mes anterior
- `useInvoices()` -> contas a receber
- `useCashFlow()` -> tendencia e projecao
- `useSyncStatus()` -> ultima sync

Calcula e retorna:
```typescript
interface HomeDashboardData {
  greeting: string; // "Bom dia" / "Boa tarde" / "Boa noite"
  companyName: string;
  lastSyncAt: string | null;
  
  // KPIs
  currentBalance: number;
  monthIncome: number;
  monthExpense: number;
  monthResult: number;
  receivables: number;
  payables: number;
  variationPercent: number;
  variationValue: number;
  runwayDays: number | null;
  
  // Top categories
  topExpenseCategories: Array<{ name: string; value: number; percent: number }>;
  
  // Alerts
  alerts: Array<{ 
    id: string;
    title: string; 
    description: string; 
    priority: "high" | "medium" | "low";
    icon: string;
  }>;
  
  // Sparkline (ultimos 30 dias)
  dailyTrend: Array<{ date: string; value: number }>;
  
  // Health score
  healthScore: number; // 0-100
  healthFactors: Array<{ label: string; score: number; weight: number }>;
  
  // States
  isLoading: boolean;
  hasData: boolean;
  hasSyncConnection: boolean;
}
```

**Score de saude financeira (0-100):**
- Margem de lucro positiva: 25 pts (>20% = 25, >10% = 15, >0% = 10, <0 = 0)
- Runway > 90 dias: 25 pts (>90d = 25, >60d = 20, >30d = 10, <30d = 0)
- Contas a receber < 30% receita: 25 pts
- Tendencia positiva (crescimento): 25 pts

**Alertas automaticos:**
- Despesas acima de 110% do mes anterior -> priority: "high"
- Receita caiu > 15% vs mes anterior -> priority: "high"
- Faturas vencendo em 7 dias -> priority: "medium"
- Runway < 30 dias -> priority: "high"
- Concentracao > 40% numa categoria -> priority: "low"

---

### 2. `src/pages/HomePage.tsx`

Pagina principal com layout liquid glass. Estrutura:

```
FUNDO: bg dark com gradiente mesh sutil

HEADER SECTION:
  Saudacao + Nome empresa (h1)
  Subtitulo: "Aqui esta seu resumo financeiro diario."
  Data atual + Ultima atualizacao do Sheets

KPI MOSAIC (grid assimetrico):
  [Caixa Atual - 2x1, destaque]  [Entradas - 1x1]  [Saidas - 1x1]
  [Resultado - 1x1]  [A Receber - 1x1]  [A Pagar - 1x1]  [Variacao - 1x1]

MIDDLE ROW (2 colunas):
  [Resumo do Dia - 2x2]  [Score Saude - 1x2]

BOTTOM ROW:
  [Top 3 Categorias - 1x1]  [Alertas - 1x1]  [Atalhos - 1x1]
```

---

### 3. `src/components/home/GlassCard.tsx`

Componente base "liquid glass" com:
- Background: `bg-white/5 dark:bg-white/[0.04]` com `backdrop-blur-xl`
- Border: `border border-white/10` com highlight sutil no topo
- Pseudo-element `::before` com gradiente branco 5% no topo para efeito de "volume"
- Hover: `border-white/20` + sombra difusa + transicao 200ms
- Variantes: `default`, `highlight` (borda com glow primary), `compact`

```css
.liquid-glass {
  background: rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(24px) saturate(150%);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  box-shadow: 
    0 8px 32px rgba(0, 0, 0, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
  transition: all 200ms ease;
}

.liquid-glass:hover {
  border-color: rgba(255, 255, 255, 0.15);
  box-shadow: 
    0 12px 40px rgba(0, 0, 0, 0.18),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.liquid-glass-highlight {
  border-color: rgba(45, 126, 243, 0.25);
  box-shadow: 
    0 8px 32px rgba(0, 0, 0, 0.12),
    0 0 20px rgba(45, 126, 243, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
}
```

---

### 4. `src/components/home/HomeKPICard.tsx`

Card de KPI com liquid glass:
- Icone em container circular com bg da cor semantica (10% opacity)
- Valor grande (tabular-nums, font-bold)
- Label em texto muted
- Tooltip discreto no hover (explica o calculo)
- "Ver detalhes" -> navega para pagina correspondente
- Suporte a variante `large` (ocupa 2 colunas)

---

### 5. `src/components/home/DailySummary.tsx`

Secao "Resumo do Dia":
- 3 bullets automaticos com insights textuais
- Mini sparkline (Recharts LineChart simples, sem eixos) com toggle 7/14/30 dias
- Dados do sparkline: saldo diario calculado a partir de transacoes

---

### 6. `src/components/home/HealthScore.tsx`

Score de Saude Financeira:
- Numero grande (0-100) com cor semantica (verde >70, amarelo 40-70, vermelho <40)
- Arco SVG circular (gauge) animado
- Lista dos fatores com peso e nota individual
- Tooltip transparente sobre como calcula

---

### 7. `src/components/home/AlertsPanel.tsx`

Painel de alertas:
- Lista ordenada por prioridade (Alta primeiro)
- Icone por prioridade: AlertTriangle (high), AlertCircle (medium), Info (low)
- Cores: high=vermelho, medium=amarelo, low=azul
- Max 5 alertas visiveis, "Ver todos" se mais
- Empty state: "Nenhum alerta no momento" com icone CheckCircle

---

### 8. `src/components/home/QuickLinks.tsx`

Atalhos de navegacao:
- Grid 3x3 de botoes/cards pequenos
- Cada um com icone Lucide + label
- Hover com leve glow
- Links:

| Label | Icone | Rota |
|-------|-------|------|
| Visao Geral | LayoutDashboard | / |
| Receitas | TrendingUp | /income |
| Despesas | TrendingDown | /expenses |
| Fluxo de Caixa | ArrowLeftRight | /cash-flow |
| Notas Fiscais | FileText | /invoices |
| Google Sheets | FileSpreadsheet | /google-sheets |
| Insights IA | Sparkles | /insights |
| Relatorios | BarChart3 | /balance |
| Configuracoes | Settings | /settings |

---

### 9. `src/components/home/TopCategories.tsx`

Top 3 Categorias de Despesa:
- Barras horizontais com porcentagem
- Cor primary com gradiente sutil
- Label + valor formatado + % do total

---

### 10. `src/components/home/HomeEmptyState.tsx`

Estado vazio premium quando nao ha dados:
- Icone grande animado (float)
- "Seus dados financeiros aparecerão aqui"
- CTA: "Conectar Google Sheets" -> /google-sheets
- CTA secundario: "Importar Planilha" -> /upload

---

## Arquivos a Modificar

### 1. `src/App.tsx`
- Importar `HomePage`
- Adicionar rota `/home` como rota padrao protegida
- Mover `/` de OverviewPage para HomePage
- OverviewPage passa a ser `/overview`

### 2. `src/components/layout/AppSidebar.tsx`
- Adicionar item "Home" com icone `Home` no topo do menu principal
- Dashboard (OverviewPage) fica como segundo item

### 3. `src/index.css`
- Adicionar classes `.liquid-glass`, `.liquid-glass-highlight`, `.liquid-glass-compact`
- Adicionar keyframe `glow-border` para hover dos cards glass
- Adicionar variavel `--home-bg` para fundo escuro da Home

### 4. `tailwind.config.ts`
- Adicionar animacao `glow-border` se necessario

### 5. `src/components/layout/DashboardLayout.tsx`
- Detectar rota `/home` para aplicar fundo escuro (classe `dark` forcada ou bg custom)

---

## Microcopy (PT-BR Final)

**Saudacoes:**
- "Bom dia, {empresa}! Aqui esta seu resumo financeiro diario."
- "Boa tarde, {empresa}! Aqui esta seu resumo financeiro diario."
- "Boa noite, {empresa}! Aqui esta seu resumo financeiro diario."

**Labels KPI:**
- Caixa Atual | Entradas do Mes | Saidas do Mes | Resultado do Mes
- Contas a Receber | Contas a Pagar | Variacao vs Mes Anterior | Folego de Caixa

**Tooltips KPI:**
- Caixa Atual: "Saldo liquido: total de receitas menos despesas de todas as transacoes importadas."
- Entradas do Mes: "Soma de todas as receitas registradas no mes corrente."
- Saidas do Mes: "Soma de todas as despesas registradas no mes corrente."
- Resultado: "Diferenca entre entradas e saidas do mes corrente."
- Contas a Receber: "Valor total de faturas com status pendente."
- Runway: "Estimativa de quantos dias o saldo atual cobre, com base na media de despesas dos ultimos 90 dias."

**Alertas exemplos:**
- "Despesas 18% acima do mes anterior — revise seus gastos."
- "Receita caiu 12% este mes — acompanhe de perto."
- "3 faturas vencem nos proximos 7 dias — R$ 15.400 em aberto."
- "Folego de caixa: apenas 22 dias restantes."

**Resumo do dia exemplos:**
- "Seu caixa cresceu 3,2% em relacao a ontem."
- "A categoria Servicos concentrou 38% das despesas este mes."
- "Voce tem R$ 12.500 em contas a receber vencendo ate sexta-feira."

**Empty state:**
- "Seus indicadores financeiros aparecerão aqui assim que os dados forem importados."
- CTA: "Conectar Planilha"

**Score de saude:**
- "Otimo" (80-100), "Bom" (60-79), "Atencao" (40-59), "Critico" (0-39)

---

## Animacoes

| Elemento | Animacao | Duracao | Motivo |
|----------|----------|---------|--------|
| Cards KPI | stagger fade-in-up | 400ms + 60ms delay | Hierarquia de entrada |
| Valores numericos | count-up (ease-out-expo) | 1500ms | Impacto visual |
| Sparkline | draw-line | 1500ms | Narrativa visual |
| Health gauge | stroke-dashoffset | 1200ms | Revelacao progressiva |
| Cards hover | border glow + translateY(-2px) | 200ms | Feedback interativo |
| Tooltips | fade + translateY(4px) | 200ms | Prevenir flicker |
| Alertas | slide-up-fade stagger | 300ms + 50ms delay | Leitura sequencial |
| Score numero | count-up + scale emphasis | 1500ms | Destaque |

---

## Layout Responsivo

**Desktop (>1280px):** Grid assimetrico completo, 4 colunas
**Tablet (768-1279px):** Grid 2 colunas, cards empilhados
**Mobile (<768px):** Coluna unica, cards full-width, atalhos em grid 3x2

---

## Checklist de Aceitacao

- [ ] Saudacao muda conforme horario (05-11: dia, 12-17: tarde, 18-04: noite)
- [ ] Nome da empresa vem do perfil do usuario
- [ ] Todos KPIs calculados com dados reais do banco
- [ ] Estado vazio elegante quando sem dados
- [ ] Estado de loading com skeleton glass
- [ ] Ultima sync exibida no header
- [ ] Tooltips em todos os KPIs
- [ ] "Ver detalhes" navega para pagina correta
- [ ] Score de saude calcula e exibe corretamente
- [ ] Alertas gerados automaticamente com base nos dados
- [ ] Sparkline renderiza tendencia dos ultimos 7/14/30 dias
- [ ] Top 3 categorias exibidas com barras e %
- [ ] Atalhos navegam para as rotas corretas
- [ ] Visual liquid glass consistente em todos os cards
- [ ] Hover com glow sutil na borda
- [ ] Animacoes suaves (200-400ms)
- [ ] Formato BR em todos os valores (R$ X.XXX,XX)
- [ ] Contraste AA em todos os textos
- [ ] Responsivo: desktop, tablet, mobile
