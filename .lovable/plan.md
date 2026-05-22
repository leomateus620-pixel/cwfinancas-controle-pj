## Ajuste do título "para PJ" no desktop

**Problema:** No desktop, o "PJ" quebra para uma nova linha sozinho, ficando abaixo de "para".

**Arquivo:** `src/pages/LandingPage.tsx` (linhas 321-325)

**Mudança:** Envolver "para PJ" em um `<span className="whitespace-nowrap">` para garantir que as duas palavras permaneçam sempre juntas na mesma linha, evitando que "PJ" caia isoladamente. Em viewports muito estreitos, ambas quebrarão juntas para a linha seguinte de forma natural.

```tsx
<h1 ...>
  Gestão Financeira{" "}
  <span className="gradient-text-primary">Inteligente</span>{" "}
  <span className="whitespace-nowrap">para PJ</span>
</h1>
```

Nenhuma outra alteração de layout, tipografia ou espaçamento.