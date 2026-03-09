

## Plano: Atualizar Social Preview com Logo CW PJ

### Abordagem

Criar uma Edge Function que usa o modelo de geração de imagem (`google/gemini-3.1-flash-image-preview`) para gerar um novo `social-preview.png` de 1200x630px com:

- Fundo escuro com gradientes (estilo fintech)
- Logo CW PJ centralizada no topo
- KPIs: Receita +R$ 12.450 | Despesas -R$ 4.120 | Lucro +R$ 8.330
- Mini gráfico ascendente
- Texto "Controle Financeiro Inteligente"

### Alternativa mais simples e confiável

Como a geração de imagem por IA pode não produzir resultado previsível para um preview de compartilhamento social (que precisa ser pixel-perfect), a abordagem mais confiável é:

**Criar o social preview como um componente HTML renderizado em canvas** — ou seja, criar uma Edge Function que gera a imagem programaticamente usando a API de geração de imagem com um prompt muito específico descrevendo o layout desejado, incluindo a logo.

### Mudanças

1. **`supabase/functions/generate-social-preview/index.ts`** — Nova Edge Function que:
   - Lê a logo CW PJ (base64) de um URL público
   - Chama a API de geração de imagem com prompt descritivo + logo como input
   - Retorna a imagem gerada

2. **`public/social-preview.png`** — Substituir pelo resultado gerado

Como a imagem precisa ser estática em `/public`, vou gerar a imagem via Edge Function e salvar o resultado diretamente como arquivo PNG no projeto.

### Execução

- Criar Edge Function `generate-social-preview` que gera a imagem usando `google/gemini-3.1-flash-image-preview` com a logo como input e instrução de edição
- Chamar a função, obter o base64, e salvar como `public/social-preview.png`

