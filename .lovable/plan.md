
# Correcao Definitiva: Idempotencia em 2 Camadas com Realinhamento + Auto-Sync

## Diagnostico Confirmado

### Causa raiz da duplicacao
1. **`external_row_key` instavel** (linha 957): `${tab.title}:${rowNumber}:${rowHash}`. O `rowNumber` e absoluto na planilha e muda quando linhas sao inseridas/removidas acima, gerando novas chaves e duplicando tudo.
2. **3 indices unicos conflitantes** sobre as mesmas colunas (2 parciais + 1 sem WHERE). O `.upsert()` do Supabase nao usa indices parciais, causando insercoes duplicadas.
3. **Logica check-then-act** na `batchUpsertTransactions` (linhas 578-651) com race conditions.

### Indices atuais (problematicos)
- `idx_transactions_external_row_key_unique` (PARTIAL WHERE external_row_key IS NOT NULL)
- `idx_transactions_idempotent_key` (PARTIAL WHERE ... AND source_sheet_id IS NOT NULL)
- `idx_transactions_upsert_key` (sem WHERE -- este e o unico valido)

---

## FASE 1: Schema -- Adicionar `stable_key` + `content_hash` + Limpar Indices

### Migracao SQL

```text
-- 1) Adicionar novos campos
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS stable_key text;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS content_hash text;

-- 2) Backfill stable_key a partir de external_row_key para registros existentes
UPDATE transactions
SET stable_key = external_row_key
WHERE external_row_key IS NOT NULL AND stable_key IS NULL;

-- 3) Backfill content_hash a partir dos dados existentes (hash real dos campos)
UPDATE transactions
SET content_hash = md5(
  COALESCE(date::text, '') || '|' ||
  (amount * 100)::bigint::text || '|' ||
  LOWER(TRIM(COALESCE(description, ''))) || '|' ||
  LOWER(TRIM(COALESCE(category, ''))) || '|' ||
  LOWER(TRIM(COALESCE(client_vendor, '')))
)
WHERE content_hash IS NULL AND source_sheet_id IS NOT NULL;

-- 4) Remover indices parciais conflitantes
DROP INDEX IF EXISTS idx_transactions_external_row_key_unique;
DROP INDEX IF EXISTS idx_transactions_idempotent_key;

-- 5) Remover indice antigo sem WHERE
DROP INDEX IF EXISTS idx_transactions_upsert_key;

-- 6) Criar indice unico sobre stable_key (nao-parcial para funcionar com upsert)
CREATE UNIQUE INDEX idx_transactions_stable_key
ON transactions (user_id, source_sheet_id, stable_key)
WHERE stable_key IS NOT NULL AND source_sheet_id IS NOT NULL;

-- NOTA: Este indice e parcial (WHERE) para nao afetar transacoes manuais.
-- O upsert NAO usara onConflict com este indice.
-- A logica de reconciliacao sera feita via SELECT+INSERT/UPDATE explicitamente.

-- 7) Adicionar colunas de fingerprint e lock na connections
ALTER TABLE google_sheet_connections
ADD COLUMN IF NOT EXISTS last_source_fingerprint text,
ADD COLUMN IF NOT EXISTS lock_until timestamptz;
```

### Definicao de stable_key por fonte

| Fonte | stable_key | Exemplo |
|---|---|---|
| Google Sheets | `{tabName}:{headerSig}:{dataRowIndex}` | `Janeiro:a3f2b1:15` |
| Excel Upload | `{sheetName}:{rowIndex}` | `Janeiro:15` |

- `headerSig` = md5 dos nomes das colunas mapeadas, cortado em 6 chars. Garante que se o layout mudar, a chave muda tambem (e regenera profile).
- `dataRowIndex` = posicao relativa ao header detectado (nao absoluta na planilha).

### Definicao de content_hash

```text
content_hash = md5(
  normalize(date) + "|" +
  Math.round(amount * 100) + "|" +
  normalize(description) + "|" +
  normalize(category) + "|" +
  normalize(client_vendor)
).slice(0, 12)
```

Onde `normalize` = trim + lowercase + remover espacos duplicados.

---

## FASE 2: Logica de Reconciliacao com Realinhamento

### Arquivo: `supabase/functions/sheets-sync-all-tabs/index.ts`

Substituir `batchUpsertTransactions` (linhas 578-651) por logica de reconciliacao em 3 passos:

```text
async function reconcileAndUpsert(supabase, batch, userId, connectionId, requestId) {
  // 1. Buscar TODOS os registros existentes desta conexao+tab
  //    (precisamos de stable_key + content_hash + id + date + amount)
  const tabNames = [...new Set(batch.map(b => b.source_tab))];
  const existingMap = new Map();  // stable_key -> { id, content_hash, date, amount }
  const contentIndex = new Map(); // content_hash -> [{ id, stable_key, source_row_number }]

  for (const tabName of tabNames) {
    const { data } = await supabase.from("transactions")
      .select("id, stable_key, content_hash, date, amount, source_row_number")
      .eq("user_id", userId)
      .eq("source_sheet_id", connectionId)
      .eq("source_tab", tabName);

    if (data) {
      for (const row of data) {
        if (row.stable_key) existingMap.set(row.stable_key, row);
        // Build content index for fallback matching
        const key = row.content_hash || "";
        if (!contentIndex.has(key)) contentIndex.set(key, []);
        contentIndex.get(key).push(row);
      }
    }
  }

  // Track which existing records have been matched (to avoid double-matching)
  const matchedIds = new Set();

  let inserted = 0, updated = 0, noOps = 0;
  const errors = [];
  const toInsert = [];
  const toUpdate = [];

  for (const row of batch) {
    // PASSO A: Tentar match por stable_key
    const existing = existingMap.get(row.stable_key);
    if (existing && !matchedIds.has(existing.id)) {
      matchedIds.add(existing.id);
      if (existing.content_hash === row.content_hash) {
        noOps++;  // Conteudo identico -> nao fazer nada
      } else {
        // Conteudo mudou -> UPDATE
        toUpdate.push({ id: existing.id, ...row });
      }
      continue;
    }

    // PASSO B: Fallback -- match por content_hash + date + amount (realinhamento)
    const candidates = contentIndex.get(row.content_hash) || [];
    const unmatched = candidates.filter(c => !matchedIds.has(c.id));

    if (unmatched.length > 0) {
      // Desempate: menor diferenca de rowIndex
      unmatched.sort((a, b) =>
        Math.abs(a.source_row_number - row.source_row_number) -
        Math.abs(b.source_row_number - row.source_row_number)
      );
      const best = unmatched[0];
      matchedIds.add(best.id);

      // UPDATE stable_key para o novo valor (realinhamento)
      toUpdate.push({
        id: best.id,
        ...row,
        stable_key: row.stable_key,  // Atualizar stable_key para nova posicao
      });
      continue;
    }

    // PASSO C: Nenhum match -> INSERT
    toInsert.push(row);
  }

  // Executar INSERTs em batch
  for (const chunk of chunks(toInsert, 50)) {
    const { error } = await supabase.from("transactions").insert(chunk);
    if (error) {
      // Fallback individual
      for (const r of chunk) {
        const { error: e } = await supabase.from("transactions").insert(r);
        if (e) errors.push({ row: r.source_row_number, error: e.message });
        else inserted++;
      }
    } else {
      inserted += chunk.length;
    }
  }

  // Executar UPDATEs individualmente (por id)
  for (const row of toUpdate) {
    const { id, ...data } = row;
    const { error } = await supabase.from("transactions")
      .update(data).eq("id", id);
    if (error) errors.push({ row: data.source_row_number, error: error.message });
    else updated++;
  }

  return { inserted, updated, noOps, errors };
}
```

### Geracao de stable_key e content_hash (substituir linhas 956-957)

```text
// Gerar headerSig uma vez por aba (fora do loop de linhas)
const mappedCols = Object.keys(mapping).sort().join(",");
const headerSig = generateRowHash({ cols: mappedCols }).slice(0, 6);

// Dentro do loop (por linha):
const dataRowIndex = rowIndex; // posicao relativa ao header (0-based)
const stableKey = `${tab.title}:${headerSig}:${dataRowIndex}`;

const contentHash = generateRowHash({
  d: finalDate,
  a: Math.round(amount * 100),
  desc: (description || "").toLowerCase().trim().replace(/\s+/g, " "),
  cat: (category || "").toLowerCase().trim(),
  cv: (clientVendor || "").toLowerCase().trim(),
}).slice(0, 12);
```

Na construcao do `TransactionRow`, adicionar `stable_key` e `content_hash`, e manter `external_row_key = stableKey` para compatibilidade.

### Interface TransactionRow (atualizar)

Adicionar campos:
```text
stable_key: string;
content_hash: string;
```

### Por que isso resolve o problema de "inserir linhas no topo"

Cenario: Tab "Janeiro" tem 100 linhas. Usuario insere 10 linhas no topo.

1. Todas as `dataRowIndex` mudam (+10 offset).
2. Novas `stable_key` sao geradas (ex: `Janeiro:a3f2b1:0` a `Janeiro:a3f2b1:9` para as novas).
3. Para as 100 linhas originais, a stable_key mudou (ex: `Janeiro:a3f2b1:5` virou `Janeiro:a3f2b1:15`).
4. O PASSO A nao encontra match pela nova stable_key.
5. O PASSO B encontra match pelo content_hash (o conteudo nao mudou). Desempata por proximidade de rowIndex.
6. O registro existente recebe UPDATE do stable_key para o novo valor. Nenhuma duplicacao.
7. As 10 linhas novas nao tem match -> INSERT.
8. Resultado: 10 inserts, 100 updates (ou noOps se content_hash identico), 0 duplicacoes.

### Duplicatas identicas (duas linhas com mesmo conteudo)

Se existem 2 linhas com conteudo identico no "antes" e 2 no "depois":
- Cada uma tem stable_key diferente (dataRowIndex diferente).
- Se stable_key nao bater, o fallback por content_hash encontra 2 candidatos nao-matched.
- O desempate por proximidade de rowIndex garante matching 1:1 deterministico.
- Nunca transforma 2 em 1.

---

## FASE 3: Fingerprint por Aba (Evitar Reprocessamento)

### Logica no edge function

Antes de processar cada aba, calcular fingerprint leve:

```text
function computeTabFingerprint(rows, headerRow) {
  const header = (rows[headerRow] || []).map(c => safeStr(c)).join("|");
  const sampleRows = rows.slice(headerRow + 1, headerRow + 51);
  const sample = sampleRows.map(r =>
    r.slice(0, 5).map(c => safeStr(c).trim().substring(0, 20)).join("|")
  ).join("\n");
  return generateRowHash({ header, sample });
}
```

Comparar com ultimo `sync_tab_audit` da mesma aba:
- Se fingerprint igual -> skip tab (NO-OP total)
- Se diferente -> processar normalmente

Adicionalmente, como primeiro check rapido antes de processar qualquer aba:
- Google Sheets: obter `modifiedTime` do Drive e comparar com `last_source_fingerprint` na connection
- Se nao mudou: retornar NO-OP imediatamente (nenhuma aba processada)
- Se mudou: processar abas normalmente com fingerprint por aba

Para Excel: usar hash sha256 do arquivo (storage metadata). Se nao mudou, NO-OP.

---

## FASE 4: Lock de Concorrencia

No inicio do sync:

```text
const { data: lockResult } = await supabase
  .from("google_sheet_connections")
  .update({
    lock_until: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    sync_status: "syncing"
  })
  .eq("id", connectionId)
  .or("lock_until.is.null,lock_until.lt." + new Date().toISOString())
  .select("id");

if (!lockResult || lockResult.length === 0) {
  return { error: "sync_locked", status: 423 };
}
```

No final (success ou failure): `SET lock_until = NULL`.

---

## FASE 5: Auto-Sync (Edge Function + Cron)

### Novo arquivo: `supabase/functions/scheduled-sync/index.ts`

```text
// Seguranca: verificar X-CRON-SECRET header
const CRON_SECRET = Deno.env.get("CRON_SECRET");

// Validar:
const headerSecret = req.headers.get("x-cron-secret");
if (headerSecret !== CRON_SECRET) {
  return new Response("Unauthorized", { status: 401 });
}

// 1. Buscar conexoes com auto_sync_enabled = true e sem lock ativo
// 2. Para cada conexao:
//    a. Refresh token
//    b. Obter modifiedTime do Drive (fingerprint rapido)
//    c. Se fingerprint nao mudou -> skip
//    d. Se mudou -> chamar logica de sync com service_role
// 3. Atualizar status
```

### Config: `supabase/config.toml`

```text
[functions.scheduled-sync]
verify_jwt = false
```

### Secret necessario

- `CRON_SECRET`: string aleatoria para validar chamadas do cron. Sera solicitada ao usuario antes de registrar o cron.

### Cron (UTC convertido de BRT)

| BRT | UTC | Cron |
|---|---|---|
| 07:30 | 10:30 | `30 10 * * *` |
| 09:30 | 12:30 | `30 12 * * *` |
| 11:00 | 14:00 | `0 14 * * *` |
| 13:30 | 16:30 | `30 16 * * *` |
| 15:00 | 18:00 | `0 18 * * *` |
| 17:00 | 20:00 | `0 20 * * *` |

Registrar via SQL (insert tool, nao migracao):

```text
SELECT cron.schedule('autosync-0730', '30 10 * * *', $$
  SELECT net.http_post(
    url:='https://bswoctjrwvixxgqpwxcv.supabase.co/functions/v1/scheduled-sync',
    headers:=concat('{"Content-Type":"application/json","x-cron-secret":"', current_setting('app.cron_secret', true), '"}')::jsonb,
    body:='{}'::jsonb
  );
$$);
```

(Repetir para os outros 5 horarios)

### Fallback se pg_cron nao disponivel

A edge function `scheduled-sync` valida o horario atual (America/Sao_Paulo) e so executa se estiver dentro de uma janela de 5 minutos dos horarios programados. Assim, pode ser acionada por qualquer cron externo a cada 30 min e executara apenas nos momentos corretos.

---

## FASE 6: UX Minima (sem telas novas)

Nenhuma mudanca na UI alem do que ja existe:
- "Ultima sincronizacao: DD/MM HH:MM"
- "Status: Atualizado / Sincronizando / Falha"

---

## Arquivos modificados (resumo)

| Arquivo | Mudanca |
|---|---|
| Migracao SQL | `stable_key`, `content_hash`, backfill, limpar indices, `lock_until`, `last_source_fingerprint` |
| `supabase/functions/sheets-sync-all-tabs/index.ts` | Gerar stable_key + content_hash, reconcileAndUpsert com realinhamento, fingerprint por aba, lock |
| `supabase/functions/scheduled-sync/index.ts` | NOVO: auto-sync agendado com validacao de X-CRON-SECRET |
| `supabase/config.toml` | Config da nova function |
| SQL (insert tool) | Cron jobs |

## O que NAO sera alterado

- Pipeline DRE (`dre-sync/index.ts`)
- Frontend hooks (`useHomeDashboard`, `usePeriodMetrics`, `useTransactions`)
- Upload de Excel (`parse-excel-upload`)
- Paginas de UI
- `src/lib/currency.ts`

## Testes de validacao (internos)

1. **Re-sync 2x sem mudanca**: 2a execucao -> inserted=0, updated=0, noOps=N
2. **Alterar categoria/descricao**: content_hash muda -> updated=1, inserted=0 (mesmo registro)
3. **Inserir 10 linhas no topo**: stable_key muda mas content_hash match -> 10 inserts + ~0 duplicacoes (registros existentes realinhados)
4. **Duplicatas identicas**: 2 linhas iguais permanecem 2 registros (desempate por proximidade de rowIndex)
5. **Excel**: so reprocessa quando hash do arquivo muda

## Ordem de execucao

1. Migracao SQL (schema + backfill + indices)
2. Refatorar `sheets-sync-all-tabs` (stable_key + content_hash + reconcileAndUpsert + fingerprint + lock)
3. Criar `scheduled-sync` + config.toml
4. Solicitar CRON_SECRET ao usuario
5. Registrar cron jobs
