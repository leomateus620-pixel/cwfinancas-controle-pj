
# Filtro de Periodo: Visibilidade Seletiva + Design Liquid Glass

## O que muda

### 1. Visibilidade por rota
O filtro sera exibido APENAS nestas paginas:
- `/overview` (Dashboard)
- `/income` (Receitas)
- `/expenses` (Despesas)
- `/cash-flow` (Fluxo de Caixa)

Sera REMOVIDO (oculto) de:
- `/` (Home)
- `/dre` (DRE)
- `/forecasts` (Previsoes)
- `/google-sheets` (Google Sheets)
- `/insights` (Insights IA)
- `/settings`, `/invoices`, `/upload`

### 2. Redesign Liquid Glass

O botao trigger atual (outline com badge) sera substituido por um visual liquid glass texturizado, consistente com os cards da Home:

- Fundo translucido (`rgba(255,255,255,0.65)`) com `backdrop-filter: blur`
- Borda sutil com borda-top luminosa
- Sombra interna suave (`inset 0 1px 0 rgba(255,255,255,0.5)`)
- Icone de calendario + texto do preset + datas em formato compacto
- Hover com elevacao e borda mais visivel

O popover tambem recebera estilo glass com fundo translucido e blur.

### 3. Simplificacao do popover

- Manter presets como chips (7d, 30d, 3m, 6m, 12m, Mes, Ano) -- sao simples e rapidos
- Manter secao "Personalizar" com dois calendarios lado a lado
- Sem mudancas de logica, apenas visual

## Arquivos modificados

| Arquivo | Acao |
|---|---|
| `src/components/layout/GlobalDateRangeFilter.tsx` | Adicionar logica de rota (`useLocation`) para mostrar/ocultar + redesign liquid glass no trigger e popover |

## Detalhes tecnicos

- Usar `useLocation()` do React Router para verificar `pathname`
- Lista de rotas permitidas: `["/overview", "/income", "/expenses", "/cash-flow"]`
- Se a rota atual nao estiver na lista, retornar `null`
- O trigger usara classes CSS inline com o mesmo pattern do `.liquid-glass-compact` ja definido no `index.css`
- O popover usara `glass-premium` como fundo
- Apenas 1 arquivo modificado, sem impacto em logica de dados
