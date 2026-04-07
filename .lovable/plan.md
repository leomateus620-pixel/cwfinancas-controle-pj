

## Plano: Previsão Financeira 2026 — Escritório Zimmermann (Orçamento → Forecast + PDF)

### O que será feito

Processar o arquivo XLSX do orçamento base 2025 do Escritório Zimmermann, gerar uma previsão financeira mensal para Jan-Dez 2026 com distribuição realista de receitas e despesas, inserir os dados na tabela `forecast_monthly` do banco de dados para visualização no menu "Previsões Financeiras", e gerar um PDF premium com todas as informações.

### Dados do Orçamento (extraídos do XLSX)

**Despesas anuais: R$ 600.000** (34 itens categorizados)
**Receita anual: R$ 756.000** (sem categorias — serão criadas)
**Resultado líquido: R$ 156.000** (margem ~20,6%)

### Etapa 1 — Script de processamento e inserção

Um script Python que:

1. **Lê o XLSX** e extrai todas as linhas de despesa com área, categoria, subcategoria, valor anual e média mensal
2. **Cria categorias de receita** contextualizadas para escritório contábil:
   - Prestação de Serviços Contábeis (~50%): R$ 378.000
   - Serviços Financeiros e BPO (~25%): R$ 189.000
   - Consultoria Tributária e Fiscal (~12%): R$ 90.720
   - Seguros e Corretagem (~8%): R$ 60.480
   - Serviços Avulsos e Projetos (~5%): R$ 37.800
3. **Distribui mensalmente** com sazonalidade realista:
   - Janeiro: receita reduzida (~85%) — volta de férias
   - Fevereiro-Março: pico por IRPF e obrigações acessórias (~110-115%)
   - Abril-Maio: normalização (~100%)
   - Junho: leve queda (~95%)
   - Julho: menor mês (~88%) — férias de clientes
   - Agosto-Outubro: crescimento (~100-105%)
   - Novembro: alta (~108%) — planejamento tributário
   - Dezembro: 13º, bônus, despesas extras (~112% despesa, ~90% receita)
4. **Gera 12 registros** na tabela `forecast_monthly` com:
   - `receita_real` = receita projetada (como base 2025)
   - `despesa_real` = despesa projetada
   - `saldo_real` = receita - despesa
   - `receita_prev_base/opt/pess` = cenários (base, +10%, -10%)
   - `confidence_score` = 82 (orçamento estruturado)
   - `is_forecast` = true
   - `sheet_id` = NULL (demanda especial)
5. **Insere no banco** via Supabase REST API

### Etapa 2 — Verificação no menu

Confirmar que o menu "Previsões Financeiras" exibe corretamente os 12 meses com KPIs, gráfico, fluxo de caixa e insights.

### Etapa 3 — Geração do PDF Premium

PDF com reportlab contendo:

1. **Capa**: "Previsão Financeira 2026 — Escritório Contábil Zimmermann"
2. **Resumo Executivo**: KPIs principais (receita total, despesa total, saldo, margem, confiança)
3. **Gráfico de Projeção**: Receita vs Despesa vs Saldo por mês (matplotlib → imagem)
4. **Fluxo de Caixa Projetado**: Tabela mensal com entradas, saídas, saldo e acumulado
5. **Breakdown de Despesas**: Por área/categoria com % do orçamento
6. **Breakdown de Receitas**: Por categoria criada
7. **Cenários**: Base, Otimista e Pessimista com comparação
8. **Insights**: Sazonalidade, riscos e recomendações

### Arquivos impactados

| Ação | Arquivo |
|------|---------|
| Script temporário | `/tmp/zimmermann_forecast.py` (processamento + inserção) |
| Script temporário | `/tmp/zimmermann_pdf.py` (geração do PDF) |
| Output | `/mnt/documents/Previsao_Financeira_2026_Zimmermann.pdf` |
| Inserção no banco | `forecast_monthly` (12 registros para 2026) |

### Escopo restrito
- Zero alteração em código do app (páginas, hooks, componentes)
- Zero novas tabelas ou migrações
- Usa a tabela `forecast_monthly` existente
- Dados inseridos com `sheet_id = NULL` (consistente com o hook existente)
- O menu "Previsões Financeiras" já lê esses dados automaticamente

