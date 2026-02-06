
# Plano: Pipeline de Sincronização Google Sheets → Supabase (Zero Erro)

## Visão Geral

Implementar um sistema robusto de sincronização que importa dados de planilhas Google Sheets para o banco de dados Supabase, alimentando os módulos Dashboard, Receitas, Despesas e Fluxo de Caixa, com suporte a insights gerados por IA.

---

## Diagnóstico do Estado Atual

### O que já existe:
- Conexão OAuth com Google funcionando (`google-sheets-auth`, `google-oauth-status`)
- Listagem de planilhas (`google-list-sheets`, `google-read-sheet-preview`)
- Tabela `google_sheet_connections` para armazenar conexões
- Tabela `google_sheet_sync_logs` para logs de sincronização
- Tabela `transactions` onde os dados financeiros são armazenados
- Hook `useTransactions` que alimenta Dashboard, Receitas e Despesas

### Problemas identificados:
1. **Sync atual não é idempotente** - cada sync insere novos registros, duplicando dados
2. **Não há chave única** para identificar registros da planilha (external_row_key)
3. **Não há auto-sync** - apenas sync manual
4. **Página de Cash Flow usa dados mockados** - não consome do banco
5. **Insights são estáticos** - não usam IA real
6. **Falta UI de erros detalhados** na página Google Sheets

---

## Arquitetura Proposta

### Parte A: Modelo de Dados (Migrations + RLS)

#### A1. Nova tabela `financial_transactions`
Tabela dedicada para transações importadas, com suporte a idempotência:

```text
┌─────────────────────────────────────────────────────────────────┐
│ financial_transactions                                          │
├─────────────────────────────────────────────────────────────────┤
│ id                  uuid PK DEFAULT gen_random_uuid()           │
│ user_id             uuid NOT NULL                               │
│ connected_sheet_id  uuid FK → google_sheet_connections(id)      │
│ external_row_key    text NOT NULL (chave idempotente)           │
│ source_tab          text NOT NULL                               │
│ source_row_number   int NOT NULL                                │
│ date                date NOT NULL                               │
│ description         text NOT NULL                               │
│ category            text NOT NULL                               │
│ type                text NOT NULL (RECEITA/DESPESA)             │
│ amount              numeric(14,2) NOT NULL                      │
│ account             text NULL                                   │
│ client_name         text NULL                                   │
│ raw                 jsonb NOT NULL (linha original)             │
│ created_at          timestamptz DEFAULT now()                   │
│ updated_at          timestamptz DEFAULT now()                   │
├─────────────────────────────────────────────────────────────────┤
│ UNIQUE(user_id, connected_sheet_id, external_row_key)           │
│ INDEX(user_id, date)                                            │
│ INDEX(user_id, type)                                            │
└─────────────────────────────────────────────────────────────────┘
```

**Chave Idempotente (external_row_key)**:
- Formato: `{sheet_tab}:{row_number}:{hash_do_conteúdo}`
- Permite detectar mudanças e evitar duplicações

#### A2. Atualizar `google_sheet_sync_logs` (sheet_sync_runs)
Adicionar campos para auditoria completa:

- `mode` text ('PUSH' | 'SCHEDULED' | 'MANUAL')
- `google_revision` text (etag/modifiedTime para detectar mudanças)
- `rows_upserted` int (substituir rows_imported por upserted)
- `retry_count` int DEFAULT 0
- `error_details` jsonb (detalhes estruturados de erros)

#### A3. RLS para todas as tabelas
- `financial_transactions`: user_id = auth.uid()
- Políticas existentes mantidas para outras tabelas

---

### Parte B: Edge Functions Robustas

#### B1. `/functions/v1/sheets-sync` (Refatorada)
**Entrada:**
```json
{
  "connectionId": "uuid",
  "mode": "MANUAL" | "SCHEDULED" | "PUSH"
}
```

**Fluxo:**
1. Validar auth.uid()
2. Buscar conexão e tokens (da tabela `google_oauth_tokens`)
3. Criar registro em `sheet_sync_runs` com status='RUNNING'
4. Ler dados da planilha (via Sheets API)
5. Para cada linha:
   - Validar campos obrigatórios (data, valor, descrição)
   - Normalizar dados (parsing de moeda BR, datas)
   - Gerar `external_row_key` = `{tab}:{row}:{hash}`
   - UPSERT em `financial_transactions`
   - Contar: rows_read, rows_upserted, rows_failed
6. Atualizar `sheet_sync_runs` com métricas finais
7. Retornar resumo JSON

**Idempotência:**
```sql
INSERT INTO financial_transactions (...)
ON CONFLICT (user_id, connected_sheet_id, external_row_key)
DO UPDATE SET
  date = EXCLUDED.date,
  description = EXCLUDED.description,
  ...
  updated_at = now()
```

#### B2. `/functions/v1/sheets-sync-status`
Lista histórico de sincronizações com status e erros:
```json
{
  "runs": [
    {
      "id": "uuid",
      "status": "SUCCESS",
      "started_at": "...",
      "finished_at": "...",
      "rows_read": 150,
      "rows_upserted": 148,
      "rows_failed": 2,
      "errors": [...]
    }
  ]
}
```

#### B3. `/functions/v1/sheets-preview-mapping`
Preview das colunas detectadas antes de ativar sync:
- Mostra cabeçalhos da planilha
- Sugere mapeamento automático (data, valor, descrição, categoria, tipo)
- Preview de 5 linhas normalizadas
- Permite ajuste manual do mapeamento

#### B4. `/functions/v1/ai-generate-insights`
**Entrada:**
```json
{
  "connectionId": "uuid",
  "dateFrom": "2024-01-01",
  "dateTo": "2024-12-31",
  "filters": {}
}
```

**Fluxo:**
1. Buscar transações do período
2. Calcular KPIs (total receitas, despesas, saldo, variação mensal, top categorias)
3. Chamar Lovable AI (Gemini) com prompt estruturado:
   - "Analise estes dados financeiros e forneça insights em PT-BR..."
   - Incluir números reais como evidência
4. Parsear resposta em formato estruturado

**Saída:**
```json
{
  "summary": "Resumo executivo...",
  "insights": [
    {
      "title": "Crescimento de Receita",
      "evidence": "Receita aumentou de R$ 45.000 para R$ 58.000 (29%)",
      "impact": "Positivo para fluxo de caixa",
      "recommendation": "Investigar fontes de crescimento"
    }
  ],
  "risks": [...],
  "opportunities": [...],
  "metadata": {
    "period": "2024-01-01 a 2024-12-31",
    "transactions_analyzed": 342,
    "generated_at": "..."
  }
}
```

---

### Parte C: Auto-Sync (Push + Fallback)

#### C1. Webhook via Apps Script
Como o Google Sheets não tem webhook nativo para edições, implementar via Apps Script:

```javascript
// No Google Apps Script da planilha
function onEdit(e) {
  const url = "https://[project].supabase.co/functions/v1/sheets-webhook";
  UrlFetchApp.fetch(url, {
    method: "POST",
    payload: JSON.stringify({
      spreadsheetId: e.source.getId(),
      sheetName: e.source.getActiveSheet().getName(),
      editedRow: e.range.getRow()
    }),
    headers: { "Content-Type": "application/json" }
  });
}
```

Criar edge function `/functions/v1/sheets-webhook`:
- Recebe notificação de edição
- Debounce de 30s para consolidar múltiplas edições
- Dispara sync com mode='PUSH'

#### C2. Fallback: Sync Agendado (Cron)
Usar pg_cron + pg_net para polling a cada 10 minutos:

```sql
SELECT cron.schedule(
  'sync-sheets-every-10-min',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://[project].supabase.co/functions/v1/sheets-cron-sync',
    headers := '{"Authorization": "Bearer [ANON_KEY]"}'::jsonb
  );
  $$
);
```

Edge function `/functions/v1/sheets-cron-sync`:
- Busca todas as conexões ativas
- Para cada conexão, verifica se precisa sync (última sync > 10 min)
- Dispara sync com mode='SCHEDULED'

---

### Parte D: Frontend (Lovable)

#### D1. Página Google Sheets (Aprimorada)
Adicionar seções:

**Status de Sincronização:**
- Card mostrando última sync, próxima sync agendada
- Indicador de status (sync em andamento, sucesso, erro)
- Botão "Sincronizar Agora"

**Histórico de Sincronizações:**
- Tabela com últimas 10 syncs
- Colunas: Data/Hora, Status, Linhas processadas, Erros
- Expandir para ver detalhes de erros

**Erros de Importação:**
- Lista de linhas que falharam
- Motivo do erro (data inválida, valor não numérico, etc.)
- Link para linha na planilha original

**Toggle Auto-Sync:**
- Switch para ativar/desativar sync automático
- Seletor de frequência (5, 10, 30, 60 min)

#### D2. Dashboard (Consumir dados reais)
O Dashboard já consome `useTransactions()`. Precisamos apenas:
- Criar hook `useFinancialTransactions()` que lê da nova tabela
- Ou: manter compatibilidade inserindo também na tabela `transactions` existente

**Decisão recomendada:** Usar a tabela `transactions` existente, adicionando campo `source` para identificar origem (manual/sheets).

#### D3. Página Cash Flow (Dados reais)
Atualmente usa dados mockados. Refatorar para:
- Usar `useTransactions()` com agregação por mês
- Calcular inflow/outflow/balance a partir de transações reais

#### D4. Página Insights (IA real)
Refatorar para:
- Botão "Gerar Insights"
- Chamar `/functions/v1/ai-generate-insights`
- Exibir insights estruturados com evidências
- Indicar período analisado e número de transações

---

### Parte E: Observabilidade e Confiabilidade

#### E1. Logs Estruturados
Cada edge function deve logar:
- Request ID único
- User ID
- Ação executada
- Resultado (sucesso/erro)
- Métricas (tempo de execução, linhas processadas)

Usar tabela `google_integration_logs` já existente.

#### E2. Alertas na UI
- Toast para erros de sync
- Badge de alerta no menu se houver syncs falhando
- Email (futuro) para erros críticos

#### E3. Modo Dry Run
Antes de ativar sync, permitir "Preview":
- Mostrar quantas linhas serão importadas
- Mostrar preview dos dados normalizados
- Confirmar antes de executar

---

## Sequência de Implementação

### Fase 1: Banco de Dados
1. Migration: adicionar campos à tabela `transactions` (source, external_row_key)
2. Migration: atualizar `google_sheet_sync_logs` (mode, google_revision, retry_count)
3. Criar índices para performance
4. RLS policies

### Fase 2: Edge Functions
1. Refatorar `google-sheets-sync` para ser idempotente
2. Criar `sheets-sync-status`
3. Criar `sheets-preview-mapping`
4. Criar `sheets-webhook` (para push)
5. Criar `sheets-cron-sync` (para polling)
6. Criar `ai-generate-insights`

### Fase 3: Frontend
1. Aprimorar GoogleSheetsPage com status e histórico
2. Refatorar CashFlowPage para dados reais
3. Refatorar InsightsPage para IA real
4. Adicionar toggle de auto-sync

### Fase 4: Auto-Sync
1. Documentar setup do Apps Script para webhook
2. Configurar pg_cron para polling

---

## Checklist de Testes

1. **Idempotência**: Rodar sync 3x seguidas → mesmo número de registros
2. **Atualização**: Mudar valor numa célula → registro atualizado (não duplicado)
3. **Erros parciais**: Linha com data inválida → outras linhas importam, erro logado
4. **Preview**: Ver preview antes de sync → dados corretos
5. **Status**: Verificar histórico de syncs → métricas corretas
6. **Auto-sync**: Editar planilha → sync dispara automaticamente
7. **Dashboard**: KPIs refletem dados importados
8. **Cash Flow**: Gráfico mostra dados reais por mês
9. **Insights**: IA gera insights baseados em dados reais

---

## Limitações e Alternativas

### Webhook via Apps Script
- **Limitação**: Requer configuração manual pelo usuário na planilha
- **Alternativa**: Documentar passo-a-passo com screenshots
- **Fallback**: Polling garante consistência mesmo sem webhook

### Cron no Supabase
- **Limitação**: Precisa habilitar extensões pg_cron e pg_net
- **Alternativa**: Usar serviço externo (cron-job.org) para chamar a edge function

---

## Arquivos a Criar/Modificar

### Novos Arquivos:
- `supabase/migrations/XXXXXX_financial_sync_schema.sql`
- `supabase/functions/sheets-sync-status/index.ts`
- `supabase/functions/sheets-preview-mapping/index.ts`
- `supabase/functions/sheets-webhook/index.ts`
- `supabase/functions/sheets-cron-sync/index.ts`
- `supabase/functions/ai-generate-insights/index.ts`
- `src/hooks/useSyncStatus.ts`
- `src/components/sheets/SyncHistoryTable.tsx`
- `src/components/sheets/SyncErrorList.tsx`

### Arquivos a Modificar:
- `supabase/functions/google-sheets-sync/index.ts` (refatorar para idempotência)
- `supabase/config.toml` (adicionar novas functions)
- `src/pages/GoogleSheetsPage.tsx` (adicionar status e histórico)
- `src/pages/CashFlowPage.tsx` (usar dados reais)
- `src/pages/InsightsPage.tsx` (integrar IA)
- `src/hooks/useGoogleSheets.ts` (adicionar mutations para novas APIs)

---

## Resumo Técnico

| Componente | Tecnologia | Responsabilidade |
|------------|------------|------------------|
| Banco | PostgreSQL + RLS | Armazenamento seguro e idempotente |
| Edge Functions | Deno/Supabase | Sync, status, preview, webhooks |
| Auto-sync Push | Apps Script | Notificar edições em tempo real |
| Auto-sync Poll | pg_cron | Garantir consistência a cada 10 min |
| IA Insights | Lovable AI (Gemini) | Análise e recomendações |
| Frontend | React + React Query | UI responsiva com cache |
