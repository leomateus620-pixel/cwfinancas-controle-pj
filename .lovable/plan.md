

## Plano: Trocar descrição do card "DRE Inteligente"

### Problema
O card atual exibe nomes técnicos de modelos internos ("LCF, Standard e Matricial") que não são informações relevantes para o público da landing.

### Solução
**Arquivo:** `src/pages/LandingPage.tsx` (linhas 42-46)

Atualizar o conteúdo do card removendo os nomes dos modelos:

- **Título:** `DRE Inteligente` (mantido)
- **Nova descrição:** `Resultado financeiro consolidado com validação automática e visão por núcleo de negócio`

A nova descrição comunica o **valor** (resultado consolidado, validação automática, segmentação por núcleo) em vez de expor a nomenclatura interna dos parsers.

### Resultado esperado
Card da DRE na landing apresenta benefícios claros ao usuário, sem expor jargão técnico interno.

| Ação | Arquivo |
|------|---------|
| Editar | `src/pages/LandingPage.tsx` |

