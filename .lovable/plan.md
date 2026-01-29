

# Plano de Integracao: Google Sheets com FinSight

## Visao Geral

Implementacao de uma integracao completa com o Google Sheets (Google Planilhas) que permite aos usuarios conectar suas planilhas financeiras e sincronizar automaticamente os dados com o sistema. A integracao fara uma analise precisa de toda a planilha, incluindo todos os meses e dados necessarios para alimentar as funcionalidades do projeto.

---

## Arquitetura da Solucao

```text
+-------------------+         +-------------------+         +-------------------+
|   Google Sheets   |   -->   |   Edge Function   |   -->   |    Supabase DB    |
|   (Planilha)      |         |   (Deno/Backend)  |         |   (Dados)         |
+-------------------+         +-------------------+         +-------------------+
        |                             |                             |
        v                             v                             v
  - Transacoes                - Autenticacao OAuth        - transactions
  - Receitas/Despesas         - Leitura de dados          - invoices
  - Notas Fiscais             - Mapeamento colunas        - balance_sheet_items
  - Balanco Patrimonial       - Sincronizacao             - google_sheet_connections
```

---

## Fase 1: Banco de Dados - Novas Tabelas

### 1.1 Tabela: google_sheet_connections

Armazena as conexoes de planilhas Google dos usuarios.

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid | PK |
| user_id | uuid | FK para auth.users |
| spreadsheet_id | text | ID da planilha Google |
| spreadsheet_name | text | Nome da planilha |
| sheet_name | text | Nome da aba (sheet) |
| refresh_token | text | Token OAuth (encriptado) |
| column_mapping | jsonb | Mapeamento de colunas |
| last_sync_at | timestamptz | Ultima sincronizacao |
| sync_status | text | success/error/syncing |
| sync_frequency | text | manual/hourly/daily |
| created_at | timestamptz | Data de criacao |
| updated_at | timestamptz | Data de atualizacao |

### 1.2 Tabela: google_sheet_sync_logs

Historico de sincronizacoes.

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid | PK |
| connection_id | uuid | FK para google_sheet_connections |
| rows_processed | integer | Linhas processadas |
| rows_imported | integer | Linhas importadas |
| rows_updated | integer | Linhas atualizadas |
| errors | jsonb | Erros encontrados |
| started_at | timestamptz | Inicio da sync |
| completed_at | timestamptz | Fim da sync |
| status | text | success/error |

### 1.3 Politicas RLS

- Usuarios podem ver/editar apenas suas proprias conexoes
- Logs de sincronizacao vinculados ao usuario via connection

---

## Fase 2: Autenticacao OAuth com Google

### 2.1 Fluxo OAuth 2.0

1. Usuario clica em "Conectar Google Sheets"
2. Redireciona para tela de consentimento do Google
3. Usuario autoriza acesso as planilhas
4. Google retorna authorization code
5. Backend troca code por access_token + refresh_token
6. Tokens salvos de forma segura no banco

### 2.2 Secrets Necessarias

| Secret | Descricao |
|--------|-----------|
| GOOGLE_CLIENT_ID | ID do cliente OAuth |
| GOOGLE_CLIENT_SECRET | Secret do cliente OAuth |

### 2.3 Escopos OAuth Requeridos

```text
https://www.googleapis.com/auth/spreadsheets.readonly
https://www.googleapis.com/auth/drive.metadata.readonly
```

---

## Fase 3: Edge Functions

### 3.1 google-sheets-auth

Gerencia o fluxo de autenticacao OAuth.

Endpoints:
- `GET /auth-url`: Gera URL de autorizacao
- `POST /callback`: Processa callback do OAuth

### 3.2 google-sheets-sync

Sincroniza dados da planilha com o banco.

Funcionalidades:
- Leitura completa da planilha
- Deteccao automatica de colunas
- Mapeamento inteligente de campos
- Importacao em batch
- Tratamento de datas/valores

### 3.3 google-sheets-list

Lista planilhas disponiveis na conta do usuario.

Retorna:
- Lista de spreadsheets acessiveis
- Abas (sheets) de cada planilha
- Cabecalhos de cada aba

---

## Fase 4: Analise Inteligente da Planilha

### 4.1 Deteccao Automatica de Colunas

O sistema analisara os cabecalhos e conteudo para identificar:

| Campo Sistema | Cabecalhos Detectados |
|---------------|----------------------|
| description | Descricao, Historico, Lancamento, Obs |
| amount | Valor, Montante, Quantia, R$, Total |
| date | Data, Dt, Date, Vencimento, Competencia |
| type | Tipo, Entrada/Saida, D/C, Natureza |
| category | Categoria, Classificacao, Grupo, Centro Custo |
| client_vendor | Cliente, Fornecedor, Razao Social, Empresa |

### 4.2 Analise de Meses

- Detectar coluna de data
- Agrupar dados por mes/ano
- Identificar padrao de organizacao:
  - Uma aba por mes
  - Todas as transacoes em uma aba
  - Colunas separadas por mes

### 4.3 Tipos de Dados Detectados

- **Transacoes**: Receitas e despesas
- **Notas Fiscais**: NFe, numero, cliente, valor, vencimento
- **Balanco**: Ativos, passivos, patrimonio liquido

---

## Fase 5: Frontend - Componentes

### 5.1 Nova Pagina: GoogleSheetsPage

Arquivo: `src/pages/GoogleSheetsPage.tsx`

Secoes:
- Botao "Conectar Google Sheets"
- Lista de planilhas conectadas
- Status de sincronizacao
- Botao de sincronizar manualmente
- Historico de sincronizacoes

### 5.2 Modal: SpreadsheetSelectorModal

Arquivo: `src/components/modals/SpreadsheetSelectorModal.tsx`

Funcionalidades:
- Listar planilhas disponiveis
- Selecionar aba especifica
- Preview dos dados
- Configurar mapeamento de colunas
- Escolher frequencia de sync

### 5.3 Componente: ColumnMappingForm

Arquivo: `src/components/google-sheets/ColumnMappingForm.tsx`

Interface para mapear colunas da planilha para campos do sistema:
- Dropdowns para cada campo
- Auto-deteccao com sugestoes
- Preview dos dados mapeados

### 5.4 Componente: SyncStatusCard

Arquivo: `src/components/google-sheets/SyncStatusCard.tsx`

Exibe:
- Status da ultima sincronizacao
- Linhas importadas
- Erros encontrados
- Botao de re-sincronizar

---

## Fase 6: Hook useGoogleSheets

Arquivo: `src/hooks/useGoogleSheets.ts`

Funcionalidades:
- Iniciar fluxo OAuth
- Listar planilhas conectadas
- Sincronizar dados
- Desconectar planilha
- Atualizar mapeamento

---

## Fase 7: Sincronizacao Automatica

### 7.1 Opcoes de Frequencia

| Frequencia | Descricao |
|------------|-----------|
| manual | Apenas quando usuario solicita |
| hourly | A cada hora via cron |
| daily | Uma vez por dia as 6h |

### 7.2 Cron Job (Opcional)

Usar `pg_cron` + `pg_net` para executar sincronizacao periodica:

```sql
-- Sincronizar planilhas daily
SELECT cron.schedule(
  'sync-google-sheets-daily',
  '0 6 * * *',
  $$ SELECT net.http_post(...) $$
);
```

---

## Fase 8: Tratamento de Dados

### 8.1 Parsing de Valores

```text
Entrada: "R$ 1.234,56" ou "1234.56" ou "1,234.56"
Saida: 1234.56 (number)
```

### 8.2 Parsing de Datas

```text
Formatos suportados:
- DD/MM/YYYY (Brasil)
- YYYY-MM-DD (ISO)
- MM/DD/YYYY (US)
- Serial Excel (number)
```

### 8.3 Deteccao de Tipo (Receita/Despesa)

Logica:
1. Se existe coluna "tipo": usar valor
2. Se valor negativo: despesa
3. Se cabecalho indica "saida"/"debito": despesa
4. Caso contrario: receita

---

## Fase 9: Estrutura de Arquivos

```text
supabase/
  functions/
    google-sheets-auth/
      index.ts
    google-sheets-sync/
      index.ts
    google-sheets-list/
      index.ts

src/
  pages/
    GoogleSheetsPage.tsx (novo)
  
  components/
    google-sheets/
      ColumnMappingForm.tsx (novo)
      SpreadsheetList.tsx (novo)
      SyncStatusCard.tsx (novo)
      ConnectionCard.tsx (novo)
    modals/
      SpreadsheetSelectorModal.tsx (novo)
  
  hooks/
    useGoogleSheets.ts (novo)
  
  lib/
    google-sheets-parser.ts (novo)
```

---

## Fase 10: Fluxo do Usuario

1. Usuario acessa pagina "Integracoes" ou "Google Sheets"
2. Clica em "Conectar Google Sheets"
3. Autoriza acesso via OAuth do Google
4. Sistema lista planilhas disponiveis
5. Usuario seleciona planilha e aba
6. Sistema analisa e sugere mapeamento de colunas
7. Usuario confirma/ajusta mapeamento
8. Sistema importa dados para o banco
9. Dashboard atualizado com dados reais
10. Sincronizacoes futuras automaticas ou manuais

---

## Fase 11: Atualizacao da Navegacao

### 11.1 AppSidebar

Adicionar novo item:
- Icone: FileSpreadsheet ou Sheet
- Label: "Google Sheets" ou "Integracoes"
- Rota: /google-sheets

### 11.2 SettingsPage

Adicionar secao "Integracoes" com:
- Status da conexao Google
- Botao conectar/desconectar
- Link para gerenciar planilhas

---

## Secao Tecnica: Implementacao

### Edge Function - google-sheets-sync (exemplo)

```typescript
// Estrutura da edge function
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '...',
};

Deno.serve(async (req) => {
  // 1. Obter connection_id do body
  // 2. Buscar tokens e configuracao do banco
  // 3. Chamar Google Sheets API
  // 4. Parsear dados conforme mapeamento
  // 5. Inserir/atualizar no banco
  // 6. Registrar log de sincronizacao
});
```

### Google Sheets API - Leitura

```typescript
// Leitura de valores
const response = await fetch(
  `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`,
  {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  }
);
```

---

## Consideracoes de Seguranca

1. **Tokens OAuth**: Armazenados com criptografia no banco
2. **Refresh Token**: Renovacao automatica quando access_token expira
3. **RLS**: Usuarios acessam apenas suas conexoes
4. **Validacao**: Todos os dados validados antes da insercao
5. **Rate Limiting**: Respeitar limites da API do Google

---

## Ordem de Implementacao

| Etapa | Descricao | Arquivos |
|-------|-----------|----------|
| 1 | Configurar secrets Google OAuth | Settings do projeto |
| 2 | Criar tabelas no banco | Migracao SQL |
| 3 | Edge Function de autenticacao | google-sheets-auth/index.ts |
| 4 | Edge Function de listagem | google-sheets-list/index.ts |
| 5 | Edge Function de sincronizacao | google-sheets-sync/index.ts |
| 6 | Hook useGoogleSheets | hooks/useGoogleSheets.ts |
| 7 | Pagina Google Sheets | pages/GoogleSheetsPage.tsx |
| 8 | Componentes de mapeamento | components/google-sheets/*.tsx |
| 9 | Modal de selecao | modals/SpreadsheetSelectorModal.tsx |
| 10 | Atualizar navegacao | AppSidebar.tsx, App.tsx |
| 11 | Testes e polimento | Todos os arquivos |

---

## Pre-requisitos

Antes de iniciar a implementacao:
1. **Criar projeto no Google Cloud Console**
2. **Habilitar Google Sheets API e Google Drive API**
3. **Configurar tela de consentimento OAuth**
4. **Obter GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET**
5. **Adicionar secrets no projeto Lovable**

---

## Resultado Esperado

Sistema com integracao completa Google Sheets:

- Conexao OAuth segura com Google
- Listagem e selecao de planilhas
- Mapeamento inteligente de colunas
- Importacao automatica de transacoes, notas fiscais e balanco
- Sincronizacao periodica ou manual
- Dashboard alimentado por dados reais da planilha
- Historico de sincronizacoes com logs de erro
- Interface intuitiva para gerenciar conexoes

