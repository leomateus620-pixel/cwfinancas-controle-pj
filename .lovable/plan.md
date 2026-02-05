

## Objetivo
Corrigir **definitivamente** a integração Google Sheets eliminando:
1. O erro React #185 que causa tela de erro/branca
2. Chamadas duplicadas excessivas ao backend
3. Falha na listagem de planilhas
4. Adicionar funcionalidade de desconexão do Google

---

## Diagnóstico da Causa Raiz

### Problema 1: React Error #185
O erro "Objects are not valid as a React child" ocorre quando se tenta renderizar um objeto JavaScript diretamente como texto no JSX. Locais problemáticos identificados:

- `GoogleSheetsErrorBoundary.tsx:65` - Renderiza `{error.message}` mas o erro pode ser um objeto complexo `FunctionsHttpError` do Supabase
- O componente usa `error` que vem do ErrorBoundary que pode capturar qualquer tipo de erro (não apenas Error com .message)

### Problema 2: Chamadas Duplicadas
Os logs mostram 50+ chamadas simultâneas para `google-list-sheets`. Isso acontece porque:
- O `useEffect` no modal dispara `onLoadSpreadsheets()` sem controle de debounce
- React StrictMode pode causar dupla execução de effects
- A dependência `spreadsheets` no array de dependências pode causar loops

### Problema 3: Falta Opção de Desconexão
Atualmente não existe um botão ou funcionalidade para desconectar a conta Google e começar do zero.

---

## Solução Proposta

### Parte A: Corrigir Error Boundary (eliminar Error #185)

**Arquivo: `src/components/error/GoogleSheetsErrorBoundary.tsx`**

1. Garantir que `error.message` seja sempre uma string:
```tsx
// Linha 65 - ANTES:
{error.message}

// DEPOIS:
{typeof error?.message === 'string' 
  ? error.message 
  : JSON.stringify(error, null, 2)}
```

2. Adicionar tratamento seguro para diferentes tipos de erro:
```tsx
const getErrorMessage = (error: Error | null): string => {
  if (!error) return "Erro desconhecido";
  if (typeof error.message === 'string') return error.message;
  if (typeof error === 'string') return error;
  return "Ocorreu um erro inesperado";
};
```

### Parte B: Corrigir Chamadas Duplicadas

**Arquivo: `src/components/modals/SpreadsheetSelectorModal.tsx`**

1. Adicionar flag para evitar múltiplas chamadas:
```tsx
const [hasLoadedSpreadsheets, setHasLoadedSpreadsheets] = useState(false);

useEffect(() => {
  if (open && step === "spreadsheets" && !spreadsheets && !hasLoadedSpreadsheets) {
    setHasLoadedSpreadsheets(true);
    onLoadSpreadsheets();
  }
}, [open, step, spreadsheets, hasLoadedSpreadsheets, onLoadSpreadsheets]);

// Reset ao fechar:
useEffect(() => {
  if (!open) {
    setHasLoadedSpreadsheets(false);
    // ... resto do reset
  }
}, [open]);
```

### Parte C: Adicionar Funcionalidade de Desconexão

**Arquivo: `src/hooks/useGoogleSheets.ts`**

Adicionar mutation para desconectar:
```tsx
const disconnectGoogle = useMutation({
  mutationFn: async () => {
    if (!session?.user?.id) throw new Error("Not authenticated");
    
    // Deletar tokens OAuth
    const { error: tokenError } = await supabase
      .from("google_oauth_tokens")
      .delete()
      .eq("user_id", session.user.id);
    
    if (tokenError) throw tokenError;
    
    // Deletar conexões de planilhas
    const { error: connError } = await supabase
      .from("google_sheet_connections")
      .delete()
      .eq("user_id", session.user.id);
    
    if (connError) throw connError;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["google-oauth-status"] });
    queryClient.invalidateQueries({ queryKey: ["google-sheet-connections"] });
    toast({
      title: "Desconectado",
      description: "Sua conta Google foi desconectada com sucesso.",
    });
  },
  onError: (error) => {
    toast({
      title: "Erro ao desconectar",
      description: error instanceof Error ? error.message : "Erro desconhecido",
      variant: "destructive",
    });
  },
});
```

**Arquivo: `src/pages/GoogleSheetsPage.tsx`**

Adicionar botão de desconexão na UI conectada:
```tsx
<Button 
  variant="outline"
  onClick={() => {
    if (confirm("Tem certeza que deseja desconectar sua conta Google?")) {
      disconnectGoogle.mutate();
    }
  }}
  disabled={disconnectGoogle.isPending}
  className="gap-2"
>
  {disconnectGoogle.isPending ? (
    <Loader2 className="w-4 h-4 animate-spin" />
  ) : (
    <LogOut className="w-4 h-4" />
  )}
  Desconectar Google
</Button>
```

### Parte D: Corrigir Error Boundary para não quebrar com qualquer tipo de erro

**Arquivo: `src/components/error/GoogleSheetsErrorBoundary.tsx`**

Refatorar completamente o componente de UI de erro:
```tsx
function GoogleSheetsErrorUI({ error, onRetry, onReconnect }) {
  const queryClient = useQueryClient();

  // Função segura para extrair mensagem de erro
  const getErrorMessage = (): string => {
    if (!error) return "Ocorreu um erro inesperado";
    
    // Se for uma string direta
    if (typeof error === 'string') return error;
    
    // Se tiver .message como string
    if (error.message && typeof error.message === 'string') {
      return error.message;
    }
    
    // Se tiver .error como string (padrão Supabase)
    if (error.error && typeof error.error === 'string') {
      return error.error;
    }
    
    // Fallback - tentar serializar
    try {
      return JSON.stringify(error);
    } catch {
      return "Erro desconhecido";
    }
  };

  // ...resto do componente usando getErrorMessage()
}
```

### Parte E: Corrigir GlobalErrorHandler para não renderizar objetos

**Arquivo: `src/components/error/GlobalErrorHandler.tsx`**

Garantir que erros sejam strings antes de passar para o toast:
```tsx
const getErrorString = (reason: unknown): string => {
  if (typeof reason === 'string') return reason;
  if (reason instanceof Error) return reason.message;
  try {
    return JSON.stringify(reason);
  } catch {
    return "Erro desconhecido";
  }
};

const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
  console.error("Unhandled promise rejection:", event.reason);
  event.preventDefault();
  
  const errorMessage = getErrorString(event.reason);
  
  toast({
    title: "Erro",
    description: errorMessage,
    variant: "destructive",
  });
};
```

---

## Arquivos a Modificar

1. `src/components/error/GoogleSheetsErrorBoundary.tsx` - Corrigir renderização de erro
2. `src/components/error/GlobalErrorHandler.tsx` - Garantir strings nos toasts
3. `src/components/modals/SpreadsheetSelectorModal.tsx` - Evitar chamadas duplicadas
4. `src/hooks/useGoogleSheets.ts` - Adicionar `disconnectGoogle` mutation
5. `src/pages/GoogleSheetsPage.tsx` - Adicionar botão de desconexão + usar a função

---

## Testes de Validação

1. **Teste Error Boundary**: Forçar um erro e verificar que a UI mostra mensagem legível (não quebra)
2. **Teste Chamadas**: Abrir modal e verificar que apenas 1 chamada é feita para `google-list-sheets`
3. **Teste Listagem**: Confirmar que as 18 planilhas aparecem no modal
4. **Teste Desconexão**: Clicar em "Desconectar Google", confirmar que status volta para "não conectado"
5. **Teste Reconexão**: Após desconectar, clicar em "Conectar Planilha" e fazer o fluxo OAuth completo

---

## Detalhes Técnicos

### Estrutura do Erro Supabase
O `supabase.functions.invoke` retorna `FunctionsHttpError` quando há erro, que tem:
- `name`: "FunctionsHttpError"
- `message`: "Edge Function returned a non-2xx status code"
- `context`: Response object (não serializável diretamente)

Isso explica porque `{error.message}` pode não funcionar corretamente.

### React StrictMode
Em desenvolvimento, React StrictMode executa effects duas vezes. Precisamos de guards para evitar chamadas duplicadas:
```tsx
const calledRef = useRef(false);
useEffect(() => {
  if (calledRef.current) return;
  calledRef.current = true;
  // ... chamada
}, []);
```

