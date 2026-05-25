## Ajustes finais no PDF do TCC

Vou regerar `Viabilidade_Economica_Pesque-Pague_Santa_Rosa_RS.pdf` (mantendo o arquivo anterior como `_v1` para comparação) corrigindo os 5 pontos apontados.

### 1. Tabela 3 — Fluxo de caixa projetado
- Colocar essa página específica em **paisagem (A4 landscape)** usando `NextPageTemplate`/`PageTemplate` do reportlab, com margens ABNT adaptadas (2 cm topo/base, 3 cm laterais).
- Cabeçalhos em **duas linhas** com quebra explícita (`Fluxo\nlíquido`, `Fluxo\ndescontado`, `Acumulado\nsimples`, `Acumulado\ndescontado`) para nunca colarem.
- Coluna “Ano” estreita; demais colunas com largura uniforme; alinhamento à direita nos valores; zebra discreta (cinza 5%) nas linhas pares.
- Voltar para retrato logo após a tabela.

### 2. Gráfico 5 — Payback por cenário
- Remover a barra zero do cenário pessimista.
- Plotar apenas duas barras (Realista e Otimista) com os pares Simples × Descontado.
- Adicionar **nota abaixo do eixo X** (texto centralizado, fonte 9): *"No cenário pessimista, o investimento não é recuperado em 10 anos."*
- Sem rótulo "Não recupera" sobreposto.

### 3. Gráfico 6 — Receita / Custos / Fluxo
- Fonte dos rótulos das barras: 8 pt, cinza escuro, posicionados logo acima da barra (offset 2 pt).
- Aumentar o espaçamento entre os grupos "Ano 1" e "Anos 2–10" (`width=0.22`, gap maior entre grupos).
- Eixo Y com grid pontilhado claro; legenda compacta no topo.

### 4. Padronização das fontes
- Substituir todas as ocorrências de `Fonte: TCC (2026).` por:
  `Fonte: Elaborado pelo autor com base nos itens 4.1, 4.2, 4.3 e 4.6 (2025).`
- Aplicar a mesma string em todos os 6 gráficos e nas tabelas; ano **2025** (padronizado).

### 5. Quebra de página — gráfico + fonte + explicação juntos
- Envolver cada bloco (título do gráfico, imagem, linha de fonte, parágrafo explicativo) em `KeepTogether`, **mas com a imagem já dimensionada em largura fixa** (15 cm em retrato, 24 cm na página landscape) — assim não repete o bug anterior de encolher para 5 mm.
- Definir `Image(..., width=15*cm, height=...)` calculando altura a partir da proporção real do PNG salvo pelo matplotlib, evitando que o KeepTogether force redimensionamento.
- Se o bloco não couber, ele migra inteiro para a próxima página (comportamento desejado pela banca).

### Detalhes técnicos

- `gen.py` revisado: função `make_block(title, img_path, caption, paragraph)` retornando `KeepTogether([...])` com imagem em tamanho real medido por PIL.
- `BaseDocTemplate` com dois `PageTemplate`: `portrait` (padrão) e `landscape` (somente para a página da Tabela 3), alternados via `NextPageTemplate`.
- Constante `FONTE_PADRAO = "Fonte: Elaborado pelo autor com base nos itens 4.1, 4.2, 4.3 e 4.6 (2025)."`.
- Gráfico 5: recriar dados como `cenarios = [("Realista", 3.06, 4.15), ("Otimista", 1.58, 1.98)]` e `fig.text(0.5, 0.02, nota, ha='center', fontsize=9, style='italic')`.
- Gráfico 6: `bar(..., width=0.22)`, `ax.bar_label(..., fontsize=8, padding=2, fmt=brl)`, grupos separados por gap visual maior.
- QA obrigatório: rodar `pdftoppm -jpeg -r 150` e revisar **todas** as páginas (retrato e landscape) verificando colunas da tabela, ausência de "Não recupera", fonte padronizada, e que cada gráfico está na mesma página da sua explicação. Iterar até passar limpo.
- Entrega: novo `Viabilidade_Economica_Pesque-Pague_Santa_Rosa_RS_v2.pdf` via `<presentation-artifact>`.
