
# Importacao Excel Robusta via Edge Function

## Resumo

Reescrever completamente o fluxo de importacao Excel para usar uma **Edge Function server-side** que reutiliza toda a logica ja validada do `sheets-sync-all-tabs` (parseBRL, parseDate, autoDetectMapping, detectMovementType, batch upsert com idempotencia).

O fluxo atual (UploadPage.tsx) faz parse no browser com logica simplificada que corrompe datas e valores. O novo fluxo envia o arquivo para o storage, chama a Edge Function que faz o parse robusto, e o frontend apenas acompanha o progresso.

## Arquitetura

```text
[Browser]                          [Backend]
   |                                  |
   |  1. Upload .xlsx to storage      |
   |  bucket "excel-uploads"          |
   |--------------------------------->|
   |                                  |
   |  2. POST /parse-excel-upload     |
   |  { file_path, selected_tabs? }   |
   |--------------------------------->|
   |                                  |  3. Download from storage
   |                                  |  4. XLSX.read(cellDates=true)
   |                                  |  5. Classify tabs (tab router)
   |                                  |
   |  (se mode=preview)               |
   |  <- { tabs[], preview_rows[] }   |
   |<---------------------------------|
   |                                  |
   |  6. POST /parse-excel-upload     |
   |  { file_path, tabs, mode=import }|
   |--------------------------------->|
   |                                  |  7. autoDetectMapping por aba
   |                                  |  8. parseBRL + parseDate por linha
   |                                  |  9. detectMovementType
   |                                  | 10. batch upsert (50/lote)
   |                                  | 11. Update uploaded_files status
   |  <- { imported, skipped, warns } |
   |<---------------------------------|
   |                                  |
   | 12. Poll uploaded_files status   |
   |--------------------------------->|
```

## Componentes

### 1. Edge Function: `parse-excel-upload`

Nova edge function que recebe o caminho do arquivo no storage e processa server-side.

**Dois modos de operacao:**

- **`preview`**: Faz parse do arquivo, classifica abas (tab router existente), retorna lista de abas com tipo (mensal/DRE/ignorar) + primeiras 10 linhas de preview + mapeamento automatico detectado. NAO importa dados.
- **`import`**: Recebe abas selecionadas, faz parse completo, aplica normalizer, batch upsert com idempotencia.

**Logica reutilizada de `sheets-sync-all-tabs`:**
- `parseBRL()` - parse robusto de moeda pt-BR
- `parseDate()` - parse de datas (serial Excel, dd/mm/yyyy, ISO, fallback)
- `autoDetectMapping()` - deteccao automatica de colunas
- `extractAmount()` - suporta coluna unica ou credito/debito separados
- `isSkippableRow()` - filtra headers repetidos e totalizadores
- `detectMovementType()` - classifica INCOME/EXPENSE/TRANSFER
- `classifyTab()` - roteador de abas (mensal vs DRE vs ignorar)
- `generateRowHash()` + `external_row_key` - idempotencia

**Diferencas do fluxo Google Sheets:**
- Leitura do arquivo via Supabase Storage (nao Google Drive)
- `XLSX.read()` com `cellDates: true` para converter datas automaticamente
- `source = "excel"` em vez de `"sheets"`
- Sem refresh token / OAuth
- Job tracking via tabela `uploaded_files` (ja existe)

**Tratamento de erros:**
- Linha com erro vira warning, nao quebra a importacao
- So para se o arquivo estiver corrompido (XLSX.read falhar)
- Retorna contadores detalhados: importadas, ignoradas (valor=0), warnings, erros

### 2. UploadPage.tsx - Reescrita completa

**Novo fluxo de estados:**

```text
idle -> uploading -> previewing -> selecting_tabs -> importing -> success/error
```

**Etapa 1 - Upload:** Envia arquivo para bucket `excel-uploads` via Supabase Storage.

**Etapa 2 - Preview:** Chama Edge Function com `mode=preview`. Mostra:
- Lista de abas classificadas (mensais com checkbox, DRE separado, ignoradas em cinza)
- Mapeamento automatico detectado para cada aba
- Preview das primeiras 10 linhas da primeira aba

**Etapa 3 - Selecao de abas:** Usuario escolhe:
- Quais abas mensais importar (toggle individual ou intervalo)
- Se importar aba DRE (vai para tabela dre_lines, nao transactions)
- Confirma mapeamento (pode ajustar se quiser)

**Etapa 4 - Importacao:** Chama Edge Function com `mode=import` + abas selecionadas. Mostra progresso em tempo real via polling da tabela `uploaded_files`.

**Etapa 5 - Resultado:** Mostra resumo detalhado:
- Total importado / ignorado / warnings / erros
- Lista de warnings expansivel

### 3. Tabela `uploaded_files` - Ajustes

Adicionar colunas para suportar progresso e detalhes:

| Coluna | Tipo | Descricao |
|---|---|---|
| `progress` | jsonb | Progresso detalhado: tabs_total, tabs_done, rows_read, rows_imported |
| `warnings` | jsonb | Lista de warnings (linhas com problemas menores) |
| `tab_summary` | jsonb | Resumo por aba: nome, importadas, ignoradas, erros |

### 4. Config: `supabase/config.toml`

Adicionar entrada para nova funcao:
```toml
[functions.parse-excel-upload]
verify_jwt = false
```

### 5. Storage RLS

Verificar que o bucket `excel-uploads` permite INSERT e SELECT para usuarios autenticados (policies ja podem existir, mas precisam ser validadas).

## Detalhes tecnicos importantes

### Parse de datas com cellDates

```text
XLSX.read(data, { type: "array", cellDates: true })
```

Quando `cellDates=true`, o SheetJS converte serials Excel em objetos Date nativos do JS. A funcao `parseDate()` sera ajustada para aceitar objetos Date alem de strings e numeros.

### Armazenamento de valores

O sistema atual armazena `amount` como `NUMERIC(14,2)` no banco (nao centavos). Isso ja e o padrao do app. O plano NAO muda para centavos para manter consistencia -- o trigger `validate_amount_precision` ja arredonda para 2 casas.

Nota: o pedido do usuario mencionava centavos, mas o sistema inteiro ja opera com decimais (ex: 1234.56 no banco = R$ 1.234,56 na tela). Mudar para centavos quebraria todo o app. Manter o padrao atual.

### Idempotencia

`external_row_key = "excel:{file_name}:{tab_name}:{row_number}:{row_hash}"`

Permite reimportar o mesmo arquivo sem duplicar. Usa upsert com ON CONFLICT.

## Arquivos criados/modificados

| Arquivo | Acao |
|---|---|
| `supabase/functions/parse-excel-upload/index.ts` | **CRIAR** - Edge Function principal |
| `src/pages/UploadPage.tsx` | **REESCREVER** - Novo fluxo com upload, preview, selecao de abas, progresso |
| `supabase/config.toml` | Adicionar `[functions.parse-excel-upload]` |
| Migration SQL | Adicionar colunas `progress`, `warnings`, `tab_summary` na tabela `uploaded_files` |

## Criterios de aceite

1. Importar Excel com milhares de linhas sem leitura errada de data/valor
2. Receitas + Despesas + Transferencias classificadas corretamente
3. Aba DRE separada das abas mensais
4. Sem importacao infinita (timeout controlado)
5. Reimportar mesmo arquivo nao duplica transacoes
6. UI mostra progresso real e resumo final detalhado
