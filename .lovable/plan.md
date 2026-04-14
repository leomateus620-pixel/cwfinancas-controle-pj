

## Plano: Incluir nome do remetente/destinatário em transações PIX

### Problema

O extrato Banrisul usa formato multi-linha para PIX:
```
06 PIX ENVIADO 775866 132,29-
NOME: MERCADO RAMBO E WEBER LTDA
```

O parser atual:
1. Filtra a linha `NOME:` como ruído (regex `^\s*NOME:/i` na lista `NOISE_PATTERNS`)
2. Não faz lookahead para juntar a linha `NOME:` à transação PIX anterior

### Solução

**Arquivo: `supabase/functions/parse-pdf-statement/index.ts`**

#### 1. Remover `NOME:` do filtro de ruído
Deletar a entrada `/^\s*NOME:/i` de `NOISE_PATTERNS` (linha 95).

#### 2. Implementar lookahead para `NOME:` no parser Banrisul
Na função `parseBankStatement`, após processar cada linha que gera uma transação (qualquer padrão: BB, fullDate, Banrisul), verificar se a **próxima linha** começa com `NOME:`. Se sim:
- Extrair o nome após `NOME:` e concatenar à descrição da transação: `"PIX ENVIADO - MERCADO RAMBO E WEBER LTDA"`
- Marcar a linha como consumida para não reprocessá-la

Lógica: trocar o loop `for...of` por um loop indexado (`for (let i = 0; i < lines.length; i++)`) para permitir `i++` quando consumir a linha `NOME:`.

#### 3. Adicionar instrução ao prompt OCR
Incluir no prompt: "Linhas que começam com 'NOME:' após uma transação PIX contêm o nome do pagador/recebedor. Inclua esse nome na descrição da transação, separado por ' - '."

### Resultado esperado
- `PIX ENVIADO - MERCADO RAMBO E WEBER LTDA` em vez de apenas `PIX ENVIADO`
- `PIX RECEBIDO - TATIANE MARIA EBERT` em vez de apenas `PIX RECEBIDO`
- Dados completos dos pagadores e recebedores em todas as transações PIX

| Ação | Arquivo |
|------|---------|
| Editar | `supabase/functions/parse-pdf-statement/index.ts` |

