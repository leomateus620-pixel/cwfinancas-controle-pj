

## Plan: Corrigir dados desatualizados em Contas a Pagar/Receber

### Problema raiz

Existem **440 registros órfãos** na tabela `accounts_payable_receivable` com `connection_id = NULL`. Esses registros vieram de uma planilha antiga que foi desconectada, mas **não foram limpos** porque:

1. A função `reset-sheet-data` usa `eq("connection_id", connectionId)` para deletar, o que **não captura registros com `connection_id = NULL`**
2. O hook `usePayableReceivable` **não filtra por `connection_id`** — busca tudo do usuário, misturando dados antigos (NULL) com novos (connection atual)

Além disso, a sincronização está retornando `no_changes` (fingerprint do Drive não mudou), o que é correto — mas os dados antigos continuam aparecendo por conta da falta de filtro.

### Solução (2 frentes)

#### 1. Limpar registros órfãos via migration de dados
Deletar os 440 registros com `connection_id IS NULL` do usuário afetado. Isso resolve o problema imediato.

#### 2. Filtrar por conexão ativa no hook `usePayableReceivable`
Modificar o hook para buscar apenas registros da **conexão mais recente**, garantindo que dados de conexões antigas nunca apareçam.

#### 3. Fortalecer o reset para capturar registros órfãos
Na função `reset-sheet-data`, quando `connectionId` é fornecido mas o scope é `ALL`, também deletar registros com `connection_id IS NULL` do mesmo usuário, limpando qualquer resíduo.

### Arquivos a modificar

| Arquivo | Escopo |
|---------|--------|
| `src/hooks/usePayableReceivable.ts` | Receber `connectionId` como parâmetro e filtrar por ele na query |
| `src/pages/AccountsPage.tsx` | Passar o `connectionId` da conexão mais recente para o hook |
| `supabase/functions/reset-sheet-data/index.ts` | Adicionar limpeza de registros com `connection_id IS NULL` no reset por conexão |

### Mudanças detalhadas

**`src/hooks/usePayableReceivable.ts`**:
- Adicionar parâmetro opcional `connectionId?: string`
- Quando fornecido, adicionar `.eq("connection_id", connectionId)` nas queries de payable e receivable
- Incluir `connectionId` nas queryKeys para cache correto

**`src/pages/AccountsPage.tsx`**:
- Obter `connections` do `useGoogleSheets()`
- Passar `connections[0]?.id` como `connectionId` para `usePayableReceivable`

**`supabase/functions/reset-sheet-data/index.ts`**:
- No bloco de delete de `accounts_payable_receivable` quando `connectionId` é fornecido, adicionar um segundo delete para registros com `connection_id IS NULL` do mesmo usuário
- Mesma lógica para `bank_balances`

### Limpeza imediata
Executar delete dos registros órfãos existentes via ferramenta de insert/delete para resolver o problema atual sem esperar uma nova desconexão.

### O que NÃO muda
- Pipeline de sincronização (`sheets-sync-all-tabs`)
- Lógica de fingerprint/cache
- Outros menus (DRE, Dashboard, etc.)
- Visual dos cards de Contas a Pagar/Receber

