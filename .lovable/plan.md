
# Sidebar com categorias colapsáveis

Hoje a sidebar mostra todos os ~20 itens sempre visíveis, o que polui muito. A proposta é mostrar apenas **um item-âncora por categoria**, e expandir os demais ao clicar.

## Agrupamento proposto

Cada grupo tem um **item-âncora** (sempre visível, navega para a página principal da categoria) e **sub-itens** (aparecem ao expandir). O grupo expande automaticamente quando a rota atual pertence a ele.

| Categoria | Item-âncora visível | Sub-itens (ao expandir) |
|---|---|---|
| **Visão Geral** | Home (`/dashboard`) | Dashboard executivo, Minha Empresa |
| **Financeiro** | Fluxo de Caixa | Receitas, Despesas, DRE, Contas a Pagar/Receber, Cartão de Crédito, Previsões |
| **Demandas** | Dashboard de Demandas | Nova Demanda, Recebidas, *(gestor)* Aprovações Pendentes, Documentos, Configurações da Central |
| **Ferramentas** | Insights IA | Google Sheets, Upload de Dados, Notas Fiscais, Conversor de Extratos |
| **Configurações** | (rodapé fixo, sem submenu) | — |

Resultado: de ~20 linhas visíveis caímos para **5 linhas-âncora + rodapé**, com expansão sob demanda.

## Comportamento

- Clicar na linha-âncora: **navega para a rota da âncora** E alterna (toggle) a abertura do submenu — duas ações no mesmo clique. Um chevron à direita indica aberto/fechado e rotaciona com transição suave.
- Ao carregar a página, o grupo que contém a rota ativa abre automaticamente (`defaultOpen` derivado da rota).
- Sub-item ativo recebe o mesmo destaque visual (barra lateral primária, fundo glass) já usado.
- Quando a sidebar inteira está colapsada (modo ícone), os submenus não aparecem inline — o item-âncora continua como ícone com tooltip, e o `SidebarMenuSub` é ocultado pelo CSS padrão do shadcn.
- Badge de "Aprovações Pendentes" continua funcionando dentro do submenu.

## Detalhes técnicos

- Refatorar `src/components/layout/AppSidebar.tsx` para usar uma estrutura de dados de grupos com `anchor` + `children[]`.
- Cada grupo vira `<Collapsible>` (shadcn) envolvendo um `SidebarMenuItem` (âncora com NavLink + botão de toggle) e um `<CollapsibleContent>` com `SidebarMenuSub` / `SidebarMenuSubButton` para os filhos.
- Estado de abertura controlado por `useState` por grupo, inicializado com base em `useLocation()` (grupo abre se alguma rota filha bate com o `pathname`).
- Reaproveitar o estilo atual (`sidebar-nav-active`, indicador lateral, badges) nos sub-itens via `SidebarMenuSubButton` com classes equivalentes.
- Manter `Configurações` no `SidebarFooter` como link único (sem grupo).
- Sem mudanças de rota, RLS, hooks de dados ou backend — apenas reorganização de UI da sidebar.

## Fora de escopo

- Reordenar/renomear páginas existentes.
- Mexer em qualquer página, hook ou migração.
- Persistir o estado aberto/fechado entre reloads (pode entrar numa próxima iteração se quiser).
