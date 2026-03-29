

## Plano: Menu "Minha Empresa" com Perfil Completo e Benchmarks de Mercado

### Visão Geral

Novo menu na sidebar com página dedicada ao perfil da empresa do usuário, incluindo cadastro completo de dados empresariais, metas financeiras e comparações com benchmarks setoriais gerados por IA + referências estáticas.

### Arquitetura

```text
┌─────────────────────────────────────────────────┐
│  MINHA EMPRESA                                   │
├──────────────┬──────────────────────────────────┤
│  Perfil      │  Benchmarks de Mercado            │
│  Empresarial │                                   │
│              │  ┌────────────────────────────┐   │
│  CNPJ        │  │ Seus KPIs vs Média Setor   │   │
│  Razão Social│  │ (barras comparativas)      │   │
│  Setor       │  │ Margem, Crescimento, etc.  │   │
│  Porte       │  └────────────────────────────┘   │
│  Regime Trib.│                                   │
│  Funcionários│  ┌────────────────────────────┐   │
│  Faturamento │  │ Insights IA (gerados sob   │   │
│  Cidade/UF   │  │ demanda com Lovable AI)    │   │
│  Fundação    │  └────────────────────────────┘   │
│              │                                   │
│  METAS       │  ┌────────────────────────────┐   │
│  Receita alvo│  │ Progresso vs Metas         │   │
│  Despesa max │  │ (barras de progresso)      │   │
│  Lucro alvo  │  └────────────────────────────┘   │
└──────────────┴──────────────────────────────────┘
```

### Etapas

#### 1. Migração — Tabela `company_profiles`

Nova tabela para armazenar dados da empresa e metas:

```sql
CREATE TABLE public.company_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  cnpj text,
  razao_social text,
  nome_fantasia text,
  setor text,
  porte text DEFAULT 'ME',
  regime_tributario text,
  num_funcionarios integer,
  faturamento_anual numeric,
  cidade text,
  estado text,
  ano_fundacao integer,
  meta_receita_mensal numeric,
  meta_despesa_mensal numeric,
  meta_lucro_mensal numeric,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.company_profiles ENABLE ROW LEVEL SECURITY;
-- RLS: usuário vê/edita apenas seus dados
CREATE POLICY "Users manage own company" ON public.company_profiles
  FOR ALL TO authenticated USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_company_profiles_updated_at
  BEFORE UPDATE ON public.company_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

#### 2. Edge Function — `company-benchmarks`

Edge function que recebe setor, porte e KPIs reais do usuário. Combina:
- **Tabela estática** (hardcoded na function): médias setoriais de margem líquida, crescimento receita, % despesas sobre faturamento por setor/porte (referências SEBRAE/IBGE)
- **Lovable AI** (`google/gemini-3-flash-preview`): gera insights personalizados comparando os dados reais do usuário com as médias do setor

Retorna JSON com benchmarks estáticos + insights textuais da IA.

#### 3. Hook — `useCompanyProfile`

CRUD do perfil da empresa + query de benchmarks via `supabase.functions.invoke('company-benchmarks')`.

#### 4. Hook — `useCompanyBenchmarks`

Busca os KPIs reais do usuário (via `usePeriodMetrics`) e envia para a edge function para comparação.

#### 5. Página — `src/pages/CompanyPage.tsx`

Layout em duas colunas (desktop) / stack (mobile):

**Coluna esquerda — Perfil:**
- Formulário editável com todos os campos (CNPJ, razão social, setor, porte, regime tributário, funcionários, faturamento anual, cidade/UF, ano fundação)
- Seção de metas financeiras mensais (receita, despesa, lucro)
- Botão salvar com feedback

**Coluna direita — Benchmarks e Comparações:**
- Card "Seus KPIs vs Mercado" com barras horizontais comparativas (seu valor vs média setor)
- Card "Progresso vs Metas" com barras de progresso circulares ou lineares
- Card "Insights IA" com análise textual gerada sob demanda (botão "Gerar análise")
- Visual liquid glass premium consistente com o resto do sistema

#### 6. Sidebar + Rota

- Adicionar item "Minha Empresa" na sidebar (ícone `Building2`, url `/company`)
- Adicionar rota protegida em `App.tsx`

### Arquivos

| Ação | Arquivo |
|------|---------|
| Criar | `src/pages/CompanyPage.tsx` |
| Criar | `src/hooks/useCompanyProfile.ts` |
| Criar | `src/hooks/useCompanyBenchmarks.ts` |
| Criar | `supabase/functions/company-benchmarks/index.ts` |
| Editar | `src/components/layout/AppSidebar.tsx` (add nav item) |
| Editar | `src/App.tsx` (add route) |
| Migração | Tabela `company_profiles` |

### Escopo restrito
- Zero impacto em hooks, queries, filtros ou páginas existentes
- Dados de KPIs lidos via hooks existentes (`usePeriodMetrics`), sem duplicação
- IA chamada sob demanda (botão), não automática

