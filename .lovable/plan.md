

## Plano: Redesign Premium do Menu "Cartão de Crédito" + Cartão 3D Dinâmico

### Diagnóstico

**Edge Function**: Deployada e funcional. O erro "Failed to send a request" provavelmente ocorre com CORS headers incompletos. O header atual é `authorization, x-client-info, apikey, content-type` mas falta `x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version`. A detecção em si funciona.

**Detecção**: A lógica atual é sólida --- agrupa por tab, detecta blocos contíguos com "Fatura CC"/banco + mesma data + 3+ linhas. Score por bloco (0.6-0.95). Funcional, sem bugs críticos.

**UI**: Funcional mas visualmente básica --- sem cartão 3D, sem identificação de banco, sem animações, sem hero section, sem premium.

**Hook**: Funciona, mas `transactionsQuery` depende de `cyclesQuery.data` sem query key incluindo os cycle IDs, causando possível stale data.

### Mudanças

#### 1. Fix CORS na Edge Function

Atualizar `corsHeaders` para incluir todos os headers do Supabase client e importar de `@supabase/supabase-js/cors` quando possível.

#### 2. Copiar imagens dos cartões para assets

Copiar as 4 imagens (Banrisul, Nubank, Sicredi, Unicred) para `src/assets/cards/` e criar um cartão genérico via CSS gradient.

#### 3. Catálogo de cartões + detecção de banco

Criar `src/lib/cardCatalog.ts`:

```text
- Interface CardBrand { id, name, aliases[], asset, gradientFallback, textColor }
- Catálogo: nubank, sicredi, unicred, banrisul, generic
- detectCardBrand(label: string): CardBrand — match por aliases
```

Aliases:
- nubank: "nu", "nuba", "nubank"
- sicredi: "sicr", "sicredi"
- unicred: "unicred"
- banrisul: "banrisul", "banri"
- generic: fallback

#### 4. Componente CreditCard3D

Criar `src/components/credit-card/CreditCard3D.tsx`:

- CSS 3D transforms com `perspective`, `rotateX/Y`
- Parallax leve via mouse move (throttled)
- Imagem do cartão como background
- Glow/reflexo via pseudo-elements
- Dados sobrepostos: nome do cartão, vencimento, total líquido
- Animação de entrada com `@keyframes`
- `prefers-reduced-motion` respeitado
- Fallback gradient para cartão genérico

#### 5. Reescrita completa do CreditCardPage.tsx

Layout premium com liquid glass:

```text
┌──────────────────────────────────────────────────────────┐
│  HERO SECTION                                            │
│  ┌─────────────────┐  ┌───────────────────────────────┐  │
│  │  CreditCard3D   │  │  Título + Subtítulo           │  │
│  │  (parallax/tilt)│  │  Resumo: líquido, vencimento  │  │
│  │                 │  │  CTA: Detectar Lançamentos    │  │
│  └─────────────────┘  │  Status da última detecção    │  │
│                        └───────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘

┌──────────┬──────────┬──────────┬──────────┬──────────────┐
│ Fatura   │ Despesas │ Reembol- │ Lança-   │ Faturas      │
│ Líquida  │ Brutas   │ sos      │ mentos   │ Detectadas   │
└──────────┴──────────┴──────────┴──────────┴──────────────┘

┌────────────────────────┬─────────────────────────────────┐
│ FATURAS POR CICLO      │ CATEGORIAS (donut + lista)      │
│ cards com card_label   │                                  │
│ + badge banco          │                                  │
└────────────────────────┴─────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│ TABELA DE LANÇAMENTOS (busca + filtros)                   │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│ REVISÃO PENDENTE (se houver)                             │
└──────────────────────────────────────────────────────────┘
```

**Hero Section**:
- Fundo `liquid-glass-card-hero`
- Cartão 3D à esquerda com parallax
- Info resumo à direita
- O cartão mostrado é o do ciclo mais recente (ou genérico se vazio)

**KPIs**:
- 5 cards `liquid-glass-kpi`
- Ícones com cápsulas translúcidas
- Valores grandes e legíveis

**Empty State Premium**:
- Cartão 3D genérico com glow
- Texto orientado à ação
- CTA "Detectar Lançamentos" destacado
- Subtexto explicando o pipeline

**Loading State**:
- Skeleton premium com shimmer
- Feedback por etapa (se detecção em andamento)

**Faturas por Ciclo**:
- Badge visual do banco detectado (mini-ícone)
- Status com cores semânticas

#### 6. Hook refinado

- Corrigir `transactionsQuery` para usar `queryKey` com `cycleIds`
- Adicionar `cardBrand` derivado do ciclo mais recente

#### 7. Animações CSS

Adicionar ao `index.css`:
- `@keyframes card-float` (leve flutuação)
- `@keyframes card-enter` (entrada suave)
- `.credit-card-3d` com perspective e transitions

### Arquivos

| Acao | Arquivo |
|------|---------|
| Copiar | `user-uploads://Cartao_*.png` → `src/assets/cards/` |
| Criar | `src/lib/cardCatalog.ts` |
| Criar | `src/components/credit-card/CreditCard3D.tsx` |
| Reescrever | `src/pages/CreditCardPage.tsx` |
| Editar | `src/hooks/useCreditCardDashboard.ts` (fix query dep + add cardBrand) |
| Editar | `supabase/functions/detect-credit-cards/index.ts` (fix CORS) |
| Editar | `src/index.css` (add card animations) |

### Escopo restrito
- Zero alteração na detecção/lógica do pipeline (já funcional)
- Zero novas tabelas ou migrações
- Zero impacto em outros menus/páginas
- Edge function: apenas fix CORS headers

