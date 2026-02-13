
# Correcao: Erro ao Ler Planilhas .xlsx (Preview)

## Causa Raiz

O erro `"This operation is not supported for this document"` ocorre porque a funcao `google-read-sheet-preview` usa a **Google Sheets API** para ler metadados e dados. Porem, a Sheets API **nao suporta** arquivos `.xlsx` armazenados no Drive -- ela so funciona com planilhas nativas do Google Sheets.

Quando o usuario seleciona "Financeiro GR - 2026.xlsx", a funcao tenta chamar:
```text
GET https://sheets.googleapis.com/v4/spreadsheets/{id}
```
E recebe: `400 - This operation is not supported for this document`

## Solucao

Modificar `google-read-sheet-preview` para detectar o tipo do arquivo e, quando for `.xlsx`, usar a **Google Drive API** para baixar o arquivo e parsear com a biblioteca **SheetJS (xlsx)** no servidor.

### Fluxo atualizado

```text
1. Receber spreadsheetId
2. Consultar Drive API: GET files/{id}?fields=mimeType,name
3. Se mimeType = 'application/vnd.google-apps.spreadsheet':
   -> Usar Sheets API (fluxo atual, sem mudanca)
4. Se mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
   -> Baixar arquivo via Drive API: GET files/{id}?alt=media
   -> Parsear com SheetJS (xlsx) no edge function
   -> Extrair lista de abas e primeiras 20 linhas
   -> Retornar no mesmo formato de resposta
```

## Arquivos modificados

| Arquivo | Acao |
|---|---|
| `supabase/functions/google-read-sheet-preview/index.ts` | Adicionar deteccao de mimeType e fallback para .xlsx via Drive API + SheetJS |

## Detalhe tecnico

### 1. Detectar mimeType via Drive API

Antes de chamar a Sheets API, consultar o Drive API para saber o tipo do arquivo:

```text
GET https://www.googleapis.com/drive/v3/files/{id}?fields=mimeType,name
Authorization: Bearer {token}
```

### 2. Para arquivos .xlsx: baixar e parsear

- Baixar o conteudo binario:
```text
GET https://www.googleapis.com/drive/v3/files/{id}?alt=media
Authorization: Bearer {token}
```

- Parsear com SheetJS importado via esm.sh:
```text
import * as XLSX from "https://esm.sh/xlsx@0.18.5";
```

- Extrair:
  - Nome das abas (workbook.SheetNames)
  - Primeiras 20 linhas da aba selecionada (ou primeira aba)
  - Retornar no mesmo formato `{ spreadsheet, sheets, preview }` que o fluxo nativo usa

### 3. Resposta identica ao fluxo nativo

O frontend nao precisa de nenhuma alteracao -- a resposta tera o mesmo formato independente de ser Google Sheets nativo ou .xlsx.

## Impacto

- **Frontend**: nenhuma alteracao necessaria
- **Outras edge functions**: `sheets-sync-all-tabs` e `ai-profile-sheet` tambem precisarao de tratamento similar para .xlsx no futuro, mas o erro imediato e apenas no preview
- **Seguranca**: sem mudanca, usa mesmo token OAuth do usuario
