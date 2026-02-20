
# DRE LCF por Nucleo - Deteccao Automatica e Parser Multi-Aba

## Resumo

Implementar suporte ao formato "LCF por Nucleo" de DRE, onde cada mes tem sua propria aba (ex: "DRE Jan26", "DRE Fev26") com colunas por nucleo (AMBIENTAL, PENAL). O sistema detecta automaticamente o template e usa o parser correto, sem quebrar o formato DEFAULT existente.

## Arquitetura

O fluxo atual (edge function `dre-sync`) busca UMA aba "DRE" com multiplas colunas de meses. O formato LCF e o oposto: MULTIPLAS abas DRE, cada uma com colunas de nucleos.

A solucao: expandir a edge function para:
1. Listar TODAS as abas candidatas a DRE (nao apenas a primeira)
2. Detectar o template de cada aba
3. Rotear para o parser correto (DEFAULT ou LCF_NUCLEO)
4. Criar um `dre_period` por mes/aba, com `dre_lines` incluindo a dimensao `nucleo`

## Mudancas no Banco de Dados

### Migracoes SQL

**1. Adicionar coluna `nucleo` na tabela `dre_lines`:**

```text
ALTER TABLE dre_lines ADD COLUMN nucleo text DEFAULT NULL;
ALTER TABLE dre_lines ADD COLUMN section text DEFAULT NULL;
```

- `nucleo`: "AMBIENTAL", "PENAL", ou NULL (para DEFAULT e linhas consolidadas)
- `section`: enum-like para identificar a secao ("RECEITA_BRUTA", "DESPESAS_NUCLEO", "DESPESAS_ESCRITORIO", "RESULTADO", "SOBRA", "DISTRIBUICAO")

**2. Adicionar coluna `template_type` na tabela `dre_periods`:**

```text
ALTER TABLE dre_periods ADD COLUMN template_type text DEFAULT 'DEFAULT';
```

**3. Criar tabela `dre_validation_issues`:**

```text
CREATE TABLE dre_validation_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL REFERENCES dre_periods(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  rule_code text NOT NULL,
  expected_cents bigint,
  actual_cents bigint,
  diff_cents bigint,
  details_json jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE dre_validation_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own validation issues"
  ON dre_validation_issues FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own validation issues"
  ON dre_validation_issues FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own validation issues"
  ON dre_validation_issues FOR DELETE
  USING (auth.uid() = user_id);
```

## Edge Function `dre-sync` - Refatoracao

### Funcoes novas a adicionar no mesmo `index.ts`:

**`listCandidateDreSheets(sheetTitles: string[]): string[]`**
- Retorna TODAS as abas cujo nome contenha "DRE" (case-insensitive)
- Inclui: "DRE", "DRE Jan26", "DRE Fev/2026", "DRE 02-2026", etc.

**`detectDreTemplate(rows: string[][]): "LCF_NUCLEO" | "DEFAULT"`**
- Busca nas primeiras 20 linhas por marcadores:
  - "RECEITA BRUTA TOTAL" (case-insensitive)
  - "DESPESAS TOTAIS" + "nucleo" (variacao)
  - Cabecalhos contendo "NUCLEO AMBIENTAL" e "NUCLEO PENAL"
- Se todos presentes: retorna "LCF_NUCLEO"
- Caso contrario: "DEFAULT"

**`extractPeriodFromTabName(tabName: string): string | null`**
- Extrai mes/ano de nomes como "DRE Jan26", "DRE Fev/2026", "DRE 02-2026"
- Retorna formato "YYYY-MM" ou null

**`parseDreLcfNucleo(rows: string[][], sheetName: string): LcfParseResult`**
- Resolve merges (propagar valor da celula top-left)
- Identifica colunas dos nucleos (AMBIENTAL, PENAL) no cabecalho
- Identifica a competencia (do nome da aba ou do cabecalho)
- Extrai secoes por rotulo normalizado:
  - RECEITA_BRUTA: "RECEITA BRUTA TOTAL"
  - DESPESAS_NUCLEO: "DESPESAS TOTAIS por nucleo"
  - DESPESAS_ESCRITORIO: "DESPESAS TOTAIS escritorio"
  - RESULTADO: "RESULTADO antes..."
  - SOBRA: "SOBRA DE CADA NUCLEO"
  - DISTRIBUICAO: "Lucro distribuido"
- Para cada linha: extrair valor por nucleo
- Gerar tambem linhas CONSOLIDADAS (soma dos nucleos) para visualizacao

**`validateDreLcf(lines, periodKey): ValidationIssue[]`**
- Recalcular e conferir (tolerancia 1 centavo = 0.01):
  - Resultado = Receita Bruta - Despesas Nucleo (por nucleo)
  - Sobra deve bater com resultado final por nucleo
- Retorna lista de issues sem travar importacao

### Fluxo principal refatorado:

```text
1. Listar sheetTitles
2. candidateTabs = listCandidateDreSheets(sheetTitles)
3. Se vazio: retornar "Aba DRE nao encontrada"
4. Para cada candidateTab:
   a. Ler dados da aba
   b. template = detectDreTemplate(rows)
   c. Se template === "LCF_NUCLEO":
      - result = parseDreLcfNucleo(rows, tabName)
      - periodKey = result.periodKey (de extractPeriodFromTabName ou cabecalho)
      - Se periodKey === null: status = "NEEDS_REVIEW"
      - Upsert dre_period (user_id, sheet_id, period_key) com template_type="LCF_NUCLEO"
      - Delete + insert dre_lines com nucleo preenchido
      - Validar e salvar issues
   d. Se template === "DEFAULT":
      - Usar parser atual (logica existente intacta)
      - Gerar dre_periods e dre_lines como hoje
5. Retornar sumario: quantas abas importadas, por template, warnings
```

### Idempotencia:

- Para LCF: UNIQUE por (user_id, sheet_id, period_key) no dre_periods
- Antes de inserir linhas de um periodo, deletar linhas antigas do mesmo period_id
- Deletar validation_issues antigas do mesmo period_id

## Frontend

### Hook `useDRE.ts` - Ajustes

- Adicionar campo `nucleo` e `section` nas interfaces `DRELine`
- Adicionar `template_type` na interface `DREPeriod`
- Novo estado: `viewMode: "consolidated" | "by_nucleo"`
- Quando `viewMode === "consolidated"`: filtrar linhas onde `nucleo IS NULL` (linhas consolidadas geradas pelo parser)
- Quando `viewMode === "by_nucleo"`: mostrar todas as linhas com coluna nucleo

### Pagina `DREPage.tsx` - Ajustes

**Seletor de competencia:**
- Ja existe o dropdown de periodo. Para LCF, cada periodo = 1 mes (em vez de coluna)
- Sem mudanca estrutural, apenas mais opcoes no dropdown

**Toggle Consolidado / Por Nucleo:**
- Novo toggle button group visivel quando `template_type === "LCF_NUCLEO"`
- "Consolidado": tabela com 2 colunas (Linha DRE | Valor)
- "Por Nucleo": tabela com 3+ colunas (Linha DRE | Ambiental | Penal)

**Badge de validacao:**
- Ja existe badge "Divergencia detectada" quando `validationStatus === "warning"`
- Adicionar badge "Revisao" quando `validationStatus === "NEEDS_REVIEW"`

**Tabela por nucleo:**
- Header: "Linha DRE | Nucleo Ambiental | Nucleo Penal"
- Cada linha mostra valores lado a lado
- Secoes com headers (RECEITA BRUTA, DESPESAS, etc.)

**KPI Cards para LCF:**
- Ajustar `calculateKPIs` para LCF:
  - Faturamento = RECEITA BRUTA TOTAL (consolidado)
  - Despesas = DESPESAS TOTAIS nucleo + DESPESAS TOTAIS escritorio
  - Resultado = linha RESULTADO (subtotal)
  - Margem = Resultado / Faturamento

## Arquivos criados/modificados

| Arquivo | Acao |
|---|---|
| Migracao SQL | Criar: `dre_validation_issues`, adicionar colunas `nucleo`, `section` em `dre_lines`, `template_type` em `dre_periods` |
| `supabase/functions/dre-sync/index.ts` | Refatorar: adicionar `listCandidateDreSheets`, `detectDreTemplate`, `extractPeriodFromTabName`, `parseDreLcfNucleo`, `validateDreLcf`; manter parser DEFAULT intacto |
| `src/hooks/useDRE.ts` | Atualizar interfaces, adicionar suporte a `nucleo`, `section`, `template_type`, e `viewMode` |
| `src/pages/DREPage.tsx` | Adicionar toggle Consolidado/Por Nucleo, tabela multi-coluna, badge NEEDS_REVIEW, KPIs adaptados |

## Detalhes tecnicos importantes

### Parser BRL no edge function
O `parseBRL` atual ja trata parenteses como negativos e virgula como decimal. Precisa apenas:
- Tratar "-" (traco sozinho) como null/zero (ja faz isso na linha 32)
- Nao ha necessidade de centavos inteiros no banco pois `dre_lines.value` e NUMERIC -- a precisao ja e garantida pelo tipo

### Deteccao de competencia a partir do nome da aba
Regex para extrair mes/ano de nomes variados:
```text
"DRE Jan26" -> 2026-01
"DRE Fev/2026" -> 2026-02
"DRE FEV" -> sem ano, tentar inferir do contexto ou NEEDS_REVIEW
"DRE 02-2026" -> 2026-02
"DRE Jan/26" -> 2026-01
```

### Merges em Google Sheets
A API do Google Sheets retorna `merges` no metadata. Para XLSX, SheetJS ja resolve merges automaticamente com a opcao correta. O parser deve propagar o valor da celula superior para todas as celulas do merge.

### Compatibilidade com parser DEFAULT
O parser DEFAULT continua funcionando para abas DRE com formato "multiplas colunas de meses". A deteccao ocorre ANTES do parsing:
- Se tem "NUCLEO AMBIENTAL" + "NUCLEO PENAL" no cabecalho -> LCF
- Senao -> DEFAULT (fluxo atual, sem nenhuma alteracao)
