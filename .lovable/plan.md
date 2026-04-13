

## Plano: Correção end-to-end do Conversor de Extratos

### Problemas diagnosticados

1. **Regex bancário (`BANK_LINE_RE`) muito restritivo**: Exige data no formato `DD/MM/YYYY`, mas Banrisul usa apenas número do dia (`30`, `31`, `01`). Nenhuma linha é capturada.

2. **Regex de cartão (`CC_LINE_RE`) muito genérico**: Nubank inclui `R$` antes dos valores e tem layout multi-coluna com número do cartão (`.... 3801`). O regex não captura.

3. **`btoa(String.fromCharCode(...pdfBuffer))` causa stack overflow**: O spread operator (`...`) em Uint8Arrays grandes (>50KB) excede o limite da call stack. O fallback OCR crasha silenciosamente, retornando 0 transações.

4. **Classificação incorreta do Banrisul**: Palavras "limite", "encargos" pontuam para credit_card, causando parsing com regex errado.

### Correções na Edge Function (`parse-pdf-statement/index.ts`)

**A. Novos padrões de regex bancário**

Adicionar múltiplos padrões para capturar formatos comuns:
- `DD/MM/YYYY desc valor` (atual, manter)
- `DD desc doc valor` (Banrisul: `30 VERO DEB BLF 322356 49,50`)
- `DD desc valor-` (Banrisul: `PAGAMENTO TITULO 680924 82,97-`)
- Linhas com `PIX RECEBIDO/ENVIADO` seguidas de valor

**B. Novo parser de cartão Nubank**

Capturar linhas no formato:
- `DD MMM .... NNNN Descrição R$ valor` (ex: `05 MAR .... 3801 Porto Seguro R$ 147,47`)
- Remover prefixo `R$`, ignorar colunas de data e cartão, extrair apenas descrição + valor
- Aplicar inversão de sinal conforme regra de negócio

**C. Corrigir base64 para OCR**

Substituir `btoa(String.fromCharCode(...pdfBuffer))` por loop seguro:
```typescript
function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
```

**D. Melhorar classificação**

Adicionar keywords específicos:
- Banco: `"movimentos da conta"`, `"saldo ant"`, `"pix recebido"`, `"pix enviado"`, `"aplicacao automatica"`, `"resgate automatico"`, `"banrisul"`, `"banco do brasil"`
- Cartão: `"fatura"`, `"compras nacionais"`, `"nubank"`, `"pagamento mínimo"`, `"rotativo"`
- Remover "encargos" e "anuidade" dos keywords de cartão (são ambíguos)

**E. Melhorar o fallback: tentar sempre OCR quando regex retorna 0**

Atualmente o fallback OCR já existe para `unknown`, mas para tipo `bank` ou `credit_card` detectado, se regex retorna 0, não há fallback. Adicionar fallback para todos os tipos.

### Validação esperada com os PDFs de teste

**Banrisul (`banri_conta_18_3.pdf`)**:
- Tipo: `bank`
- Transações esperadas: ~30+ (VERO DEB, PIX RECEBIDO, PAGAMENTO TITULO, CHEQUE COMPENSADO, etc.)
- Formato saída: Data | Descrição | Valor

**Nubank (`fatura_Nubank_GR_1.pdf`)**:
- Tipo: `credit_card`
- Transações esperadas: ~47 (Porto Seguro, Zp *Rota77, Facebk, Adobe, etc.)
- Formato saída: Descrição | Valor (com sinais invertidos)

### Arquivos

| Ação | Arquivo |
|------|---------|
| Reescrever | `supabase/functions/parse-pdf-statement/index.ts` |

### Sem alterações no frontend
A página `StatementConverterPage.tsx` já está funcional — o problema é exclusivamente no parser backend.

