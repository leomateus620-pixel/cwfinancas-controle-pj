

# Correcao: Saudacao deve usar nome da planilha conectada

## Problema

Atualmente, a saudacao na Home usa `profile.company_name` (valor fixo do perfil: "CW Financas"). O correto e usar o nome extraido da planilha conectada -- por exemplo, "Financeiro LCF 2026.xlsx" deve resultar em "Bom dia, LCF!".

## Solucao

Modificar o hook `useHomeDashboard.ts` para extrair o nome da empresa a partir do `spreadsheet_name` da conexao ativa (campo ja disponivel via `useSyncStatus`).

### Logica de extracao do nome

A partir de `spreadsheet_name` (ex: "Financeiro LCF 2026.xlsx"):
1. Remover extensao (.xlsx, .xls)
2. Remover prefixo "Financeiro" (case-insensitive)
3. Remover sufixo de ano (4 digitos)
4. Trim do resultado
5. Se sobrar vazio, usar `profile.company_name` como fallback
6. Se nao houver conexao, usar `profile.company_name` como fallback

Exemplos:
- "Financeiro LCF 2026.xlsx" -> "LCF"
- "Financeiro GR - 2026.xlsx" -> "GR"
- "Planilha ABC.xlsx" -> "Planilha ABC"
- Sem conexao -> usa `profile.company_name` -> "CW Financas"

## Arquivo modificado

| Arquivo | Acao |
|---|---|
| `src/hooks/useHomeDashboard.ts` | Adicionar funcao `extractCompanyFromSheet()` e usar como fonte primaria do `companyName` |

## Detalhe tecnico

Na linha 253 de `useHomeDashboard.ts`, trocar:

```text
companyName: profile?.company_name || "Sua Empresa"
```

Por:

```text
companyName: extractCompanyFromSheet(connections?.[0]?.spreadsheet_name)
             || profile?.company_name
             || "Sua Empresa"
```

A funcao `extractCompanyFromSheet` sera adicionada no mesmo arquivo:

```text
function extractCompanyFromSheet(name?: string): string | null {
  if (!name) return null;
  let clean = name.replace(/\.(xlsx?|csv)$/i, "");
  clean = clean.replace(/^financeiro\s*/i, "");
  clean = clean.replace(/\s*[-–]\s*\d{4}\s*$/, "");
  clean = clean.replace(/\s+\d{4}\s*$/, "");
  clean = clean.trim();
  return clean || null;
}
```

Isso se aplica automaticamente para qualquer conta conectada -- ao trocar de planilha, o nome muda junto.

