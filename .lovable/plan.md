

# Sidebar Premium: Azul Claro Glass com Textos Pretos

## O que muda

A sidebar vai deixar de ser escura (dark gradient) e passar a ter um fundo **azul claro premium** com efeito glass, textos e icones **pretos** com efeito de profundidade/vidro. A logo continua grande e visivel.

---

## Mudancas

### 1. `src/index.css` -- Reescrever o bloco `.sidebar-glass`

**Antes:** Gradiente escuro `hsl(222 47% 8%)` com textos brancos.

**Depois:** Fundo azul claro glass com fallback solido:

```css
.sidebar-glass [data-sidebar="sidebar"] {
  background: linear-gradient(
    180deg,
    rgba(219, 234, 254, 0.85) 0%,   /* blue-100 com alpha */
    rgba(224, 242, 254, 0.80) 50%,   /* sky-100 com alpha */
    rgba(219, 234, 254, 0.85) 100%
  ) !important;
  backdrop-filter: blur(20px) saturate(120%);
  border-right: 1px solid rgba(15, 23, 42, 0.08);
  box-shadow:
    1px 0 24px rgba(45, 126, 243, 0.06),
    inset -1px 0 0 rgba(255, 255, 255, 0.5);
}

/* Fallback para navegadores sem backdrop-filter */
@supports not (backdrop-filter: blur(1px)) {
  .sidebar-glass [data-sidebar="sidebar"] {
    background: linear-gradient(
      180deg,
      rgb(219, 234, 254) 0%,
      rgb(224, 242, 254) 100%
    ) !important;
  }
}
```

- Noise texture mantida com opacidade ajustada
- Logo glass container (`sidebar-logo-glass`) atualizado para fundo branco/alpha com borda suave escura

### 2. `src/index.css` -- Atualizar `.sidebar-logo-glass`

Trocar de `rgba(255,255,255,0.03)` (invisivel em fundo claro) para:

```css
.sidebar-logo-glass {
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-top: 1px solid rgba(255, 255, 255, 0.8);
  box-shadow:
    0 4px 16px rgba(15, 23, 42, 0.04),
    inset 0 1px 0 rgba(255, 255, 255, 0.5);
}
```

### 3. `src/index.css` -- Atualizar CSS variables do sidebar

Trocar os tokens de sidebar dark para light:

```css
--sidebar-background: 213 100% 96%;     /* azul claro */
--sidebar-foreground: 222 47% 11%;      /* quase preto */
--sidebar-border: 214 32% 91%;
--sidebar-accent: 213 100% 97%;
--sidebar-accent-foreground: 221 85% 40%;
```

### 4. `src/components/layout/AppSidebar.tsx` -- Trocar cores de texto/icones

Todas as referencias de cores de texto mudam:

| Antes | Depois |
|-------|--------|
| `text-white/65` | `text-slate-700` |
| `hover:text-white/90` | `hover:text-slate-900` |
| `hover:bg-white/[0.06]` | `hover:bg-white/50` |
| `text-white/35` (labels) | `text-slate-400` |
| `text-blue-400` (ativo) | `text-blue-600` |
| `bg-blue-500/10` (ativo) | `bg-white/60 backdrop-blur-sm shadow-sm border border-black/[0.05]` |
| `border-white/[0.06]` | `border-black/[0.06]` |
| `bg-blue-400` (indicator) | `bg-blue-600` |
| `shadow rgba(96,165,250)` | `shadow rgba(37,99,235)` |

Item ativo ganha efeito glass claro (pill branco com blur e sombra leve).

### 5. `src/components/layout/AppSidebar.tsx` -- Logo drop-shadow

Remover o `filter: drop-shadow(0 0 12px rgba(45, 126, 243, 0.25))` que era para fundo escuro. Trocar por uma sombra mais sutil adequada ao fundo claro:

```tsx
style={{ filter: 'drop-shadow(0 2px 8px rgba(15, 23, 42, 0.1))' }}
```

### 6. Efeito "liquid glass" nos textos (profundidade)

Adicionar classe CSS customizada para text-shadow sutil que da sensacao de profundidade/vidro nos textos do menu:

```css
.sidebar-glass-text {
  text-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
}
```

Aplicar nos `<span>` dos itens de menu.

---

## Resultado Visual

- Fundo azul claro translucido com blur (glass premium)
- Textos e icones pretos/slate com excelente legibilidade
- Logo grande e visivel no topo com container glass branco
- Item ativo: pill branco glass com borda suave e sombra
- Hover: fundo branco semi-transparente
- Labels de grupo: slate-400 com uppercase
- Indicador ativo: barra azul-600 (mais forte que antes)
- Contraste AA garantido (texto slate-700 sobre blue-100 = ratio >7:1)
- Funciona em desktop e mobile sem risco de "sumir"

