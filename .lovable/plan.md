
# Plano de Correção: Integração Google Sheets 100% Funcional

## Problemas Identificados

### 1. Problema Principal: Headers CORS Incompletos
O erro `Failed to fetch` indica que as requisições estão sendo bloqueadas por CORS. Os headers atuais não incluem todos os headers que o cliente Supabase envia:

Atual:
```
"authorization, x-client-info, apikey, content-type"
```

Faltando:
```
"x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version"
```

### 2. Problema no Hook `getAuthUrl`
A função `getAuthUrl` no hook está fazendo uma chamada POST desnecessária primeiro com `supabase.functions.invoke()` e depois tenta fazer um fetch direto que falha por não ter os headers adequados.

### 3. Problema na Resposta OPTIONS
A resposta do preflight OPTIONS deve retornar `'ok'` como body, não `null`.

---

## Correções Necessárias

### Fase 1: Corrigir Headers CORS em Todas as Edge Functions

Atualizar os `corsHeaders` em todas as 3 edge functions:

```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": 
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
```

Arquivos afetados:
- `supabase/functions/google-sheets-auth/index.ts`
- `supabase/functions/google-sheets-list/index.ts`
- `supabase/functions/google-sheets-sync/index.ts`

### Fase 2: Corrigir Resposta OPTIONS

Em todas as edge functions, atualizar:

```typescript
if (req.method === "OPTIONS") {
  return new Response("ok", { headers: corsHeaders });
}
```

### Fase 3: Corrigir Hook `useGoogleSheets.ts`

A função `getAuthUrl` está com problemas. Corrigir para usar apenas `supabase.functions.invoke()` com os parâmetros corretos via query string:

```typescript
const getAuthUrl = useCallback(async () => {
  const redirectUri = `${window.location.origin}/google-sheets`;
  
  // Usar supabase.functions.invoke corretamente
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-sheets-auth?action=auth-url&redirect_uri=${encodeURIComponent(redirectUri)}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
    }
  );
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to get auth URL");
  }
  
  const result = await response.json();
  return result.auth_url;
}, []);
```

### Fase 4: Adicionar Tratamento de Erros Melhorado

Na página `GoogleSheetsPage.tsx`, adicionar toast de erro quando falhar:

```typescript
const handleConnect = async () => {
  setIsConnecting(true);
  try {
    const authUrl = await getAuthUrl();
    window.location.href = authUrl;
  } catch (error) {
    console.error("Failed to get auth URL:", error);
    toast({
      title: "Erro ao conectar",
      description: error instanceof Error ? error.message : "Não foi possível iniciar a conexão",
      variant: "destructive",
    });
    setIsConnecting(false);
  }
};
```

---

## Fase 5: Garantir Singularidade de Dados

### 5.1 Invalidar Queries Após Sincronização

Quando uma sincronização é concluída, garantir que todas as queries relacionadas sejam invalidadas para atualizar os dashboards:

```typescript
// No syncData.onSuccess
onSuccess: (data) => {
  // Invalidar todas as queries de dados
  queryClient.invalidateQueries({ queryKey: ["google-sheet-connections"] });
  queryClient.invalidateQueries({ queryKey: ["transactions"] });
  queryClient.invalidateQueries({ queryKey: ["invoices"] });
  queryClient.invalidateQueries({ queryKey: ["balance-sheet"] });
  // ...
};
```

### 5.2 Atualizar Dashboards para Usar Dados Reais

Os gráficos e KPIs do dashboard devem consumir os dados das transações importadas:

| Componente | Fonte de Dados |
|------------|----------------|
| KPIGrid | Hook useTransactions (totais) |
| RevenueChart | Hook useTransactions (agrupado por mês) |
| ExpenseChart | Hook useTransactions (filtrado por categoria) |
| ProfitDistributionChart | Hook useTransactions (agrupado por categoria) |
| RecentTransactions | Hook useTransactions (últimas 5) |

---

## Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/google-sheets-auth/index.ts` | Corrigir CORS headers e resposta OPTIONS |
| `supabase/functions/google-sheets-list/index.ts` | Corrigir CORS headers e resposta OPTIONS |
| `supabase/functions/google-sheets-sync/index.ts` | Corrigir CORS headers e resposta OPTIONS |
| `src/hooks/useGoogleSheets.ts` | Corrigir função getAuthUrl e invalidar queries |
| `src/pages/GoogleSheetsPage.tsx` | Adicionar toast de erro |
| `src/components/dashboard/KPIGrid.tsx` | Conectar a dados reais |
| `src/components/dashboard/RevenueChart.tsx` | Conectar a dados reais |
| `src/components/dashboard/ExpenseChart.tsx` | Conectar a dados reais |
| `src/components/dashboard/ProfitDistributionChart.tsx` | Conectar a dados reais |
| `src/components/dashboard/RecentTransactions.tsx` | Conectar a dados reais |

---

## Resultado Esperado

1. Botão "Conectar Planilha" funcionando corretamente
2. Fluxo OAuth completo com Google
3. Seleção de planilha e aba
4. Importação automática de transações
5. Dashboards e gráficos atualizados com dados reais
6. Singularidade entre dados da planilha e dados do app
7. Sincronização manual funcionando
8. Tratamento de erros com feedback visual
