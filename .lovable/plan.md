

## Plano: Reestruturação Completa do Menu "Minha Empresa"

### Escopo

Reescrever `CompanyPage.tsx` como painel empresarial premium, corrigir a edge function `company-lookup` (URL errada da API), e melhorar a lógica de identificação por nome de planilha.

### Mudanças

#### 1. Fix `company-lookup` Edge Function
- Corrigir URL da API: `https://api.lovable.dev/v1/chat/completions` → `https://ai.gateway.lovable.dev/v1/chat/completions`
- Melhorar o prompt para extrair nome da empresa antes do primeiro hífen (ex: "Tarifa Zero - Controle Financeiro 2026" → buscar "Tarifa Zero")

#### 2. Lógica de identificação pela planilha
- Na `CompanyPage`, extrair o texto **antes do primeiro hífen** do `spreadsheet_name` como identificador
- Enviar apenas essa parte para o `company-lookup`
- Preencher campos vazios sem sobrescrever dados existentes

#### 3. Remover card "Insights IA"
- Remover o `GlassCard` de "Insights IA" (linhas 404-423)
- Manter a edge function `company-benchmarks` intacta (ainda retorna `aiInsights`, mas não exibido aqui)

#### 4. Novo layout da página (CompanyPage.tsx completo)

```text
┌─────────────────────────────────────────────────────────┐
│  Header: Minha Empresa + nome fantasia + botão Salvar   │
└─────────────────────────────────────────────────────────┘

LINHA 1 (2 colunas desktop):
┌──────────────────────────┬──────────────────────────────┐
│  DADOS CADASTRAIS        │  MERCADO & BENCHMARK         │
│  liquid-glass-card       │  liquid-glass-card            │
│  • Auto-fill inteligente │  • Status geral (badge)       │
│  • Badge: auto/manual    │  • 3 barras comparativas      │
│  • Formulário completo   │  • Fonte + competência        │
│  • Setor, CNAE, Porte    │  • Nível confiança            │
│  • Cidade/UF             │  • Microcopy executivo        │
└──────────────────────────┴──────────────────────────────┘

LINHA 2 (full-width):
┌─────────────────────────────────────────────────────────┐
│  METAS FINANCEIRAS MENSAIS  (liquid-glass-card-hero)    │
│                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │ META RECEITA │  │ META DESPESA│  │ META LUCRO  │     │
│  │ Ring/gauge   │  │ Ring/gauge   │  │ Ring/gauge   │     │
│  │ Real vs Meta │  │ Real vs Meta │  │ Real vs Meta │     │
│  │ % + delta    │  │ % + delta    │  │ % + delta    │     │
│  │ Microcopy    │  │ Microcopy    │  │ Microcopy    │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
│  Inputs editáveis das metas (colapsável)                 │
└─────────────────────────────────────────────────────────┘

LINHA 3 (full-width, se houver dados):
┌─────────────────────────────────────────────────────────┐
│  RESUMO FINANCEIRO DO MÊS                               │
│  3 mini-cards: Receita | Despesa | Resultado             │
│  + Margem estimada + variação vs mês anterior            │
└─────────────────────────────────────────────────────────┘
```

#### 5. Card Metas — Gauges visuais com SVG
- Ring/gauge SVG circular para cada meta (receita, despesa, lucro)
- Cor dinâmica: verde (atingido/dentro), amarelo (próximo), vermelho (acima do limite)
- Valores reais de `usePeriodMetrics` vs metas salvas
- Microcopy: "Você atingiu 78% da meta de receita" / "Despesas consumiram 64% do limite"
- Inputs de meta em seção colapsável (não poluir visual principal)

#### 6. Card Benchmark — Mais robusto
- Mostrar fonte: "Referência: SEBRAE/IBGE — {setor} — {porte}"
- Badge de status geral: "Acima da média" / "Dentro da faixa" / "Abaixo da média"
- Manter as 3 barras comparativas existentes (Margem, Crescimento, Despesas/Receita)
- Adicionar microcopy interpretativo por métrica

#### 7. Visual premium
- Usar classes CSS existentes: `liquid-glass-card`, `liquid-glass-card-hero`, `liquid-glass-kpi`
- Microanimações via `transition-all duration-300`
- Hover sutil nos cards
- Skeleton loading com shimmer para estados de carregamento
- Fallbacks elegantes para dados ausentes

#### 8. Resumo financeiro do mês (novo bloco)
- 3 mini-cards com receita, despesa e resultado do período
- Variação % vs período anterior (já disponível em `usePeriodMetrics`)
- Margem estimada

### Arquivos

| Ação | Arquivo |
|------|---------|
| Reescrever | `src/pages/CompanyPage.tsx` |
| Editar | `supabase/functions/company-lookup/index.ts` (fix URL + lógica hífen) |

### Escopo restrito
- Zero novos hooks, queries ou tabelas
- Mesmos dados de `useCompanyProfile`, `useCompanyBenchmarks`, `usePeriodMetrics`
- Zero impacto em sidebar, rotas, outros menus
- Edge function `company-benchmarks` inalterada

