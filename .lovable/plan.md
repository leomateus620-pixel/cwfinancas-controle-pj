

## Plano: Hero com Nova Imagem + Correção Crítica da Detecção

### Diagnóstico Forense

**Causa raiz do LCF (0 faturas / 0 lançamentos):**

A planilha LCF armazena o identificador do cartão em `raw_data->>'Conta'` = `"Fatura CC Sicredi"`, **NÃO** em `raw_data->>'Banco'` (que é NULL para essas abas).

Dados reais confirmados no banco:
- `Jan26`: 7 linhas com `Conta = "Fatura CC Sicredi"`, data `2026-01-13`
- `Fev26`: 8 linhas com `Conta = "Fatura CC Sicredi"`, data `2026-02-13`
- `Mar26`: 11 linhas com `Conta = "Fatura CC Sicredi"`, data `2026-03-13`

A função `extractBanco()` atual lê apenas `raw_data.Banco`. O campo `Conta` é completamente ignorado. Como `Banco` é NULL, nenhum grupo é formado, nenhum bloco é detectado.

**Causa raiz do Tarifa Zero (contaminação):**

Na planilha Tarifa Zero, o campo `raw_data.Banco` contém "UNICRED"/"CRESOL" em TODAS as linhas da aba, incluindo receitas, PIX, transferências. O agrupamento `(date + banco)` captura tudo que tenha 3+ linhas na mesma data — inclusive blocos de receitas/pagamentos operacionais que não são cartão.

### Tarefa 1 — Trocar imagem do Hero

Copiar a imagem da carteira de couro com os 4 cartões para `src/assets/cards/` e usar como asset principal do `CreditCard3D`. Renomear CTA de "Detectar Lançamentos" para "Conectar cartão". Ajustar glow/profundidade.

### Tarefa 2 — Correção da Detecção (Edge Function)

#### Mudança A: `extractBanco()` deve ler `raw_data.Conta` também

```text
Ordem de prioridade:
1. raw_data.Conta → se contém "Fatura CC" → extrair banco ("Sicredi")
2. raw_data.Banco → fallback atual
3. client_vendor → fallback existente
```

#### Mudança B: Nova camada de detecção por `Conta` (fast-path)

Antes do agrupamento por `(date + banco)`, fazer um fast-path:

```text
1. Filtrar todas as linhas onde raw_data.Conta ILIKE '%Fatura CC%'
2. Agrupar por (source_tab, date, conta_normalizada)
3. Cada grupo ≥ 3 linhas → bloco de alta confiança (0.95)
4. Extrair banco do texto "Fatura CC Sicredi" → "Sicredi"
```

Isso resolve o LCF imediatamente.

#### Mudança C: Anti-contaminação (resolver Tarifa Zero)

No agrupamento genérico por `(date + banco)`, adicionar filtros de exclusão:

```text
Sinais de EXCLUSÃO (not_credit_card):
- description contém: "RECEBIMENTO PIX", "PAGAMENTO PIX SICREDI", 
  "LIQUIDACAO BOLETO", "DEBITO CONVENIOS", "DEBITO ARRECADACAO",
  "TED ", "APLIC. FINANC", "TRANSFERENCIA"
- movement_type == "INCOME" E description contém "RECEBIMENTO"
```

Linhas com sinais de exclusão devem ser removidas do grupo ANTES do cálculo de score. Se o grupo remanescente tiver < 3 linhas, rejeitar.

#### Mudança D: Priorizar `Conta` sobre `Banco` para label do cartão

Se `raw_data.Conta` contém "Fatura CC Sicredi", o `cardLabel` deve ser "Cartão Sicredi", não derivado de `Banco`.

#### Mudança E: Diagnóstico enriquecido

Adicionar ao retorno diagnóstico:
- `contaFieldPresent`: boolean
- `bancoFieldPresent`: boolean  
- `faturaCC_lines_found`: number
- Sugestão mais precisa quando `Conta` tem "Fatura CC" mas `Banco` está vazio

### Arquivos

| Ação | Arquivo |
|------|---------|
| Copiar | `user-uploads://Cartões_de_crédito_em_carteira_de_couro.png` → `src/assets/cards/wallet-cards-premium.png` |
| Editar | `src/components/credit-card/CreditCard3D.tsx` (usar nova imagem como default) |
| Editar | `src/components/credit-card/CreditCardHero.tsx` (CTA "Conectar cartão", ajustes visuais) |
| Reescrever | `supabase/functions/detect-credit-cards/index.ts` (fast-path por Conta, exclusões anti-contaminação) |

### Escopo restrito
- Zero novas tabelas ou migrações
- Zero alteração no pipeline de sync/importação
- Zero impacto em outros menus
- Mesma rota, mesmo payload, mesmas tabelas de persistência

