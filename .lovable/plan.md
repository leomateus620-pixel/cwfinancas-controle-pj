

## Plano: Correção do parser PDF + OCR automático + Redesign Liquid Glass Premium

### Diagnóstico do erro

**Causa raiz confirmada**: A biblioteca `pdf-parse@1.1.1` importada via `esm.sh` usa internamente `Deno.readFileSync` (confirmado nos logs da edge function), que é incompatível com o runtime async do Deno Edge Functions e causa crash silencioso, resultando no erro 422 "Não foi possível ler o PDF".

### O que será feito

#### 1. Substituir engine de leitura de PDF (Edge Function)

Trocar `pdf-parse` por `unpdf` (biblioteca serverless-first, compatível com Deno):

```typescript
import { extractText, getDocumentProxy } from "https://esm.sh/unpdf@0.12.1";

const pdf = await getDocumentProxy(new Uint8Array(buffer));
const { text } = await extractText(pdf, { mergePages: true });
```

Se `unpdf` também falhar no esm.sh, usar o fallback `npm:pdf-parse/lib/pdf-parse.js` (importação Deno nativa).

#### 2. OCR automático para PDFs escaneados

Quando o texto extraído for insuficiente (< 100 caracteres úteis), fazer fallback para OCR via Lovable AI (Gemini 2.5 Flash com capacidade multimodal):

- Converter o PDF para base64
- Enviar ao Lovable AI Gateway com prompt estruturado para extração de transações
- Parsear a resposta JSON estruturada com as transações

```typescript
// Fallback OCR via Lovable AI
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
  method: "POST",
  headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "google/gemini-2.5-flash",
    messages: [{
      role: "user",
      content: [
        { type: "text", text: "Extraia todas as transações deste extrato PDF..." },
        { type: "image_url", image_url: { url: `data:application/pdf;base64,${base64Pdf}` } }
      ]
    }],
  }),
});
```

#### 3. Redesign completo da página — Liquid Glass Premium

O design atual usa inline styles com fundo escuro (`rgba(15,23,42,...)`) que não combina com o design system do projeto (light liquid glass). Será reescrito para usar as classes CSS existentes do projeto:

**Header**: Usar `liquid-glass-caixa` com ícone em cápsula translúcida, padrão das outras páginas (ex: ForecastsPage).

**Upload Zone**: `liquid-glass` com `border-2 border-dashed`, animação de drag-and-drop suave, ícone centralizado em cápsula `bg-primary/10`.

**Lista de arquivos**: Cards `liquid-glass-compact` com badges coloridos para tipo (bancário=emerald, cartão=violet, desconhecido=amber) e status (processando=amber, concluído=emerald, erro=red).

**Pré-visualização**: Container `liquid-glass-caixa` com tabela estilizada usando `bg-muted/20` nos headers, cores de texto `text-foreground` padrão.

**Exportação**: Botões com estilo consistente do projeto (`Button` padrão + variante outline).

**Orbes decorativos**: Adicionar orbes translúcidos no fundo da página (padrão usado em AccountsPage, DREPage) dentro de container `absolute pointer-events-none`.

#### 4. Melhorias funcionais

- Carregar uploads anteriores do banco ao montar a página (SELECT de `pdf_statement_uploads` + `pdf_parsed_transactions`)
- Seleção manual do tipo antes do upload (botão "Bancário" / "Cartão" no card de erro ou no card "unknown")
- Mensagens de erro mais claras e específicas
- Indicador visual de progresso durante OCR ("Processando com OCR inteligente...")

### Arquivos a criar/editar

| Ação | Arquivo |
|------|---------|
| Reescrever | `supabase/functions/parse-pdf-statement/index.ts` (unpdf + OCR fallback) |
| Reescrever | `src/pages/StatementConverterPage.tsx` (liquid glass + carregar histórico) |

### Escopo restrito
- 2 arquivos
- Sem novas tabelas ou migrações
- Sem alterações em rota ou sidebar (já existem)

