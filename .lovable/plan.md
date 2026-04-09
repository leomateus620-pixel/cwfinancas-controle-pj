

## Plano: Imagem BB Ourocard + Melhorias UX Cartão de Crédito

### O que será feito

1. **Imagem do Banco do Brasil**: Copiar a imagem anexada do Ourocard Black para `src/assets/cards/bancodobrasil.png` e vincular no `cardCatalog.ts` como asset do brand "Banco do Brasil" (atualmente `asset: null`).

2. **Corrigir tooltip escuro que esconde valores**: O `Tooltip` do Recharts usa `contentStyle` com fundo `rgba(15,23,42,0.9)` — praticamente preto sobre fundo escuro. Trocar para glassmorphism translúcido com backdrop-blur, texto branco legível e borda luminosa.

3. **Gráfico de categorias com visual 3D e micro-animações**:
   - Substituir o `PieChart` plano por um donut com `renderActiveShape` customizado que expande o setor ativo com sombra e offset (efeito 3D)
   - Adicionar hover interativo: setor se destaca com glow e a categoria correspondente na lista recebe highlight sincronizado (bidirecional)
   - Drop-shadow no container com filtro SVG para profundidade visual

4. **Melhorar alinhamento e UX geral**:
   - Header: Centralizar verticalmente o cartão 3D com os KPIs, padding consistente
   - Cards de Categorias e Ciclos: Igualar alturas mínimas, espaçamento uniforme
   - Lista de categorias: Adicionar percentual (%) ao lado do valor compacto
   - Transações: Melhorar padding e espaçamento da tabela

### Arquivos

| Ação | Arquivo |
|------|---------|
| Copiar asset | `user-uploads://9_de_abr._de_2026_20_42_12.png` → `src/assets/cards/bancodobrasil.png` |
| Editar | `src/lib/cardCatalog.ts` (vincular asset do BB) |
| Editar | `src/pages/CreditCardPage.tsx` (donut 3D, tooltip fix, alinhamentos, % nas categorias) |
| Editar | `src/components/credit-card/CreditCardConnectedHeader.tsx` (alinhamento padding) |

### Detalhes técnicos

**Tooltip fix**: Usar `wrapperStyle` + `contentStyle` com `backdropFilter: 'blur(16px)'`, fundo `rgba(30,41,59,0.85)`, borda `rgba(255,255,255,0.15)`.

**Donut 3D**: Usar `renderActiveShape` do Recharts com `Sector` customizado — setor ativo deslocado 6px do centro com `outerRadius + 8`, sombra via `filter: drop-shadow`. Estado `activeIndex` sincronizado com hover na lista de categorias.

**Micro-animações**: Transição CSS de 200ms no hover dos itens de categoria + `onMouseEnter`/`onMouseLeave` para sincronizar com o gráfico.

