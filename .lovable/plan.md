

# Correcao: Erro de Sincronizacao em Planilhas .xlsx

## Causa Raiz

O mesmo problema do preview: as funcoes de sincronizacao usam a **Google Sheets API** que NAO suporta arquivos `.xlsx`. O erro nos logs confirma:

```text
"This operation is not supported for this document" (FAILED_PRECONDITION)
```

Isso afeta **6 edge functions** que chamam `sheets.googleapis.com/v4/spreadsheets/{id}`:

| Funcao | Uso | Criticidade |
|---|---|---|
| `google-sheets-sync` | Sincroniza aba unica | ALTA (erro reportado) |
| `sheets-sync-all-tabs` | Sincroniza todas as abas | ALTA |
| `ai-profile-sheet` | Perfila a planilha com IA | MEDIA |
| `sheets-preview-mapping` | Preview de mapeamento | MEDIA |
| `dre-sync` | Sincroniza DRE | MEDIA |
| `google-list-sheets` | Lista abas de uma planilha | MEDIA |

## Solucao

Criar um modulo utilitario compartilhado (inline em cada funcao, pois edge functions nao suportam imports entre pastas) que detecta o tipo do arquivo e usa o caminho correto:

- **Google Sheets nativo** -> Sheets API (fluxo atual)
- **Excel .xlsx** -> Drive API download + SheetJS parse

### Funcoes auxiliares a adicionar em cada edge function afetada

```text
1. getFileMimeType(accessToken, fileId)
   -> GET https://www.googleapis.com/drive/v3/files/{id}?fields=mimeType,name
   -> Retorna { mimeType, name }

2. downloadAndParseXlsx(accessToken, fileId, sheetName?)
   -> GET https://www.googleapis.com/drive/v3/files/{id}?alt=media
   -> XLSX.read(data)
   -> Retorna { headers, rows, sheetNames }
```

### Mudancas por funcao

**1. `google-sheets-sync/index.ts`** (prioridade maxima)
- Antes de chamar a Sheets API (linhas 529-554), verificar mimeType
- Se `.xlsx`: baixar via Drive API, parsear com SheetJS, extrair headers e rows
- O restante do processamento (mapping, upsert) permanece identico

**2. `sheets-sync-all-tabs/index.ts`** (prioridade alta)
- Na funcao que busca metadados (linha 642) e dados (linha 329), adicionar deteccao de mimeType
- Se `.xlsx`: usar SheetJS para listar abas e ler dados por aba

**3. `ai-profile-sheet/index.ts`** (prioridade media)
- Na leitura de metadados (linha 362) e dados (linha 383), adicionar fallback para `.xlsx`

**4. `sheets-preview-mapping/index.ts`** (prioridade media)
- Na leitura de dados (linha 371), adicionar fallback para `.xlsx`

**5. `dre-sync/index.ts`** (prioridade media)
- Na leitura de metadados (linha 240) e dados (linha 260), adicionar fallback para `.xlsx`

**6. `google-list-sheets/index.ts`** (prioridade media)
- Na listagem de abas (linha 154), adicionar fallback para `.xlsx`

## Detalhe tecnico

Cada funcao recebera:
- `import * as XLSX from "https://esm.sh/xlsx@0.18.5";` no topo
- Funcao `getFileMimeType()` para detectar o tipo
- Funcao `readSheetData()` que abstrai a leitura (Sheets API vs Drive+XLSX)
- Logica condicional no ponto onde a Sheets API e chamada

O formato de saida (headers + rows como `string[][]`) sera identico ao da Sheets API, garantindo que nenhuma logica downstream precise mudar.

## Impacto

- **Frontend**: nenhuma alteracao
- **Logica de processamento**: nenhuma alteracao (mapping, upsert, auditoria)
- **Compatibilidade**: planilhas nativas continuam funcionando igual
- **Novas capacidades**: `.xlsx` compartilhados via Drive passam a sincronizar

## Arquivos modificados

| Arquivo | Acao |
|---|---|
| `supabase/functions/google-sheets-sync/index.ts` | Adicionar deteccao mimeType + fallback SheetJS |
| `supabase/functions/sheets-sync-all-tabs/index.ts` | Adicionar deteccao mimeType + fallback SheetJS |
| `supabase/functions/ai-profile-sheet/index.ts` | Adicionar deteccao mimeType + fallback SheetJS |
| `supabase/functions/sheets-preview-mapping/index.ts` | Adicionar deteccao mimeType + fallback SheetJS |
| `supabase/functions/dre-sync/index.ts` | Adicionar deteccao mimeType + fallback SheetJS |
| `supabase/functions/google-list-sheets/index.ts` | Adicionar fallback para listar abas de .xlsx |

