## Gerar PDF acadêmico — Viabilidade econômica do pesque-pague

Pretendo entregar um arquivo PDF final (não uma página do app) salvo em `Viabilidade_Economica_Pesque-Pague_Santa_Rosa_RS.pdf`, pronto para usar no capítulo de resultados do TCC.

### Estrutura do documento (A4, Times Roman/Bold, ABNT-friendly)

1. Título e subtítulo centralizados
2. **1. Contexto acadêmico e origem dos dados** — vincula os cálculos ao OE1 (item 1.2.2) e aos itens 2.2.4 / 2.2.5, e cita as fontes 4.1, 4.2, 4.3 e 4.6 com os valores consolidados do TCC
3. **2. Premissas** — Tabela 1 com horizonte 10 anos, TMA 10%, investimento R$ 98.464,90, receitas (R$ 113.625,35 / R$ 72.438,68), custos (R$ 11.060,45 + R$ 42.672,00 = R$ 53.732,45) e depreciação R$ 9.305,44 informativa
4. **3. Fórmulas** — FC anual, acumulado, VPL, TIR (bissecção), payback simples e descontado
5. **4. Síntese realista** — Tabela 2 com VPL R$ 53.919,21, TIR 25,56%, PS 3,06 anos, PD 4,15 anos
6. **5. Cenários** — descrição dos multiplicadores e aviso de que otimista/pessimista são sensibilidade
7. **6. Gráficos 1 a 6** — cada um com título acima centralizado, imagem centralizada, fonte abaixo (tamanho 10) e parágrafo explicativo curto:
   - G1 Fluxo realista (barras + linha acumulada + marcação de payback)
   - G2 Payback simples × descontado realista
   - G3 VPL por cenário
   - G4 TIR por cenário vs. linha TMA
   - G5 Payback por cenário (com “Não recupera” no pessimista)
   - G6 Receita / Custos / Fluxo (Ano 1 vs. recorrente)
8. **7. Tabela 3** — Fluxo de caixa projetado 10 anos com colunas Ano, Receita, Custos, FC líquido, FC descontado, Acumulado, Acumulado descontado, sem linhas verticais
9. **8. Texto sugerido para inserção no TCC**
10. **9. Observação metodológica final**

### Detalhes técnicos

- Cálculos em Python puro: VPL por fórmula direta, TIR por bissecção, payback com interpolação linear. Já validei: pessimista VPL −R$ 51.479,07 / TIR −13,17% / não recupera; realista R$ 53.919,21 / 25,56% / 3,06 / 4,15; otimista R$ 142.809,36 / 47,61% / 1,58 / 1,98 — batem com os valores esperados.
- Gráficos com matplotlib em paleta sóbria (azul #1f4e79, verde #2e7d32, vermelho #b71c1c, cinza #2b2b2b, grid #dddddd, fundo branco), sem visual de dashboard, eixos em R$ no padrão pt-BR e percentuais com vírgula.
- Diagramação com reportlab: A4, margens ABNT (3/2/3/2 cm), tabelas com apenas linhas horizontais, valores `R$ 98.464,90`, `25,56%`, `3,06 anos`.

### Correções pendentes detectadas no QA visual da primeira rodada

- O `KeepTogether` que eu havia usado para amarrar cada bloco "título + gráfico + fonte + explicação" estava reduzindo as imagens para ~5 mm e empilhando as colunas das tabelas. Vou removê-lo e usar flowables soltos (cada bloco volta a ocupar o espaço correto).
- Após corrigir, vou rodar pdftoppm e revisar todas as páginas, verificando colunas das tabelas, tamanho real dos gráficos, sobreposições e quebras de página.

### Entrega final

Vou anexar o PDF na mensagem com `<presentation-artifact>` para download direto.