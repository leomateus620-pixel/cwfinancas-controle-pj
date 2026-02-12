
# Logo Responsiva: Grande no Desktop, Compacta no Mobile

## Problema

O header usa a variavel `collapsed` (estado de colapso icon-mode) para definir tamanhos, mas isso nao distingue mobile de desktop. A logo fica pequena em ambos.

## Solucao

Usar breakpoints Tailwind (`md:`) para separar os tamanhos, e manter `collapsed` apenas para o estado icon-collapsed do desktop.

## Mudanca unica: `src/components/layout/AppSidebar.tsx` (linhas 67-77)

Reescrever o bloco do SidebarHeader:

```tsx
<SidebarHeader className={`border-b border-black/[0.06] ${collapsed ? 'p-2' : 'px-3 py-2 md:py-4'}`}>
  <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-start md:justify-center h-[56px] md:h-[104px] rounded-2xl border border-black/[0.06] bg-white/15 md:bg-white/20 backdrop-blur-xl shadow-sm'}`}>
    <img 
      src={collapsed ? logoIcon : logoFull} 
      alt="CW Financas" 
      className={`object-contain transition-all duration-300 ${collapsed ? 'w-9 h-9' : 'h-8 md:h-[72px] w-auto px-3 md:px-0'}`}
      style={{ filter: 'drop-shadow(0 2px 6px rgba(15, 23, 42, 0.08))' }}
    />
  </div>
</SidebarHeader>
```

### O que muda em cada breakpoint

| Propriedade | Mobile (base) | Desktop (md:) |
|---|---|---|
| Altura do header wrapper | 56px | 104px |
| Altura da logo | h-8 (32px) | h-[72px] (72px) |
| Alinhamento | esquerda (justify-start) | centro (justify-center) |
| Fundo glass | bg-white/15 | bg-white/20 |
| Padding vertical | py-2 | py-4 |

### Estado collapsed (icon-mode no desktop)

Quando collapsed, o header mostra apenas o icone pequeno (w-9 h-9) sem wrapper glass -- igual ao comportamento atual.

### O que NAO muda

- Nenhuma alteracao em CSS (`index.css`)
- Nenhuma alteracao no componente base `sidebar.tsx`
- Menu items, footer, e toda a logica de navegacao permanecem iguais
- Assets (logoFull e logoIcon) permanecem os mesmos
