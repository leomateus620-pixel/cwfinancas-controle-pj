
# Correcao Definitiva: Planilhas .xlsx Nao Aparecem na Listagem

## Causa Raiz

O problema NAO e de scope OAuth nem de permissoes. Os arquivos que faltam sao **arquivos Excel (.xlsx)** compartilhados via Google Drive, nao planilhas nativas do Google Sheets.

A query atual filtra por:
```
mimeType='application/vnd.google-apps.spreadsheet'
```

Isso retorna APENAS planilhas nativas do Google Sheets. Os arquivos .xlsx tem mimeType diferente:
```
application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
```

Por isso "Tarifa Zero - Controle Financeiro 2025" (icone verde do Sheets) aparece, mas "Financeiro SAH 2026.xlsx" (icone verde do Excel) nao aparece.

## Solucao

Alterar a query do Drive API para incluir AMBOS os tipos de arquivo:

```
(mimeType='application/vnd.google-apps.spreadsheet' OR mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') AND trashed=false
```

Isso cobrira:
- Planilhas nativas do Google Sheets
- Arquivos .xlsx abertos/compartilhados via Google Drive

## Arquivo modificado

| Arquivo | Acao |
|---|---|
| `supabase/functions/google-list-sheets/index.ts` | Expandir filtro mimeType para incluir .xlsx |

## Detalhe tecnico

Na funcao `listDriveSpreadsheets` (linha 89), alterar:

**Antes:**
```
let q = "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false";
```

**Depois:**
```
let q = "(mimeType='application/vnd.google-apps.spreadsheet' or mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') and trashed=false";
```

## Impacto

- Nenhuma mudanca no frontend necessaria
- Nenhuma reconexao OAuth necessaria
- Os arquivos .xlsx aparecerao imediatamente na proxima abertura do modal
- A busca por nome tambem cobrira arquivos .xlsx

## Teste

Apos deploy da edge function, abrir o modal "Selecionar Planilha" e verificar que arquivos como "Financeiro SAH 2026.xlsx" e "Controle Financeiro StartSync 2026.xlsx" aparecem na lista.
