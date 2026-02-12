
# Previsoes Financeiras -- Implementacao Completa (Desktop-Only)

## Visao Geral

Transformar a pagina de Previsoes (atualmente com dados hardcoded) em um modulo funcional que usa dados reais de transacoes + validacao com DRE para gerar previsoes financeiras com cenarios (otimista/base/pessimista) e insights via IA.

## Bloco 1 -- Banco de Dados (2 tabelas novas)

### Tabela `forecast_monthly`

```text
id              uuid PK default gen_random_uuid()
user_id         uuid NOT NULL
sheet_id        uuid (nullable, ref google_sheet_connections)
month_key       text NOT NULL (formato YYYY-MM)
receita_real    numeric default 0
despesa_real    numeric default 0
saldo_real      numeric default 0
receita_prev_base    numeric
despesa_prev_base    numeric
saldo_prev_base      numeric
receita_prev_opt     numeric
receita_prev_pess    numeric
despesa_prev_opt     numeric
despesa_prev_pess    numeric
saldo_prev_opt       numeric
saldo_prev_pess      numeric
confidence_score     numeric default 0
validation_status    text default 'ok'
calibration_notes    jsonb default '[]'
is_forecast          boolean default false
created_at           timestamptz default now()
updated_at           timestamptz default now()
```

RLS: user_id = auth.uid() para SELECT/INSERT/UPDATE/DELETE.
Unique constraint: (user_id, sheet_id, month_key).

### Tabela `forecast_insights`

```text
id               uuid PK default gen_random_uuid()
user_id          uuid NOT NULL
sheet_id         uuid (nullable)
horizon          text NOT NULL ('3m','6m','12m')
summary          text
insights         jsonb default '[]'
risks            jsonb default '[]'
opportunities    jsonb default '[]'
recommendations  jsonb default '[]'
metadata         jsonb default '{}'
generated_at     timestamptz default now()
```

RLS: user_id = auth.uid() para SELECT/INSERT/DELETE.

## Bloco 2 -- Edge Function `build-forecast`

Criar `supabase/functions/build-forecast/index.ts`

**Entrada:**
```json
{
  "sheet_id": "uuid | null",
  "horizon": "3m | 6m | 12m"
}
```

**Processamento em 4 etapas:**

### Etapa 1: Consolidar dataset mensal

- Buscar todas as transacoes do usuario (filtradas por sheet_id se fornecido)
- Agrupar por month_key (YYYY-MM)
- Para cada mes: receita_total, despesa_total, saldo
- Calcular top 5 categorias de receita e despesa
- Calcular volatilidade (desvio padrao) de receita e despesa

### Etapa 2: Validar com DRE

- Para cada month_key, buscar `dre_periods` + `dre_lines` do mesmo mes
- Extrair receita_liquida_dre, despesas_totais_dre, resultado_dre (usando a mesma logica de `calculateKPIs` do hook useDRE)
- Calcular diferencas (diff_receita, diff_despesa, diff_resultado)
- Se |diff| > 15%: marcar validation_status = 'warning' e calcular calibration_factor
- Aplicar calibracao ao dataset (ajustar totais sem alterar transacoes originais)

### Etapa 3: Motor baseline deterministico

- Exigir minimo de 4 meses com dados reais, senao retornar erro
- Calcular media movel ponderada (pesos decrescentes: mes mais recente = peso maior)
- Calcular tendencia via regressao linear simples (slope) para receita, despesa e saldo
- Ajustar por sazonalidade: se houver dados do mesmo mes do ano anterior, aplicar fator sazonal
- Gerar previsao para N meses (3, 6 ou 12):
  - Base: media ponderada + tendencia + sazonalidade
  - Otimista: base + 1 desvio padrao
  - Pessimista: base - 1 desvio padrao
- Calcular confidence_score (0-100):
  - Penalizar por: poucos meses de dados, alta volatilidade, divergencia com DRE, meses com dados incompletos

### Etapa 4: Salvar no banco

- Upsert em `forecast_monthly` (dados reais + previsoes)
- Retornar dataset completo

**Nao chama IA** -- o motor e 100% deterministico para velocidade e estabilidade.

## Bloco 3 -- Edge Function `forecast-insights` (IA)

Criar `supabase/functions/forecast-insights/index.ts`

**Entrada:**
```json
{
  "sheet_id": "uuid | null",
  "horizon": "3m | 6m | 12m"
}
```

**Processamento:**

1. Ler `forecast_monthly` do usuario (dados reais + previsoes)
2. Calcular metricas derivadas:
   - Tendencia de receita (crescendo/caindo, % por mes)
   - Top categorias que mais cresceram/cairam
   - Recorrencias detectadas
   - Gaps de caixa (meses com saldo negativo)
3. Montar prompt estruturado para a IA (Lovable AI, modelo `google/gemini-3-flash-preview`)
4. Solicitar resposta via tool calling (structured output) com schema:
   - summary: string (resumo executivo estilo CFO, 2-3 frases)
   - insights: array de { title, evidence, impact, recommendation }
   - risks: array de { title, evidence, severity, mitigation }
   - opportunities: array de { title, evidence, potential, next_steps }
   - recommendations: array de { title, action, expected_impact }
5. Salvar em `forecast_insights`
6. Retornar insights

**Regras da IA:**
- A IA NAO gera numeros -- apenas explica e contextualiza os numeros do baseline
- Deve citar evidencias numericas reais
- Tom direto, estilo "resumo do CFO"

## Bloco 4 -- Hook `useForecast`

Criar `src/hooks/useForecast.ts`

```text
useForecast(sheetId?: string)
  returns:
    - forecastData: ForecastMonthly[] (historico + previsao)
    - insights: ForecastInsights | null
    - isLoading, isGenerating
    - generate(horizon): mutation que chama build-forecast + forecast-insights
    - hasEnoughData: boolean (>= 4 meses)
    - validationWarnings: string[]
    - confidence: number
```

- Busca dados de `forecast_monthly` e `forecast_insights` via queries
- Mutation `generate` chama as 2 edge functions em sequencia
- Invalida queries apos geracao

## Bloco 5 -- UI/UX Redesign (Desktop-Only)

### Layout geral

```text
+--------------------------------------------------+
| Previsoes Financeiras         [3m|6m|12m] [Gerar] |
+--------------------------------------------------+
| [Card Receita] [Card Margem] [Card Confianca] [Card Risco] |
+--------------------------------------------------+
| Grafico Principal (historico + previsao + bandas) |
| Toggle: Receita / Despesa / Saldo                |
| Toggle: Comparar com DRE                         |
+--------------------------------------------------+
| Fluxo de Caixa Projetado  |  Insights IA         |
| (lista mensal)            |  - O que acontece     |
|                           |  - Riscos (chips)     |
|                           |  - Oportunidades      |
|                           |  - Acoes sugeridas    |
+--------------------------------------------------+
```

### Design liquid glass azul marinho

Adicionar nova classe CSS `liquid-glass-navy`:

```text
background: rgba(10, 25, 60, 0.06)
backdrop-filter: blur(20px) saturate(115%)
border: 1px solid rgba(10, 25, 60, 0.08)
border-top: 1px solid rgba(255, 255, 255, 0.6)
border-radius: 20px
box-shadow: 0 8px 32px rgba(10, 25, 60, 0.06), inset 0 1px 0 rgba(255,255,255,0.4)
```

Titulos em azul marinho escuro (`text-[#0a1940]`), numeros nas cores atuais do app.

### Estados

- **Sem dados (< 4 meses):** CTA "Sincronize pelo menos 4 meses de transacoes para gerar previsoes" com botao para ir a Google Sheets
- **Gerando:** skeleton + progress indicator
- **Com warning:** banner discreto "Diferenca detectada entre transacoes e DRE. Ajuste aplicado automaticamente."
- **Sucesso:** dashboard completo

### Grafico principal

- Area chart com 3 camadas:
  - Linha solida azul: dados reais (historico)
  - Linha tracejada verde: previsao base
  - Faixa cinza translucida: banda otimista-pessimista
- ReferenceLine vertical separando historico de previsao
- Toggle de series: Receita / Despesa / Saldo (botoes no topo do grafico)
- Toggle "Comparar com DRE": adiciona marcadores do DRE como pontos
- Tooltip rico: mes, valor real, valor previsto, variacao %

### Responsivo

- `hidden lg:block` para todo o conteudo
- `lg:hidden` mostra mensagem "Previsoes financeiras disponiveis apenas no desktop"

## Bloco 6 -- Atualizacao do config.toml

Adicionar:
```toml
[functions.build-forecast]
verify_jwt = false

[functions.forecast-insights]
verify_jwt = false
```

## Arquivos Criados/Modificados

| Arquivo | Acao |
|---|---|
| Migracao SQL | Criar tabelas forecast_monthly e forecast_insights com RLS |
| `supabase/functions/build-forecast/index.ts` | Criar (dataset builder + motor baseline) |
| `supabase/functions/forecast-insights/index.ts` | Criar (IA para insights) |
| `supabase/config.toml` | Adicionar 2 funcoes |
| `src/hooks/useForecast.ts` | Criar (hook principal) |
| `src/pages/ForecastsPage.tsx` | Reescrever completamente (desktop-only, liquid glass navy, dados reais) |
| `src/index.css` | Adicionar classe `.liquid-glass-navy` |

## Detalhes Tecnicos

- O motor baseline e 100% deterministico (sem IA) para velocidade e previsibilidade
- A IA so e chamada para gerar insights textuais, nunca para gerar numeros
- A validacao com DRE usa calibration_factor para ajustar previsoes sem alterar transacoes originais
- `confidence_score` cai quando: < 6 meses de dados, volatilidade > 30%, divergencia DRE > 15%
- Transacoes manuais (sem source_sheet_id) sao incluidas se sheet_id = null
- A edge function `build-forecast` usa service_role para acessar dados de DRE do mesmo usuario
- O grafico usa recharts (ja instalado) com AreaChart + ReferenceLine
- Previsoes sao recalculadas a cada clique em "Atualizar Previsao", nao automaticamente
- Minimo de 4 meses com dados reais para habilitar previsoes (evita projecoes sem base estatistica)
