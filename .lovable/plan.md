
# Header da Sidebar: Logo em destaque com Liquid Glass

## O que muda

A area do header da sidebar (acima dos menus) vai exibir **apenas a logo** (imagem da maleta azul/verde), sem os textos "CW Financas" e "Controle PJ". A logo ocupara toda a largura disponivel do header, em alta resolucao, com bordas em estilo liquid glass texturizado.

---

## Passos

### 1. Copiar a nova logo para o projeto

Copiar a imagem enviada (`ChatGPT_Image_12_de_fev._de_2026_07_56_39.png`) para `src/assets/logo-icon.png` para uso como asset importado no componente.

### 2. Atualizar `src/components/layout/AppSidebar.tsx` — Header

Substituir o bloco do header atual por:

- Remover os textos "CW Financas" e "Controle PJ"
- Exibir apenas a logo centralizada, ocupando toda a largura do header
- A logo tera tamanho generoso (~80% da largura da sidebar) com `object-contain`
- Envolver a logo num container com efeito liquid glass nas bordas:
  - Borda arredondada (`rounded-2xl`)
  - Borda sutil azul brilhante (`border border-blue-500/20`)
  - Box-shadow com glow azul difuso
  - Background com leve transparencia glass (`bg-white/[0.04]` + `backdrop-blur`)
- Padding vertical confortavel para dar respiro
- No modo collapsed (icone), a logo reduz para um icone pequeno (`w-8 h-8`)

### 3. Adicionar CSS para `.sidebar-logo-glass` em `src/index.css`

Nova classe CSS para o container da logo:

```css
.sidebar-logo-glass {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(45, 126, 243, 0.15);
  border-radius: 1rem;
  box-shadow:
    0 0 20px rgba(45, 126, 243, 0.06),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(8px);
  position: relative;
  overflow: hidden;
}

.sidebar-logo-glass::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    135deg,
    rgba(45, 126, 243, 0.05) 0%,
    transparent 50%,
    rgba(45, 126, 243, 0.03) 100%
  );
  pointer-events: none;
  border-radius: inherit;
}
```

---

## Resultado Visual

- Header da sidebar exibe apenas a logo (maleta azul/verde) grande e centralizada
- Container da logo com bordas liquid glass azul brilhante (glow sutil)
- Textura de vidro com gradiente translucido e backdrop-blur
- Sem textos — visual limpo e premium
- No modo collapsed, a logo aparece como icone compacto
- Resolucao 4K preservada pela imagem original em alta qualidade
