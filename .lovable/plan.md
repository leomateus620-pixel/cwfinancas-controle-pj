
# Cards-âncora da sidebar com física 3D Liquid Glass

Implementar a direção **"3D Tilt + KPIs"** escolhida nos cards-âncora da sidebar (Home, Fluxo de Caixa, Dashboard de Demandas, Insights IA), trazendo profundidade real e uma micro-informação útil por card.

## O que cada card terá

| Card-âncora | Estado padrão | Mini-informação à direita |
|---|---|---|
| **Home** | Ativo quando rota `/dashboard` — fundo `blue-500/10`, borda azul glow, ícone em quadrado azul sólido com glow | Dot pulsante azul (status "ao vivo") |
| **Fluxo de Caixa** | Glass branco translúcido | Badge verde com **Δ% MoM** do resultado operacional (vem de `useHomeDashboard`) |
| **Dashboard de Demandas** | Glass branco translúcido | Badge laranja com **contador** de demandas pendentes (reaproveita `usePendingApprovalsCount` para gestor; usuário comum vê contador de demandas próprias em aberto via `useFinancialDemands`) |
| **Insights IA** | Glass branco translúcido com leve tinta indigo no hover | Pill shimmer roxo→azul roxo (indicador "IA processando") |

Cards sub-itens (dentro do submenu) **mantêm** o estilo discreto atual (não recebem tilt).

## Física 3D (Liquid Glass)

- Container da lista recebe `perspective: 1000px` para habilitar transformações 3D reais.
- Card em repouso: `rounded-2xl`, `backdrop-blur-2xl/3xl`, borda `white/60`, sombra `0 4px 12px rgba(0,0,0,0.03)`.
- **Hover** (transição 300ms `ease-out`):
  - `scale(1.03)` + `rotateY(-6deg)` + `translateZ(4px)` → sensação tátil de cartão flutuando e girando
  - Sombra aumenta para `0 20px 40px` na cor do card
  - Borda fica mais brilhante (`white/80` ou cor temática)
- **Active press**: `scale(0.95)` para feedback tátil.
- **Chevron** rotaciona 90° quando o grupo está aberto, com mesma duração.
- Quando a sidebar está colapsada (modo ícone), tilt e KPIs são desativados — só o ícone permanece.

## Detalhes técnicos

- Editar **apenas** `src/components/layout/AppSidebar.tsx`.
- Adicionar `perspective: 1000px` via inline style no `SidebarMenu` que lista os grupos.
- Reescrever a função `renderAnchor` para suportar:
  - `accent` por grupo (`blue` | `emerald` | `orange` | `indigo`) controlando cor da borda hover, glow e ícone quando ativo.
  - `kpiSlot` por grupo (componente React injetado): dot pulse, delta %, contador, shimmer.
- Criar um pequeno helper `<AnchorKpi>` por tipo (`pulse`, `delta`, `count`, `shimmer`) dentro do mesmo arquivo (componentes pequenos, não justifica arquivo novo).
- Buscar valores reais:
  - Δ MoM Fluxo de Caixa → `useHomeDashboard()` (já existe), campo de variação do resultado.
  - Contador Demandas → para gestor usa `usePendingApprovalsCount`; para usuário comum usa contagem `recebidas/aguardando_documentos` via `useFinancialDemands` (filtro mínimo, sem nova request — reaproveita cache).
  - Insights IA → shimmer estático (sem dado dinâmico real, é apenas indicador visual).
- Sub-itens permanecem com o estilo atual (sem tilt) para preservar hierarquia.
- Manter `keyframes shimmer` no `tailwind.config.ts` se ainda não existir (adicionar se faltar).

## Fora de escopo

- Mexer em qualquer página, hook de dados de fato (apenas leitura para o KPI), rotas ou backend.
- Aplicar tilt fora da sidebar.
- Persistir estado aberto/fechado entre reloads.
