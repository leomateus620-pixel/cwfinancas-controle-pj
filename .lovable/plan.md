
# AI Finance Analyst: Sistema Híbrido de Validação e Insights

## Visão Geral da Arquitetura

O sistema implementará uma abordagem híbrida onde:
- **Pipeline determinístico** processa 100% das linhas (parsing, validação, normalização)
- **IA como camada de entendimento** entra apenas em 3 pontos específicos:
  1. Profiling de planilha (detectar mapeamento de colunas por cabeçalho)
  2. Sugestão de regras de limpeza (identificar padrões de total/cabeçalho)
  3. Geração de insights financeiros (análise de agregações)

```text
┌────────────────────────────────────────────────────────────────────────────┐
│                        FLUXO DE DADOS                                      │
│                                                                            │
│  Google Sheets ──► [Profile Cache?] ──► Pipeline Deterministico ──► DB    │
│       │                  │                      │                          │
│       │                  │ (cache hit)          │                          │
│       ▼                  ▼                      ▼                          │
│  [AI Profile]       Usa regras            [Transações]                     │
│   (1 chamada)       existentes             normalizadas                    │
│       │                                         │                          │
│       ▼                                         ▼                          │
│  ai_sheet_profiles                     [AI Insights]                       │
│   (cache)                               (1 chamada por período)            │
│                                                 │                          │
│                                                 ▼                          │
│                                          ai_insights                       │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Parte A: Modelo de Dados (Migrations)

### A1. Tabela `ai_sheet_profiles` (Cache de Perfil da Planilha)

```sql
CREATE TABLE public.ai_sheet_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connected_sheet_id uuid REFERENCES google_sheet_connections(id) ON DELETE CASCADE,
  source_tab text NOT NULL,
  header_signature text NOT NULL,  -- hash(cabeçalhos + qtd colunas)
  column_mapping jsonb NOT NULL DEFAULT '{}',
  parsing_rules jsonb NOT NULL DEFAULT '{}',
  skip_patterns jsonb DEFAULT '[]',  -- patterns para detectar linhas ignoráveis
  confidence numeric(3,2) NOT NULL DEFAULT 0.5,
  ai_suggestions jsonb,  -- sugestões originais da IA para auditoria
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT unique_profile_per_header 
    UNIQUE(user_id, connected_sheet_id, source_tab, header_signature)
);

CREATE INDEX idx_ai_sheet_profiles_lookup 
  ON ai_sheet_profiles(user_id, connected_sheet_id, source_tab);

ALTER TABLE ai_sheet_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their profiles" ON ai_sheet_profiles
  FOR ALL USING (auth.uid() = user_id);
```

### A2. Tabela `ai_insights` (Insights Gerados)

```sql
CREATE TABLE public.ai_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connected_sheet_id uuid REFERENCES google_sheet_connections(id) ON DELETE SET NULL,
  date_from date NOT NULL,
  date_to date NOT NULL,
  filters jsonb DEFAULT '{}',
  kpis jsonb NOT NULL,  -- números que embasam os insights
  insights jsonb NOT NULL,  -- estrutura completa de insights
  data_quality jsonb NOT NULL,  -- cobertura, needs_review, notas
  model_version text NOT NULL,
  prompt_hash text,  -- para detectar se precisa regenerar
  created_at timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT unique_insight_period 
    UNIQUE(user_id, connected_sheet_id, date_from, date_to, COALESCE(filters::text, '{}'))
);

CREATE INDEX idx_ai_insights_lookup 
  ON ai_insights(user_id, date_from, date_to);

ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their insights" ON ai_insights
  FOR ALL USING (auth.uid() = user_id);
```

### A3. Tabela `transaction_flags` (Qualidade por Linha)

```sql
CREATE TABLE public.transaction_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  needs_review boolean NOT NULL DEFAULT false,
  reasons text[] NOT NULL DEFAULT '{}',
  confidence numeric(3,2) DEFAULT 1.0,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT unique_flag_per_transaction UNIQUE(transaction_id)
);

CREATE INDEX idx_transaction_flags_review 
  ON transaction_flags(transaction_id) WHERE needs_review = true;

ALTER TABLE transaction_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage flags for their transactions" ON transaction_flags
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM transactions t 
      WHERE t.id = transaction_flags.transaction_id 
      AND t.user_id = auth.uid()
    )
  );
```

### A4. Trigger para updated_at

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_ai_sheet_profiles_updated_at
  BEFORE UPDATE ON ai_sheet_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transaction_flags_updated_at
  BEFORE UPDATE ON transaction_flags
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

## Parte B: Edge Functions

### B1. `/functions/v1/ai-profile-sheet` (Profiling com Cache)

**Objetivo**: Gerar/recuperar perfil de mapeamento para uma aba.

**Fluxo**:
1. Calcular `header_signature` = hash(cabeçalhos + quantidade)
2. Verificar cache: `ai_sheet_profiles` com mesma assinatura e `confidence >= 0.85`
3. Se cache válido → retornar imediatamente (SEM chamar IA)
4. Se não → chamar IA UMA vez com amostra (50-100 linhas) para:
   - Detectar mapeamento de colunas
   - Sugerir regras de parsing (formatos de data/moeda)
   - Identificar padrões de linhas ignoráveis
5. Salvar em `ai_sheet_profiles`
6. Retornar perfil

**Entrada**:
```json
{
  "connectionId": "uuid",
  "tabName": "Planilha1",
  "forceRefresh": false
}
```

**Saída**:
```json
{
  "profile_id": "uuid",
  "header_signature": "abc123",
  "column_mapping": {
    "date": "Data",
    "description": "Histórico",
    "amount": "Valor",
    "category": "Categoria",
    "credit": "Crédito",
    "debit": "Débito"
  },
  "parsing_rules": {
    "date_format": "DD/MM/YYYY",
    "currency": "BRL",
    "negative_formats": ["()", "-R$"],
    "decimal_separator": ","
  },
  "skip_patterns": [
    {"type": "keyword", "value": "total"},
    {"type": "keyword", "value": "saldo"},
    {"type": "row_pattern", "description": "Linha com apenas números sem data"}
  ],
  "confidence": 0.92,
  "from_cache": true
}
```

### B2. `/functions/v1/sheets-sync-zero-error` (Sync Aprimorado)

**Diferenças do sync atual**:
1. Consulta `ai_sheet_profiles` antes de processar
2. Usa `parsing_rules` do perfil se disponível
3. Cria `transaction_flags` para linhas ambíguas
4. Nunca falha por linha individual - marca `needs_review`

**Fluxo**:
```text
1. Buscar perfil (ai_sheet_profiles) se existir
2. Para cada linha:
   a. Aplicar skip_patterns → skip (não erro)
   b. Parsear com parsing_rules → valor + tipo
   c. Se ambíguo:
      - Usar fallback determinístico
      - Marcar needs_review = true
      - Registrar reason
   d. UPSERT em transactions
   e. Se needs_review → INSERT/UPDATE em transaction_flags
3. Retornar métricas detalhadas
```

**Saída atualizada**:
```json
{
  "success": true,
  "rows_read": 198,
  "rows_imported": 175,
  "rows_skipped": 20,
  "rows_failed": 0,
  "rows_needs_review": 3,
  "skip_breakdown": {
    "empty": 5,
    "total_row": 8,
    "header_row": 4,
    "zero_value": 3
  },
  "review_breakdown": {
    "date_missing": 2,
    "category_empty": 1
  },
  "used_profile": true,
  "profile_confidence": 0.92
}
```

### B3. `/functions/v1/ai-generate-finance-insights` (Insights Estruturados)

**Diferenças do atual**:
1. Calcula KPIs mais ricos (outliers, concentração, recorrências)
2. Inclui `data_quality` obrigatório
3. Retorna JSON estruturado (não texto livre)
4. Salva em `ai_insights` para cache
5. Uma única chamada de IA por período

**Fluxo**:
```text
1. Verificar cache: ai_insights com mesmo período/filtros
2. Se cache recente (< 24h) → retornar
3. Buscar transações do Supabase (NÃO do Sheets)
4. Calcular features:
   - KPIs básicos (receita, despesa, saldo, margem)
   - Tendências (mensal, variação)
   - Top categorias
   - Outliers (gastos > 2x média da categoria)
   - Concentração (% maior cliente/fornecedor)
   - Recorrências (pagamentos mensais fixos)
   - Gaps de caixa (meses com saldo negativo)
5. Calcular data_quality:
   - coverage_pct = linhas válidas / total
   - needs_review_count = count de transaction_flags
6. Chamar IA UMA vez com features estruturadas
7. Parsear resposta em formato obrigatório
8. Salvar em ai_insights
9. Retornar
```

**Saída obrigatória**:
```json
{
  "summary": "Resumo executivo de 2-3 frases...",
  "highlights": [
    {
      "title": "Crescimento Consistente de Receita",
      "evidence": "Receita cresceu de R$ 45.000 (Jan) para R$ 58.000 (Dez), +29%",
      "impact": "Positivo - maior capacidade de investimento",
      "recommendation": "Investigar quais clientes/produtos geraram este crescimento"
    }
  ],
  "risks": [
    {
      "title": "Concentração em Cliente Único",
      "evidence": "Cliente ABC representa 42% da receita total",
      "severity": "medium",
      "mitigation": "Diversificar carteira para reduzir dependência"
    }
  ],
  "opportunities": [
    {
      "title": "Redução de Custos Operacionais",
      "evidence": "Categoria 'Serviços' tem gastos 35% acima de Jan",
      "potential": "Economia potencial de R$ 5.000/mês",
      "next_steps": "Revisar contratos de fornecedores de serviços"
    }
  ],
  "anomalies": [
    {
      "title": "Gasto Atípico em Dezembro",
      "evidence": "R$ 12.000 em 'Equipamentos', 4x a média mensal",
      "why_unusual": "Maior gasto da categoria no período analisado",
      "check": "Verificar se foi investimento planejado ou exceção"
    }
  ],
  "questions": [
    "Por que a categoria 'Marketing' caiu 60% em Nov?",
    "O aumento de receita em Set é recorrente ou sazonal?"
  ],
  "data_quality": {
    "coverage_pct": 98.5,
    "needs_review_count": 3,
    "notes": "3 transações com data ausente foram importadas com data atual"
  },
  "metadata": {
    "period": "2024-01-01 a 2024-12-31",
    "transactions_analyzed": 342,
    "generated_at": "2024-12-15T10:30:00Z",
    "model": "google/gemini-3-flash-preview"
  }
}
```

---

## Parte C: Frontend

### C1. Componentes de UI

**1. `ProfileStatusCard`** - Status do perfil da planilha
```tsx
// Exibe na GoogleSheetsPage
<Card>
  <CardHeader>
    <CardTitle>Perfil da Planilha</CardTitle>
    <Badge variant={profile.confidence > 0.8 ? "success" : "warning"}>
      Confiança: {Math.round(profile.confidence * 100)}%
    </Badge>
  </CardHeader>
  <CardContent>
    <p>Colunas detectadas: {Object.keys(profile.column_mapping).length}</p>
    <p>Regras de parsing: {profile.parsing_rules.date_format}</p>
    <Button onClick={handleRevalidate}>Revalidar Mapeamento</Button>
  </CardContent>
</Card>
```

**2. `DataQualityCard`** - Indicador de qualidade no Dashboard
```tsx
<Card>
  <CardHeader>
    <CardTitle>Qualidade dos Dados</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="flex items-center gap-4">
      <CircularProgress value={dataQuality.coverage_pct} />
      <div>
        <p className="text-lg font-semibold">
          {dataQuality.coverage_pct.toFixed(1)}% cobertura
        </p>
        {dataQuality.needs_review_count > 0 && (
          <p className="text-sm text-muted-foreground">
            {dataQuality.needs_review_count} itens para revisar
          </p>
        )}
      </div>
    </div>
  </CardContent>
</Card>
```

**3. `AIInsightsPanel`** - Painel de insights na InsightsPage
```tsx
<div className="space-y-4">
  {/* Summary Card */}
  <Card className="bg-gradient-to-br from-primary/5">
    <CardContent>
      <p className="text-lg">{insights.summary}</p>
    </CardContent>
  </Card>
  
  {/* Highlights */}
  <section>
    <h3>Destaques</h3>
    {insights.highlights.map(h => (
      <InsightCard 
        icon={TrendingUp} 
        title={h.title}
        evidence={h.evidence}
        impact={h.impact}
        recommendation={h.recommendation}
      />
    ))}
  </section>
  
  {/* Risks */}
  <section>
    <h3>Riscos</h3>
    {insights.risks.map(r => (
      <RiskCard 
        title={r.title}
        evidence={r.evidence}
        severity={r.severity}
        mitigation={r.mitigation}
      />
    ))}
  </section>
  
  {/* Similar for opportunities, anomalies, questions */}
</div>
```

**4. `TransactionReviewList`** - Lista de transações para revisar
```tsx
<Card>
  <CardHeader>
    <CardTitle>Itens para Revisão</CardTitle>
  </CardHeader>
  <CardContent>
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Data</TableHead>
          <TableHead>Descrição</TableHead>
          <TableHead>Valor</TableHead>
          <TableHead>Problema</TableHead>
          <TableHead>Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {flaggedTransactions.map(t => (
          <TableRow key={t.id}>
            <TableCell>{t.date || "(sem data)"}</TableCell>
            <TableCell>{t.description}</TableCell>
            <TableCell>{formatCurrency(t.amount)}</TableCell>
            <TableCell>
              {t.flags.reasons.map(r => (
                <Badge key={r} variant="outline">{r}</Badge>
              ))}
            </TableCell>
            <TableCell>
              <Button size="sm" onClick={() => handleEdit(t)}>Corrigir</Button>
              <Button size="sm" variant="ghost" onClick={() => handleDismiss(t)}>OK</Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </CardContent>
</Card>
```

### C2. Hooks

**`useSheetProfile`** - Gerenciar perfil da planilha
```typescript
export function useSheetProfile(connectionId: string) {
  const { data: profile, isLoading, refetch } = useQuery({
    queryKey: ["sheet-profile", connectionId],
    queryFn: async () => {
      const { data } = await supabase.functions.invoke("ai-profile-sheet", {
        body: { connectionId }
      });
      return data;
    }
  });
  
  const revalidate = useMutation({
    mutationFn: async () => {
      const { data } = await supabase.functions.invoke("ai-profile-sheet", {
        body: { connectionId, forceRefresh: true }
      });
      return data;
    },
    onSuccess: () => refetch()
  });
  
  return { profile, isLoading, revalidate };
}
```

**`useFinanceInsights`** - Buscar/gerar insights
```typescript
export function useFinanceInsights(params: InsightsParams) {
  const [insights, setInsights] = useState<AIInsights | null>(null);
  
  const generate = useMutation({
    mutationFn: async () => {
      const { data } = await supabase.functions.invoke("ai-generate-finance-insights", {
        body: params
      });
      return data;
    },
    onSuccess: setInsights
  });
  
  return { insights, isLoading: generate.isPending, generate };
}
```

**`useFlaggedTransactions`** - Transações para revisão
```typescript
export function useFlaggedTransactions() {
  return useQuery({
    queryKey: ["flagged-transactions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("transactions")
        .select(`
          *,
          transaction_flags!inner(
            needs_review,
            reasons,
            confidence
          )
        `)
        .eq("transaction_flags.needs_review", true)
        .order("date", { ascending: false });
      return data;
    }
  });
}
```

---

## Parte D: Regras de Eficiência e Segurança

### D1. Limite de Chamadas de IA

| Contexto | Máximo de Chamadas |
|----------|-------------------|
| Profiling de planilha | 1 por header_signature |
| Sync de dados | 0 (usa profile se existir) |
| Geração de insights | 1 por período solicitado |
| Total por sync completo | 0-1 (só se profile não existir) |

### D2. Cache Strategy

```text
ai_sheet_profiles:
- Chave: (user_id, connected_sheet_id, source_tab, header_signature)
- TTL: Infinito (invalidado apenas por forceRefresh ou mudança de header)
- Hit condition: confidence >= 0.85

ai_insights:
- Chave: (user_id, connected_sheet_id, date_from, date_to, filters)
- TTL: 24 horas
- Invalidado quando novas transações são importadas
```

### D3. Nunca Inventar Dados

```typescript
// No prompt para IA de insights:
const systemPrompt = `
Você é um analista financeiro experiente.

REGRAS ABSOLUTAS:
1. Use APENAS os números fornecidos nos KPIs e features
2. NUNCA invente valores, percentuais ou tendências
3. Se uma métrica não foi fornecida, NÃO mencione
4. Sempre cite a evidência numérica exata
5. Se a cobertura de dados < 95%, declare no resumo
6. Se needs_review_count > 5%, reduza assertividade

Formato de resposta: JSON estruturado conforme schema.
`;
```

### D4. Fallbacks Determinísticos

```typescript
// Quando IA falha ou confidence < 0.7:
function deterministicFallback(row: RowData, headers: string[]) {
  // Usa mapeamento por sinônimos hardcoded
  const mapping = autoDetectMapping(headers);
  
  // Parsing robusto sem IA
  const amount = parseBRL(row[mapping.amount]);
  const date = parseDate(row[mapping.date]) || today();
  
  // Marca para revisão se ambíguo
  const needsReview = !date || !row[mapping.description];
  
  return { amount, date, type, needsReview, reasons: [...] };
}
```

---

## Parte E: Arquivos a Criar/Modificar

### Novos Arquivos
- `supabase/migrations/XXXXXX_ai_finance_tables.sql`
- `supabase/functions/ai-profile-sheet/index.ts`
- `supabase/functions/sheets-sync-zero-error/index.ts` (pode ser refactor do existente)
- `src/hooks/useSheetProfile.ts`
- `src/hooks/useFinanceInsights.ts`
- `src/hooks/useFlaggedTransactions.ts`
- `src/components/sheets/ProfileStatusCard.tsx`
- `src/components/dashboard/DataQualityCard.tsx`
- `src/components/insights/AIInsightsPanel.tsx`
- `src/components/insights/InsightCard.tsx`
- `src/components/insights/RiskCard.tsx`
- `src/components/transactions/TransactionReviewList.tsx`

### Arquivos a Modificar
- `supabase/functions/ai-generate-insights/index.ts` → Refatorar para estrutura obrigatória
- `supabase/functions/google-sheets-sync/index.ts` → Integrar com ai_sheet_profiles
- `supabase/config.toml` → Adicionar novas functions
- `src/pages/GoogleSheetsPage.tsx` → Adicionar ProfileStatusCard
- `src/pages/InsightsPage.tsx` → Substituir mock por AIInsightsPanel real
- `src/pages/OverviewPage.tsx` → Adicionar DataQualityCard

---

## Checklist de Validação

1. **Eficiência**: Sync de 200 linhas NÃO chama IA (usa profile existente)
2. **Cache**: Segunda sync com mesmo header → cache hit
3. **Zero Erro Visível**: Linhas de total/cabeçalho → skipped (não failed)
4. **Needs Review**: Data ausente → importa com flag, não falha
5. **Insights Rastreáveis**: Cada insight cita números reais do período
6. **Data Quality**: UI mostra cobertura e itens para revisão
7. **Idempotência**: 3 syncs seguidos → mesmo número de transações

---

## Resumo Técnico

| Componente | Chamadas IA | Cache | Fallback |
|------------|-------------|-------|----------|
| Profile Sheet | 1x por header | Infinito | Sinônimos hardcoded |
| Sync Data | 0 | Usa profile | Determinístico |
| Insights | 1x por período | 24h | KPIs sem análise textual |

**Objetivo final**: Sistema que processa 100% das linhas válidas, marca para revisão os ambíguos, NUNCA falha silenciosamente, e gera insights acionáveis com rastreabilidade total.
