

# Atualizar logo e tamanhos na sidebar

## Mudancas

### 1. Copiar nova logo
- Copiar `user-uploads://ChatGPT_Image_12_de_fev._de_2026_07_56_39-5.png` para `src/assets/logo-full.png`

### 2. `src/components/layout/AppSidebar.tsx` (linha 72)

Trocar os tamanhos da logo:

**Antes:** `h-10 md:h-16`

**Depois:** `h-[120px] md:h-[156px]`

Classe completa da img (quando nao collapsed):
```
h-[120px] md:h-[156px] w-auto
```

Isso garante 156px no desktop e 120px no mobile, sem limites extras.
