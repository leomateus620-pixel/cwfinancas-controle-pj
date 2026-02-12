

# Filtro Global de Periodo (Date Range) -- Desktop-Only

## Visao Geral

Implementar um filtro de periodo unico e global que controla todas as telas do app. O estado sera gerenciado via React Context, sincronizado com query string da URL e persistido no campo `preferences` da tabela `profiles` (que ja possui um campo jsonb para isso -- nao precisa criar tabela nova).

## Bloco 1 -- Context + Estado Global

Criar `src/contexts/DateRangeContext.tsx`:

```text
DateRangeProvider
  state: { from: Date, to: Date, preset: string | null }
  actions: setPreset(key), setCustomRange(from, to), reset()
```

**Presets disponíveis:**
- `7d` -- Ultimos 7 dias
- `30d` -- Ultimos 30 dias
- `3m` -- Ultimos 3 meses
- `6m` -- Ultimos 6 meses (DEFAULT)
- `12m` -- Ultimos 12 meses
- `month` -- Mes atual
- `year` -- Ano atual
- `custom` -- Intervalo manual

**Inicializacao (ordem de prioridade):**
1. Query string da URL (`?from=YYYY-MM-DD&to=YYYY-MM-DD&preset=6m`)
2. Preferencia salva em `profiles.preferences.dateRange`
3. Default: ultimos 6 meses

**Sincronizacao:**
- Ao mudar periodo: atualizar query string + salvar em `profiles.preferences` (debounced, 1s)
- Ao navegar entre paginas: ler do Context (ja em memoria), URL reflete automaticamente

**Helper para DRE:**
- Expor `monthRange: { from: "YYYY-MM", to: "YYYY-MM" }` derivado das datas, para filtrar `period_key`

## Bloco 2 -- Componente GlobalDateRangeFilter (Desktop-Only)

Criar `src/components/layout/GlobalDateRangeFilter.tsx`:

**Layout:**
- Popover com botao trigger mostrando periodo ativo (ex: "Ultimos 6 meses: 12/08/2025 - 12/02/2026")
- Dentro do popover:
  - Grid de chips para presets (7d, 30d, 3m, 6m, 12m, Mes, Ano)
  - Separador
  - Secao "Personalizar" com dois DatePickers (inicio/fim) + botao "Aplicar"
- Badge discreto no trigger mostrando o preset ativo

**Responsivo:**
- `hidden lg:flex` para o componente completo
- Em `< lg`: nada visivel (desktop-only conforme requisito)

**Posicionamento:**
- Renderizado dentro do `DashboardHeader`, ao lado do botao de exportar (substituindo o botao estatico "Jan - Dez, 2024" que existe no OverviewPage)

## Bloco 3 -- Integrar Provider no App

Modificar `src/App.tsx`:
- Envolver as rotas protegidas com `<DateRangeProvider>` (dentro de `AuthProvider`, pois precisa do user para persistencia)

Modificar `src/components/layout/DashboardLayout.tsx`:
- Nao precisa de alteracao estrutural, o Context ja estara disponivel

Modificar `src/components/layout/DashboardHeader.tsx`:
- Adicionar `<GlobalDateRangeFilter />` no header, entre a busca e os botoes de acao

## Bloco 4 -- Atualizar Hooks de Dados

**`useTransactions`:**
- Importar `useDateRange()` do Context
- Sempre incluir `startDate` e `endDate` do range global nos filtros da query
- O `queryKey` ja inclui `filters`, entao mudanca de periodo invalida automaticamente

**`useHomeDashboard`:**
- Substituir calculos hardcoded de "mes atual" e "mes anterior" por datas derivadas do range global
- Adaptar KPIs, tendencia diaria, categorias e alertas para o periodo selecionado

**`useCashFlow`:**
- Substituir o parametro `months` fixo por `from`/`to` do range global
- Gerar buckets mensais apenas dentro do intervalo selecionado

**`useDRE`:**
- Importar `monthRange` do Context
- Filtrar `periodOptions` para mostrar apenas periodos dentro do range
- Ao selecionar um periodo na DRE, respeitar o filtro global (ex: se range = ultimos 3 meses, so mostrar Jun-Ago)

**`useFinanceInsights`:**
- Passar `dateFrom` e `dateTo` do range global como parametros

**`useInvoices`** (se houver filtro por data):
- Aplicar range global no filtro de faturas

## Bloco 5 -- Atualizar Paginas

**Todas as paginas afetadas:**
- Remover botoes/selects de periodo locais que existam (ex: botao "Jan - Dez, 2024" no OverviewPage, "Ultimos 12 meses" no CashFlowPage)
- Adicionar badge discreto mostrando periodo ativo abaixo do titulo, formato: "Periodo: 12/08/2025 - 12/02/2026 (X transacoes)"
- O filtro principal fica no header (Bloco 2), nao precisa duplicar em cada pagina

**Paginas especificas:**

`OverviewPage`: remover botao estatico "Jan - Dez, 2024", dados ja virao filtrados via hook

`HomePage`: adaptar greeting e calculos para usar range global em vez de "mes atual" hardcoded

`IncomePage` / `ExpensesPage`: dados ja filtrados pelo hook; manter filtros locais de categoria/busca como complemento

`CashFlowPage`: remover botao "Ultimos 12 meses", usar range global

`DREPage`: manter select de periodo individual (cada mes da DRE), mas filtrar opcoes pelo range global

`ForecastsPage`: usar range global como base historica para projecoes (esta pagina usa dados hardcoded hoje -- nao alterar dados ficticios, apenas preparar para quando tiver dados reais)

## Bloco 6 -- Persistencia via profiles.preferences

A tabela `profiles` ja tem um campo `preferences jsonb`. Salvar nele:

```json
{
  "dateRange": {
    "preset": "6m",
    "from": "2025-08-12",
    "to": "2026-02-12"
  }
}
```

- Ao carregar o app: ler de `profiles.preferences.dateRange`
- Ao alterar: fazer UPDATE no campo `preferences` (merge com valores existentes)
- Debounce de 1 segundo para nao fazer update a cada clique

## Arquivos Criados/Modificados

| Arquivo | Acao |
|---|---|
| `src/contexts/DateRangeContext.tsx` | Criar (Context + Provider + hook useDateRange) |
| `src/components/layout/GlobalDateRangeFilter.tsx` | Criar (componente visual) |
| `src/App.tsx` | Adicionar DateRangeProvider |
| `src/components/layout/DashboardHeader.tsx` | Adicionar GlobalDateRangeFilter |
| `src/hooks/useTransactions.ts` | Integrar range global nos filtros |
| `src/hooks/useHomeDashboard.ts` | Usar range global em vez de mes atual |
| `src/hooks/useCashFlow.ts` | Usar range global em vez de N meses fixo |
| `src/hooks/useDRE.ts` | Filtrar periodos pelo monthRange global |
| `src/hooks/useFinanceInsights.ts` | Passar datas do range global |
| `src/pages/OverviewPage.tsx` | Remover botao de periodo local |
| `src/pages/CashFlowPage.tsx` | Remover botao de periodo local |
| `src/pages/DREPage.tsx` | Filtrar opcoes de periodo pelo range |
| `src/pages/HomePage.tsx` | Adaptar para range global |

## Detalhes Tecnicos

- O Context usa `useSearchParams` do React Router para sincronizar com a URL
- A persistencia usa o campo `preferences` existente na tabela `profiles` -- sem necessidade de migracao SQL
- O debounce de persistencia usa `useRef` + `setTimeout` para evitar writes excessivos
- O `queryKey` de cada hook inclui `from`/`to`, garantindo que a troca de periodo dispara refetch automatico via React Query
- Para a DRE, o helper `monthRange` converte `from: Date` para `"YYYY-MM"` usando `format(from, "yyyy-MM")` do date-fns
- Presets sao calculados a partir de `new Date()` no momento da selecao, nao sao datas fixas
- A URL query string permite deep linking: compartilhar uma URL com periodo especifico funciona

