
## Exportar os 6 gráficos em PNG de alta qualidade

Já existe `/tmp/gen_v3.py` que gera os 6 gráficos (1 em 2D + 5 com faux-3D leve). Vou reaproveitá-lo, ajustando apenas a saída para gerar PNGs individuais "stand-alone" (título acima + gráfico + fonte abaixo, sem o texto explicativo do PDF), em 300 dpi e fundo branco sólido.

### O que vou fazer

1. Criar `/tmp/export_pngs.py` que importa as funções de plotagem do `gen_v3.py` e, para cada gráfico, monta uma figura `Matplotlib` única contendo:
   - título centralizado acima (Times New Roman, 12 pt)
   - o gráfico (faux-3D leve ou 2D, exatamente como na v3 do PDF)
   - linha de fonte abaixo, centralizada, Times New Roman 10 pt cinza escuro
   - fundo branco sólido (`facecolor="white"`), sem transparência

2. Exportar cada PNG em 300 dpi e dimensões alvo ≈ 1800 × 1200 px (`figsize=(6, 4)` a 300 dpi) usando `bbox_inches="tight"` e `pad_inches=0.25`. Sem botões, sem chrome.

3. Nomes dos arquivos (em `/mnt/documents/graficos_pesque_pague/`):
   - `grafico_1_fluxo_caixa_projetado_acumulado.png`
   - `grafico_2_payback_simples_descontado_3d.png`
   - `grafico_3_vpl_cenarios_3d.png`
   - `grafico_4_tir_cenarios_tma_3d.png`
   - `grafico_5_payback_cenarios_3d.png`
   - `grafico_6_receitas_custos_fluxo_liquido_3d.png`

4. Empacotar em `/mnt/documents/graficos_viabilidade_economica_pesque_pague_png.zip` contendo os 6 PNGs.

5. QA: abrir cada PNG e verificar título legível, rótulos sem corte/sobreposição, linha TMA visível no G4, linha y=0 visível no G3, nota italicizada no G5, fundo branco, sem chrome. Iterar se necessário.

### Entrega

- 6 arquivos PNG individuais (artifacts separados)
- 1 ZIP contendo os 6 PNGs (artifact único)

Observação: este é um task de geração de artefatos (sem UI). O "botão de download" do prompt é atendido pelos próprios artifacts entregues no chat — não precisa de página web no app.
