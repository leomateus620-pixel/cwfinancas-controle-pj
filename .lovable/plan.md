

# Sidebar Premium — Dark Liquid Glass com Bordas Azuis

## O que muda

A sidebar (menu lateral) passara de fundo branco "apagado" para um visual **dark premium com liquid glass preto texturizado** e **bordas com glow azul**, criando contraste sofisticado com o conteudo claro.

---

## Mudancas Detalhadas

### 1. `src/index.css` — Variaveis da Sidebar

Atualizar as CSS variables da sidebar para tema dark:

- `--sidebar-background`: de `0 0% 100%` (branco) para `222 47% 7%` (dark premium)
- `--sidebar-foreground`: de `215 16% 47%` para `210 40% 80%` (texto claro)
- `--sidebar-accent`: de `213 100% 97%` para `221 85% 53% / 0.12` (azul sutil sobre dark)
- `--sidebar-accent-foreground`: manter `221 85% 53%` (azul primary)
- `--sidebar-border`: de `214 32% 91%` para `221 85% 53% / 0.15` (borda azul sutil)

### 2. `src/index.css` — Nova classe `.sidebar-glass`

Criar classe CSS dedicada para o efeito liquid glass dark da sidebar:

- Background: gradiente escuro com textura sutil (mesh gradient com tons azul/roxo a ~3-5% opacidade)
- Borda direita com glow azul: `border-right: 1px solid rgba(45, 126, 243, 0.2)` + box-shadow azul difuso
- Pseudo-element `::after` para inner highlight no topo (brilho sutil)
- Textura noise overlay (igual a Home, mas sobre fundo dark)

### 3. `src/components/layout/AppSidebar.tsx` — Aplicar estilo dark glass

- Trocar `className="border-r border-border bg-sidebar"` por `className="sidebar-glass"`
- Header: texto branco (`text-white`, `text-white/60`), borda inferior com glow azul
- Group labels: `text-white/40` (em vez de `text-muted-foreground`)
- Menu items: `text-white/70` no estado normal, `text-white` no hover
- Active state: fundo `bg-white/10` com borda lateral azul brilhante
- Hover state: `bg-white/[0.06]` com transicao suave
- Footer (Configuracoes): mesma linguagem visual
- Logo: adicionar glow sutil azul ao redor

### 4. `src/components/ui/sidebar.tsx` — Ajuste no container interno

O `data-sidebar="sidebar"` div interno usa `bg-sidebar`. Garantir que a classe `.sidebar-glass` se sobreponha corretamente, sem conflito.

---

## Detalhes Visuais

**Fundo da sidebar:**
```css
.sidebar-glass {
  background: linear-gradient(
    180deg,
    hsl(222 47% 8%) 0%,
    hsl(222 47% 6%) 100%
  );
  border-right: 1px solid rgba(45, 126, 243, 0.2);
  box-shadow:
    1px 0 20px rgba(45, 126, 243, 0.06),
    inset -1px 0 0 rgba(255, 255, 255, 0.03);
}
```

**Cores de texto na sidebar:**
- Titulos (CW Financas): `text-white`
- Subtitulo (Controle PJ): `text-white/50`
- Labels de grupo (Principal, Ferramentas): `text-white/35`
- Items inativos: `text-white/65`
- Items hover: `text-white/90` com `bg-white/[0.06]`
- Item ativo: `text-blue-400` (primary light) com `bg-blue-500/10` e barra lateral azul brilhante
- Bordas de secao: `border-white/[0.06]`

**Borda direita (glow azul):**
- `border-right: 1px solid rgba(45, 126, 243, 0.2)`
- `box-shadow: 1px 0 20px rgba(45, 126, 243, 0.06)` (glow difuso para a direita)

---

## Resultado Esperado

- Sidebar com fundo escuro premium (quase preto com tom azulado)
- Borda direita com brilho azul sutil (liquid glass border)
- Texto claro com hierarquia visual definida
- Item ativo destacado com fundo azul translucido + barra lateral brilhante
- Hover com leve iluminacao
- Contraste sofisticado entre sidebar dark e conteudo light
- Estetica coerente com "liquid glass preto texturizado"

