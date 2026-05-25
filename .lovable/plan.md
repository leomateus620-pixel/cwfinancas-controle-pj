
## PDF v3 — Viabilidade Econômica Pesque-Pague (gráficos 3D leves)

Vou regerar o PDF como `Viabilidade_Economica_Pesque-Pague_Santa_Rosa_RS_v3.pdf`, mantendo todos os cálculos validados na v2 (VPL R$ 53.919,21; TIR 25,56%; payback simples 3,06 anos; descontado 4,15 anos) e refazendo a camada visual conforme especificação.

### 1. Estética 3D leve (acadêmica)

Aplicar nos gráficos 2, 3, 4, 5 e 6 (gráfico 1 permanece 2D):

- Barras renderizadas com matplotlib `bar3d` em projeção isométrica suave (elev=18, azim=-55), profundidade pequena (dy ≈ 0.35), sem brilho.
- Sombra discreta usando offset cinza claro (alpha 0.15) projetada atrás de cada barra; faces frontais opacas, topos levemente mais claros para sensação de volume.
- Fundo branco, grid `#E5E5E5` pontilhado fino, painéis laterais transparentes (`ax.xaxis.pane.fill = False`), eixos pretos finos.
- Tipografia: Times New Roman 10 pt nos eixos e legendas, 11 pt nos rótulos das barras, sem negrito agressivo.
- Sem gradientes, sem neon, sem cards.

### 2. Paleta sóbria

- Pessimista / negativo: `#8B1E1E`
- Realista: `#1F3A5F`
- Otimista: `#2F5D3A`
- Fluxo acumulado: `#1A1A1A`
- TMA / linha referência: cinza `#666666` tracejado
- Receita (Gráfico 6): `#1F3A5F` · Custos: `#8B1E1E` · Fluxo líquido: `#2F5D3A`

### 3. Gráficos

| Nº | Tipo | Conteúdo | Observações |
|----|------|----------|-------------|
| 1 | 2D | Fluxo líquido (barras) + acumulado (linha) | Reforçar contraste da linha (2 pt, marker losango no ano de payback simples), linha y=0 sólida cinza |
| 2 | 3D leve | Payback simples × descontado (realista) | 2 barras, eixo Y em "anos", rótulos `3,06 anos` / `4,15 anos` |
| 3 | 3D leve | VPL por cenário | 3 colunas (-51.479,07 / 53.919,21 / 142.809,36), linha y=0 visível, coluna pessimista desce abaixo de zero, rótulo BRL acima/abaixo |
| 4 | 3D leve | TIR por cenário vs TMA | -13,17% / 25,56% / 47,61%; linha tracejada cinza em 10%, rótulos 2 casas decimais, nota lateral indicando atratividade quando TIR > TMA |
| 5 | 3D leve agrupado | Payback por cenário | Só Realista e Otimista (simples × descontado). Nota abaixo: *"No cenário pessimista, o investimento não é recuperado dentro do horizonte de 10 anos."* |
| 6 | 3D leve agrupado | Receita / Custos / Fluxo líquido | Grupos "Ano 1" e "Anos 2 a 10" bem separados (gap maior), rótulos 8 pt acima das barras |

### 4. Padronização de fontes (legendas abaixo dos gráficos)

- G1: `Fonte: Elaborado pelo autor com base nos itens 4.1, 4.2, 4.3 e 4.6 (2026).`
- G2 e G5: `Fonte: Elaborado pelo autor com base nos itens 2.2.4, 4.1, 4.2, 4.3 e 4.6 (2026).`
- G3 e G4: `Fonte: Elaborado pelo autor com base nos itens 2.2.5, 4.1, 4.2, 4.3 e 4.6 (2026).`
- G6: `Fonte: Elaborado pelo autor com base nas Tabelas 1, 2 e 4, no item 4.3 e no item 4.6 (2026).`
- Tabelas: mesma família, ajustada ao conteúdo.
- Ano padronizado em **2026** (atualizando o ano 2025 da v2).

### 5. Layout ABNT/UFFS

- Margens 3/2/3/2 cm (esquerda/direita/topo/base), Times New Roman 12 pt corpo, 11 pt rodapé/fonte de gráfico.
- Cada bloco `KeepTogether([título, imagem 15 cm, fonte, parágrafo explicativo])` para nunca quebrar entre página.
- Imagens dimensionadas com altura calculada via PIL a partir do PNG real (sem o bug de encolhimento).
- Tabela 3 (fluxo de caixa) mantida em **A4 paisagem** com cabeçalho em duas linhas e zebra 5%, como na v2.

### 6. Implementação técnica (`gen.py`)

- Refatorar funções de gráfico para usar `mpl_toolkits.mplot3d` com `bar3d`; helper `draw_bar3d(ax, xs, heights, color, depth=0.35)` que também desenha sombra (`Poly3DCollection` alpha 0.15) atrás de cada barra.
- Renderização em 300 dpi, salvar em `/tmp/charts_v3/*.png`.
- Constantes `FONTE_G1`, `FONTE_G2_5`, `FONTE_G3_4`, `FONTE_G6`, `FONTE_TABELAS`.
- `BaseDocTemplate` reaproveitado da v2 (portrait + landscape via `NextPageTemplate`).
- Conferir TIR pessimista (-13,17%): ajustar bisseção com bracket [-0.95, 0.10] para capturar raiz negativa; logar valor.

### 7. QA obrigatório

- `pdftoppm -jpeg -r 150 .../v3.pdf /tmp/qa_v3/page` e inspeção página a página.
- Checklist: nenhum rótulo cortado, nenhum "Não recupera" sobreposto, linha TMA visível no G4, linha zero do G3 visível, tabela de fluxo legível em paisagem, fontes padronizadas, blocos (gráfico + fonte + parágrafo) sempre juntos.
- Iterar até passar limpo.

### 8. Entrega

- Manter `_v1.pdf` e `_v2.pdf` para comparação.
- Novo arquivo: `Viabilidade_Economica_Pesque-Pague_Santa_Rosa_RS_v3.pdf` em `/mnt/documents/`, entregue via `<presentation-artifact>`.
