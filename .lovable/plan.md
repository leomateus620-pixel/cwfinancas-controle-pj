# Correções no Menu Lateral (AppSidebar)

## Diagnóstico (raiz dos bugs)

Após inspeção E2E de `src/components/layout/AppSidebar.tsx`:

1. **Conflito navegar × abrir/fechar no mesmo clique.** O cartão-âncora é um `<NavLink>` que, no mesmo `onClick`, chama `toggleGroup`. Ou seja, todo clique navega E alterna o grupo — gera o efeito de "abre rápido e buga".

2. **Re-abertura forçada impede o fechamento.** O `useEffect` em `[currentPath, isManager]` faz: "se o grupo contém a rota ativa → abrir". Como o clique no âncora *navega para a própria rota do grupo*, o efeito dispara e re-abre imediatamente o grupo que o usuário acabou de tentar fechar. Resultado: **impossível colapsar** o grupo ativo.

3. **Tilt 3D no `group-hover` do mesmo elemento clicável** causa micro-tremor visual durante o press (rotateY + scale + translateZ em um alvo de clique) — reforça a sensação de "bugado".

4. **Sem alvo dedicado** (chevron) para toggle: o usuário não tem forma clara de só abrir/fechar sem trocar de rota.

5. **Animação do `Collapsible`** funciona, mas a re-renderização do `useEffect` interrompe o ciclo `data-state` quando navegação acontece junto.

---

## Correções planejadas (somente `src/components/layout/AppSidebar.tsx`)

### 1. Separar navegação de toggle (boa prática shadcn/Radix)

- **Área principal do cartão (ícone + título + KPI)**: apenas navega via `NavLink`.
- **Chevron**: vira `<button type="button">` próprio, com `e.preventDefault()` + `e.stopPropagation()`, responsável exclusivo por abrir/fechar.
- Tamanho de toque do chevron: 32×32 com `aria-label="Expandir/Recolher {grupo}"` e `aria-expanded`.

### 2. Política de abertura previsível

- **Mount**: grupos que contêm a rota ativa começam abertos (já é assim).
- **Navegação a um filho**: abrir o grupo correspondente automaticamente.
- **Navegação ao âncora**: abrir se estiver fechado, **nunca fechar**, e **respeitar fechamento manual** posterior do usuário.
- Substituir o `useEffect` por uma versão que só *abre* quando a rota muda para uma URL pertencente ao grupo, sem sobrescrever decisão manual de fechar feita depois.

Implementação: guardar `lastPath` em ref; quando `currentPath !== lastPath`, calcular qual grupo passou a conter a rota ativa e dar `setOpenGroups(prev => ({...prev, [id]: true}))` apenas para ele.

### 3. Estabilizar o feedback tátil

- Remover `rotateY/rotateX/translateZ` do `group-hover` do cartão (causa jitter durante o press).
- Manter sensação premium com: `scale(1.015)` + sombra crescendo + leve `translateY(-1px)` em hover, e `scale(0.985)` no `:active`.
- Conservar o "sheen" superior, o glow do estado ativo e os accents de cor — só remover a rotação que causava o bug visual.
- Transições: `transition-[transform,box-shadow,background,border-color] duration-200 ease-out` (mais curto = menos sensação de "preso").

### 4. Acessibilidade & estado

- `aria-current="page"` no link ativo.
- `aria-expanded={open}` e `aria-controls={collapsibleId}` no botão chevron.
- Focus ring visível (`focus-visible:ring-2 ring-primary/40`) no link e no chevron.
- Em modo `collapsed` (sidebar minimizada): chevron some, clique apenas navega — já era o comportamento, mantido.

### 5. Animação de colapso suave

- Manter `data-[state=open]:animate-accordion-down` / `closed:animate-accordion-up` do `CollapsibleContent`.
- Garantir `overflow-hidden` e `will-change: height` para evitar flicker durante a transição.

### 6. Detalhes finos

- Chevron: rotação `rotate-90` quando aberto (já existe), com `transition-transform duration-200`.
- Quando o grupo NÃO tem filhos visíveis (ex.: usuário comum em Demandas), não renderiza chevron e o cartão só navega.
- Manter KPIs (pulse/delta/count/shimmer) intactos.

---

## Fora de escopo

- Backend, rotas, hooks de dados (`useHomeDashboard`, `usePendingApprovalsCount`).
- Conteúdo dos submenus e páginas.
- Persistência do estado aberto/fechado entre reloads (pode entrar depois se desejar).
- Mudanças no `Sidebar` shadcn base.

---

## Critérios de aceite

1. Clicar no âncora de um grupo **fechado** → navega e abre o grupo (uma única ação fluida, sem flicker).
2. Clicar no âncora de um grupo **aberto** → apenas navega; o grupo permanece aberto.
3. Clicar no **chevron** → alterna abrir/fechar **sem** mudar a rota.
4. Fechar manualmente o grupo ativo → permanece fechado mesmo navegando entre filhos via URL externa (até nova navegação para um filho via menu, que reabre).
5. Sem "tremor" durante o press. Hover dá lift sutil + sombra, press dá compressão leve.
6. Funciona em sidebar colapsada (só ícones, sem chevron, só navegação + tooltip).
7. Teclado: Tab move entre âncora e chevron; Enter ativa cada um conforme função.