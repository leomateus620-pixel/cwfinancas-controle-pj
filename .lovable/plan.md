

## Plano: Módulo "Conversor de Extratos" — PDF para CSV/Excel

### Visão geral

Módulo dedicado para converter PDFs de extratos bancários e de cartão de crédito em arquivos CSV/Excel estruturados. Inclui menu na sidebar, página com upload drag-and-drop, classificação automática do tipo de extrato, pré-visualização dos dados extraídos, e exportação.

### Arquitetura

```text
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────┐
│  Frontend Page   │────▶│  Edge Function        │────▶│  Storage    │
│  StatementPage   │     │  parse-pdf-statement  │     │  (pdf-uploads)│
│  (upload+preview)│◀────│  (parse+classify)     │     └─────────────┘
└─────────────────┘     └──────────────────────┘
```

### 1. Backend — Edge Function `parse-pdf-statement`

Nova edge function que recebe o PDF via upload, extrai texto com `pdf-parse` (npm), classifica o documento e retorna transações estruturadas.

**Lógica de classificação:**
- Palavras-chave cartão: "fatura", "limite", "cartão", "compras nacionais", "compras internacionais"
- Palavras-chave banco: "extrato", "saldo anterior", "saldo final", "conta corrente"
- Se ambiguidade: retorna `type: "unknown"` e o frontend pede seleção manual

**Lógica de parsing:**
- Regex por padrões de linha: `DD/MM/YYYY + descrição + valor` para bancário
- Para cartão: `descrição + valor` (com inversão de sinal obrigatória)
- Filtros de ruído: ignorar linhas com "saldo", "total", "limite", "pagamento mínimo", cabeçalhos, rodapés

**Resposta:**
```json
{
  "detected_type": "bank" | "credit_card" | "unknown",
  "transactions": [
    { "date": "2025-01-15", "description": "PIX RECEBIDO", "amount": 500.00 }
  ],
  "stats": { "total_lines": 120, "valid_transactions": 45, "skipped": 75 }
}
```

### 2. Backend — Tabelas no banco de dados

**Tabela `pdf_statement_uploads`:**
- `id`, `user_id`, `file_name`, `file_path` (storage), `detected_type` (bank/credit_card/unknown), `manual_type` (override), `status` (uploading/processing/done/error), `error_message`, `transaction_count`, `created_at`

**Tabela `pdf_parsed_transactions`:**
- `id`, `upload_id` (FK), `user_id`, `row_index`, `date`, `description`, `amount`, `original_amount`, `is_valid`, `created_at`

RLS: usuários veem apenas seus próprios registros.

### 3. Backend — Storage bucket

Criar bucket `pdf-uploads` (privado) para armazenar os PDFs temporários.

### 4. Frontend — Página `StatementConverterPage.tsx`

**Seções da interface:**
1. **Hero/Header**: Título "Conversor de Extratos", subtítulo explicativo
2. **Zona de upload**: Drag-and-drop com ícone, aceitar apenas `.pdf`, validação MIME
3. **Lista de arquivos**: Cards com nome, tipo detectado (badge colorido), status (processando/concluído/erro), botões reprocessar/excluir
4. **Pré-visualização**: Tabela com os dados extraídos (Data, Descrição, Valor para banco; Descrição, Valor para cartão)
5. **Exportação**: Botões "Exportar CSV" e "Exportar Excel" que geram o arquivo no frontend usando `xlsx` (já instalado no projeto via dependências)

**Design**: Liquid glass premium consistente com o resto do sistema — backdrop-blur, bordas translúcidas, badges coloridos para tipo de extrato.

### 5. Frontend — Rota e sidebar

- Nova rota `/statement-converter` no `App.tsx` (dentro das rotas protegidas)
- Novo item na sidebar em "Ferramentas": `{ title: "Conversor de Extratos", url: "/statement-converter", icon: FileDown }`

### 6. Exportação CSV/Excel (client-side)

- CSV: gerar string delimitada por `;` (padrão BR), criar blob e download
- Excel: usar biblioteca `xlsx` para gerar `.xlsx` com formatação básica (cabeçalhos em negrito, colunas auto-width)

### Arquivos a criar/editar

| Ação | Arquivo |
|------|---------|
| Criar | `supabase/functions/parse-pdf-statement/index.ts` |
| Criar | `src/pages/StatementConverterPage.tsx` |
| Criar | Migration: tabelas + bucket + RLS |
| Editar | `src/App.tsx` (adicionar rota) |
| Editar | `src/components/layout/AppSidebar.tsx` (adicionar menu) |

### Escopo da primeira entrega

- Upload de 1 PDF por vez (multi-arquivo como evolução futura)
- Parsing via regex/heurística (sem OCR — apenas PDFs com texto selecionável)
- Classificação automática + fallback manual
- Pré-visualização + exportação CSV/Excel funcional

