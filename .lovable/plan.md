

## Plano: Corrigir datas incompletas no extrato Banrisul (e similares)

### Problema

O extrato Banrisul usa um formato onde o mês/ano aparece uma vez no cabeçalho (`MOVIMENTOS ABR/2026`) e as transações mostram apenas o dia (`06`, `07`, etc.). O parser atual captura somente o dia, gerando datas como `"06"` em vez de `"06/04/2026"`.

Além disso, o regex não encontrou transações (0 matches) e caiu no OCR via IA, que também pode retornar datas incompletas.

### Causa raiz

1. **`parseBankStatement()`** nunca extrai mês/ano das linhas de cabeçalho como `MOVIMENTOS ABR/2026` ou `SALDO ANT EM 02/04/2026`
2. As transações Banrisul (`banrisulRe`) salvam `date: dayStr` — apenas o número do dia
3. No fallback OCR, o prompt pede `DD/MM/YYYY` mas não fornece contexto do mês quando o PDF só mostra dias

### Solução

**Arquivo: `supabase/functions/parse-pdf-statement/index.ts`**

#### 1. Extrair mês/ano do cabeçalho Banrisul
Antes do loop de parsing, escanear o texto por padrões como:
- `MOVIMENTOS ABR/2026` → mês=04, ano=2026
- `SALDO ANT EM DD/MM/YYYY` → extrair MM/YYYY
- Header do PDF: `14/04/2026` (data de emissão)

Criar um mapa de mês abreviado → número (`JAN→01, FEV→02, MAR→03, ABR→04...`)

#### 2. Compor data completa nas transações Banrisul
Quando `banrisulRe` captura apenas o dia (`06`), combinar com o mês/ano extraído do cabeçalho para formar `06/04/2026`.

#### 3. Pós-processamento para datas incompletas
Após o parsing (tanto regex quanto OCR), verificar transações onde `date` tem apenas 1-2 dígitos (dia sem mês). Tentar completar usando:
- O mês/ano detectado do cabeçalho
- A data do filename (se disponível)
- A data de criação do PDF

#### 4. Melhorar prompt OCR para Banrisul
Adicionar ao prompt de OCR uma instrução explícita: "Se o PDF mostrar apenas o dia nas transações, procure o mês/ano no cabeçalho (ex: MOVIMENTOS ABR/2026) e componha a data completa DD/MM/YYYY."

### Resultado esperado
Todas as transações terão datas completas no formato `DD/MM/YYYY`, independente do banco ou formato do PDF.

| Ação | Arquivo |
|------|---------|
| Editar | `supabase/functions/parse-pdf-statement/index.ts` |

