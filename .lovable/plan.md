

## Plano: Social Preview Premium + Animação de Entrada

### 1. Atualizar Open Graph Metadata (`index.html`)
- Substituir todas as meta tags OG e Twitter por conteúdo CW Finanças
- Adicionar `og:url`, melhorar título/descrição, apontar imagem para `/social-preview.png`
- Remover referências a `@Lovable` e `lovable.dev`

### 2. Gerar Social Preview Image (`public/social-preview.png`)
- Usar a Edge Function com o modelo de geração de imagem (google/gemini-3.1-flash-image-preview) para criar uma imagem 1200x630px estilo fintech premium
- Visual: fundo escuro com gradientes, mini dashboard com KPIs (Receita, Despesas, Lucro), gráfico ascendente, logo CW Finanças
- Salvar como PNG em `public/social-preview.png` (< 300kb)
- **Nota**: GIF animado não é suportado pela maioria das plataformas sociais para OG preview; PNG estático é o padrão correto

### 3. Criar componente `FinanceIntroAnimation.tsx`
- Animação CSS pura (sem dependências extras) de ~1.2s
- Sequência: ícone de moeda entra → valor sobe → gráfico cresce → fade out para dashboard
- Usa `sessionStorage` para executar apenas na primeira visita da sessão
- Renderizado condicionalmente no `main.tsx` ou `App.tsx` antes do conteúdo principal

### 4. Integrar no `App.tsx`
- Importar `FinanceIntroAnimation` com lazy loading
- Estado `showIntro` controlado por `sessionStorage.getItem('cwf-intro-seen')`
- Após animação completar, setar flag e renderizar app normalmente
- Nenhum bloqueio de carregamento — animação é overlay que desaparece

### Arquivos
- **Modificados**: `index.html`, `src/App.tsx`
- **Criados**: `src/components/FinanceIntroAnimation.tsx`, `public/social-preview.png`

