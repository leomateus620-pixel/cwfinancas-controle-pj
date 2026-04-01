

## Plano: Isolamento por Planilha, CNPJ Lookup e Upgrade de Metas

### Diagnóstico do Estado Atual

**Problema crítico**: `company_profiles` usa `user_id UNIQUE` — só permite 1 empresa por usuário. Ao trocar de planilha, os dados da empresa anterior são reutilizados. Não há isolamento.

**Metas**: Apenas 3 campos numéricos na tabela `company_profiles`. Sem metas anuais, sem histórico.

**CNPJ lookup**: Usa IA para inferir dados por nome — não consulta fontes públicas reais.

---

### Fase 1 — Migração de Banco (Schema)

**1a. Adicionar `connection_id` à tabela `company_profiles`**

```sql
-- Remover constraint UNIQUE(user_id), adicionar connection_id
ALTER TABLE public.company_profiles 
  ADD COLUMN connection_id uuid REFERENCES google_sheet_connections(id) ON DELETE SET NULL;

-- Novo índice único: 1 perfil por user+connection
CREATE UNIQUE INDEX company_profiles_user_connection 
  ON public.company_profiles(user_id, connection_id);

-- Drop old unique constraint on user_id alone
ALTER TABLE public.company_profiles DROP CONSTRAINT IF EXISTS company_profiles_user_id_key;

-- Adicionar campo de metadados CNPJ lookup
ALTER TABLE public.company_profiles 
  ADD COLUMN cnpj_lookup_source text,
  ADD COLUMN cnpj_lookup_at timestamptz,
  ADD COLUMN locally_edited_fields text[] DEFAULT '{}';
```

**1b. Tabela `company_annual_goals`**

```sql
CREATE TABLE public.company_annual_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  connection_id uuid REFERENCES google_sheet_connections(id) ON DELETE SET NULL,
  year integer NOT NULL,
  meta_receita_anual numeric,
  meta_despesa_anual numeric,
  meta_lucro_anual numeric,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, connection_id, year)
);

ALTER TABLE public.company_annual_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own annual goals" ON public.company_annual_goals
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_annual_goals_updated_at
  BEFORE UPDATE ON public.company_annual_goals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

**1c. Atualizar RLS de `company_profiles`** — manter a policy existente (já filtra por `user_id`).

---

### Fase 2 — Edge Function `cnpj-lookup`

Nova edge function que consulta APIs públicas reais de CNPJ, com fallback:

```text
Fonte 1: brasilapi.com.br/api/cnpj/v1/{cnpj}  (gratuita, dados da Receita)
Fonte 2: receitaws.com.br/v1/cnpj/{cnpj}       (fallback)
Fonte 3: AI inference via Lovable AI           (último recurso)
```

- Validação de CNPJ (dígitos verificadores) no backend antes de chamar
- Normaliza resposta para schema unificado
- Retorna: razao_social, nome_fantasia, cnpj, situacao_cadastral, natureza_juridica, data_abertura, cnae_principal, cnaes_secundarios, porte, endereco, cidade, estado, cep, telefone, email, quadro_societario
- Salva `source` e `lookup_at` nos metadados

---

### Fase 3 — Hooks Refatorados

**`useActiveConnection()`** — novo hook que retorna o `connection_id` da planilha ativa (mais recente do user).

**`useCompanyProfile(connectionId)`** — refatorar:
- Query key: `["company-profile", user_id, connectionId]`
- Filtro: `.eq("user_id", user.id).eq("connection_id", connectionId)`
- Upsert: inclui `connection_id`

**`useCompanyCnpjLookup()`** — novo hook:
- Valida CNPJ no client (dígitos verificadores)
- Chama `cnpj-lookup` edge function
- Retorna preview dos dados
- Método `confirmAndSave(connectionId)` persiste

**`useAnnualGoals(connectionId)`** — novo hook:
- CRUD na tabela `company_annual_goals`
- Query key com `connectionId`

---

### Fase 4 — CompanyPage.tsx Reescrita

**Seção 1: Header** — exibe nome fantasia + planilha vinculada

**Seção 2: Dados Cadastrais** (coluna esquerda)
- Input de CNPJ com máscara `00.000.000/0000-00`
- Validação visual em tempo real (dígitos verificadores)
- Botão "Consultar CNPJ" → chama edge function → exibe preview modal → confirma
- Badge discreto: "Fonte: BrasilAPI" / "Editado localmente"
- Auto-fill por nome da planilha (existente, mantido)

**Seção 3: Benchmark** (coluna direita) — mantido como está

**Seção 4: Metas Mensais** — upgrade visual:
- Gauges SVG maiores com melhor hierarquia
- Cards com status semântico (em dia / atenção / atrasada / concluída)
- Microcopy executivo
- Forecast: "mantendo esse ritmo, meta concluída em X dias"
- Inputs colapsáveis mantidos

**Seção 5: Metas Anuais** (nova seção):
- Card principal: meta anual total, acumulado, gap, % realizado
- 3 indicadores: projeção de fechamento, melhor mês, média mensal
- Barra de progresso anual com contribuição por mês (dados de `usePeriodMetrics.monthlyBreakdown`)
- Inputs editáveis para receita/despesa/lucro anuais
- Empty state elegante

**Seção 6: Resumo Financeiro** — mantido como está

---

### Fase 5 — Tratamento de Troca de Planilha

- `useActiveConnection` retorna `connectionId` reativo
- Ao mudar, React Query invalida automaticamente (key inclui connectionId)
- Sem flash de dados antigos: skeleton loading enquanto carrega novo contexto
- Se `connectionId` for null (sem planilha), exibir empty state orientativo

---

### Arquivos

| Ação | Arquivo |
|------|---------|
| Migração | Schema: `connection_id` em `company_profiles` + tabela `company_annual_goals` |
| Criar | `supabase/functions/cnpj-lookup/index.ts` |
| Criar | `src/hooks/useActiveConnection.ts` |
| Criar | `src/hooks/useCompanyCnpjLookup.ts` |
| Criar | `src/hooks/useAnnualGoals.ts` |
| Reescrever | `src/hooks/useCompanyProfile.ts` (adicionar connectionId) |
| Reescrever | `src/pages/CompanyPage.tsx` (layout completo) |
| Não tocar | `useCompanyBenchmarks`, `usePeriodMetrics`, sidebar, rotas, edge functions existentes |

### Escopo restrito
- Zero impacto em dashboard, DRE, forecast, transações, sync
- Dados existentes em `company_profiles` recebem `connection_id = NULL` (retrocompatível)
- Edge function `company-benchmarks` inalterada

