
# Trocar a logo da sidebar

## O que sera feito

1. Copiar a nova imagem enviada para `src/assets/logo-full.png` (substituindo a atual).
2. Ajustar o header da sidebar para que a logo fique com boa proporcao e visibilidade no desktop, sem espacamento excessivo (remover o wrapper glass grande que afasta a logo do conteudo).

## Mudancas

### 1. Asset: copiar nova logo
- Copiar `user-uploads://ChatGPT_Image_12_de_fev._de_2026_08_34_39.png` para `src/assets/logo-full.png`

### 2. `src/components/layout/AppSidebar.tsx` (linhas 67-77)

Simplificar o header removendo o container glass com altura fixa que cria espaco desnecessario. A logo fica direto no header com tamanho adequado:

```tsx
<SidebarHeader className={`border-b border-black/[0.06] ${collapsed ? 'p-2' : 'px-3 py-3 md:py-4'}`}>
  <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-center'}`}>
    <img 
      src={collapsed ? logoIcon : logoFull} 
      alt="CW Financas" 
      className={`object-contain transition-all duration-300 ${collapsed ? 'w-9 h-9' : 'h-10 md:h-16 w-auto'}`}
      style={{ filter: 'drop-shadow(0 2px 6px rgba(15, 23, 42, 0.08))' }}
    />
  </div>
</SidebarHeader>
```

Mudancas principais:
- Remove o wrapper glass (rounded-2xl, bg-white, backdrop-blur, shadow, border, alturas fixas) que criava um "cartao" e afastava a logo
- Logo no desktop: `md:h-16` (64px) -- boa proporcao para a sidebar de 16rem sem ficar apertada
- Logo no mobile: `h-10` (40px) -- compacta mas visivel
- Centralizada em ambos os breakpoints
- Sem padding lateral extra (px-3/md:px-0 removidos) para a logo ocupar o espaco natural
