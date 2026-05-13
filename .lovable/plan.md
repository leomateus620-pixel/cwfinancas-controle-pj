
## Objetivo

Permitir que o Conversor de Extratos aceite, além de PDFs, arquivos Excel (.xls e .xlsx) — incluindo o formato HTML-disfarçado-de-.xls que a Sicredi exporta — e validar o fluxo com a planilha anexada (fatura Sicredi Visa Empresarial).

## Mudanças

### 1. Frontend — `src/pages/StatementConverterPage.tsx`
- Aceitar `.xls`, `.xlsx` no `<input>` e no drag-and-drop (`accept=".pdf,.xls,.xlsx,..."`).
- Remover o bloqueio "Apenas arquivos PDF são aceitos" no `processFile` — passar a validar contra a lista expandida (pdf/xls/xlsx).
- Ajustar textos da zona de upload: "Arraste seu PDF ou Excel aqui…" e adicionar badge "Excel".
- Ajustar `exportCSV` / `exportExcel` para usar a extensão real do arquivo (substituir `.pdf|.xls|.xlsx` no nome de saída).
- Storage: salvar Excel no mesmo bucket `pdf-uploads` mantendo o caminho `{user}/{upload_id}.{ext}` — sem alteração de schema.

### 2. Backend — `supabase/functions/parse-pdf-statement/index.ts`
- Aceitar arquivos com extensão `.xls`/`.xlsx` (ou MIME Excel) além de PDF.
- Detectar tipo do arquivo no início do handler. Se for Excel:
  - Importar SheetJS via `npm:xlsx@0.18.5` (já compatível com Deno) — lê tanto XLSX binário quanto HTML-as-XLS (caso Sicredi).
  - Converter cada aba para `sheet_to_json(ws, { header: 1 })` (matriz de células).
  - Rodar um **parser estruturado dedicado** (`parseExcelStatement`) que:
    1. Achata todas as linhas em texto para reaproveitar `classifyDocument` (decide bank vs credit_card).
    2. Em modo `credit_card`: percorre linhas detectando blocos `Cartão: …` (Sicredi); para cada linha tenta extrair `[data DD/MM/YYYY] [descrição] [parcela XX/YY?] [valor]`. Ignora linhas de cabeçalho/total/resumo.
    3. Em modo `bank`: tenta o mesmo padrão genérico (data, descrição, valor numérico final) por linha.
    4. Trata negativos (valor com `-` prefixo, sufixo, ou parênteses) — reaproveitar `parseValue` existente.
  - Se o parser estruturado retornar 0 transações, faz fallback: junta as linhas em texto e roda `parseCreditCardStatement`/`parseBankStatement` existentes.
- Pular o caminho de OCR-AI quando for Excel (não há páginas para renderizar).
- Salvar buffer no storage com `contentType` e extensão corretos.
- `pdf_statement_uploads.file_path` passa a guardar a extensão real.

### 3. Validação com a planilha anexada (Sicredi)
- Após implementar, rodar manualmente o upload no preview com o `.xls` anexado.
- Resultado esperado: detecção `credit_card`, ~47 transações extraídas (3 blocos de cartão), com pagamentos negativos preservados (ex.: `Pagamento -4.566,44`) e parcelados marcados na descrição (`02/12`, `06/12` etc.).
- Conferir via console/network logs e a tabela renderizada na página.

## Detalhes técnicos

```text
Fluxo Excel (novo)
─────────────────
upload (.xls/.xlsx)
   │
   ▼
detectExt → "excel"
   │
   ▼
XLSX.read(buffer)  ← SheetJS (lê HTML-as-xls da Sicredi)
   │
   ▼
sheet_to_json header:1  → string[][]
   │
   ├── classifyDocument(joinedText)  → bank | credit_card
   │
   └── parseExcelStatement(rows, type)
         │
         ▼
   ParsedTransaction[]   (mesmo shape do PDF)
         │
         ▼
   insert pdf_parsed_transactions  (reuso)
```

Regex chave do parser estruturado (linha de transação Sicredi):
- Data: `^(\d{2}/\d{2}/\d{4})$`
- Parcela: `^\d{2}/\d{2}$`
- Valor: `parseValue` (já existe — suporta `-4.566,44`, `1.979,82`, `(123,45)`).

Linhas a ignorar: `Total R$`, `Resumo`, `Despesas no`, `Cartão:`, `Não existem lançamentos`, cabeçalhos `Data/Descrição/Valor`.

## Fora de escopo
- Não criar tabelas novas, não alterar RLS.
- Não mudar export (CSV/Excel já existentes seguem iguais, só ajustando nome).
- Não tocar no detector de cartão de crédito do módulo principal — esta mudança é só do conversor.
