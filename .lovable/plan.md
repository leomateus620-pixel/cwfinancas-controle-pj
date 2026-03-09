

## Plano: Logo + Animação 3s no Intro

### Mudanças

1. **Copiar logo** para `src/assets/logo-cw-pj.png`
2. **Reescrever `FinanceIntroAnimation.tsx`**:
   - Substituir o texto "CW Finanças" pela imagem da logo uploadada
   - Logo aparece com animação de scale + fade (fase 1)
   - KPIs aparecem (fase 2)
   - Gráfico aparece (fase 3)
   - Fade out (fase 4)
   - Ajustar timings para 3 segundos total:
     - Fase 1: 200ms (logo)
     - Fase 2: 800ms (KPIs)
     - Fase 3: 1500ms (chart)
     - Fase 4: 2400ms (fade out)
     - onComplete: 3000ms

### Arquivos
- **Copiado**: `user-uploads://logo_CW_PJ.png` → `src/assets/logo-cw-pj.png`
- **Modificado**: `src/components/FinanceIntroAnimation.tsx`

