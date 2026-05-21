## Objetivo
Simplificar drasticamente a criação de demandas: cliente preenche **Nome, Empresa, Descrição** (e anexos opcionais) numa única tela, envia, e vê a tela de sucesso. O sistema interpreta o texto livre e organiza tudo no Asana, sem mudar a identidade visual (Liquid Glass / 3D premium) já aprovada.

---

## Tela 1 — Nova demanda (substitui o wizard de 5 etapas)

Arquivo principal: reescrever `src/pages/demands/NewDemandPage.tsx` mantendo o mesmo header, GlassCards, tokens e sombras existentes.

Composição vertical (sem stepper, sem sidebar de resumo, sem botões Próximo/Voltar):

1. **Header atual** (`DemandTypeIcon` + título). Texto novo:
   - Título: "Criar demanda inteligente"
   - Subtítulo: "Preencha seus dados e descreva sua solicitação. A equipe da CW analisará e dará andamento."

2. **Card "Identificação"** (reaproveita o visual atual de `DemandRequesterStep`, versão enxuta):
   - Nome do solicitante * (placeholder "Ex.: Maria Silva")
   - Empresa * (placeholder "Ex.: Acme Ltda")
   - **Remover** desta tela: e-mail, WhatsApp, cargo/setor.

3. **Card "Descreva sua demanda"** (novo, premium 3D no mesmo padrão Liquid Glass):
   - Título + texto auxiliar conforme briefing.
   - `Textarea` grande (min ~180px desktop / ~160px mobile), bordas refinadas, sombra interna, foco com ring no tom primário, microinteração de elevação. Sem visual genérico.
   - Placeholder: "Ex.: Preciso solicitar o pagamento de uma nota no valor de R$ 1.000,00 para o fornecedor X, com vencimento em 20/05. Segue documento em anexo."
   - Obrigatório.

4. **Card "Anexar documentos"** — reaproveita `UploadDropzone` atual (mesmo upload, mesma validação, opcional).

5. **Botão "Enviar demanda"** — usa o mesmo estilo verde premium do botão final atual.
   - Estado loading: "Enviando demanda..."
   - Bloqueia duplo clique (estado `submitting`).
   - Validação inline elegante (mensagens via `sonner` + highlight no campo) para os 3 obrigatórios: nome, empresa, descrição.

Responsivo: coluna única em mobile, padding/spacing existentes preservados, sem overflow horizontal. Header e cards já são fluidos. Em desktop o conteúdo fica em `max-w-3xl mx-auto` para não esticar demais.

### Componentes a criar
- `src/components/demands/new/QuickDemandForm.tsx` — orquestra os 3 cards + botão.
- `src/components/demands/new/DescriptionCard.tsx` — card premium com a textarea grande.
- `src/components/demands/new/QuickIdentityCard.tsx` — versão reduzida (nome + empresa).

### Componentes mantidos (intactos)
- `UploadDropzone`, `GlassCard`, `DemandTypeIcon`, `DemandSuccessExperience`, hooks `useCreateDemand` / `useUploadDemandDocument`.
- `SmartDemandForm`, `DemandRequesterStep`, `StepIndicator`, `ThreeDIconCard`, `ClientIdentityGate` permanecem no repo (usados por outras telas/admin), mas saem do fluxo de criação.

---

## Interpretação automática (cliente → estrutura)

Novo helper `src/lib/demands/interpretFreeText.ts` 100% determinístico (sem IA, sem inventar):

- **Tipo provável** (`pagamento` / `recebimento` / `nota_fiscal` / `boleto` / `reembolso` / `conciliacao` / `outro`): regex por palavras-chave em PT-BR ("pagar", "boleto", "nota fiscal/NF", "reembolso", "recebimento", "conciliação"). Default: `outro`.
- **Urgência** (`baixa` / `normal` / `alta` / `urgente`): detecta "urgente", "hoje", "amanhã", "vence hoje". Default: `normal`.
- **Valores citados**: regex `R\$\s*[\d\.,]+` → array de strings normalizadas.
- **Datas citadas**: regex `dd/mm(/yyyy)?` + nomes de meses → array.
- **Pessoas/empresas citadas**: heurística simples — palavras capitalizadas após "fornecedor", "cliente", "para", "de", limitada para não inventar.
- **Título automático** curto: combina tipo detectado + empresa do solicitante (`"Solicitação de pagamento — Acme Ltda"`, fallback `"Nova demanda — Acme Ltda"`).
- **Resumo curto** (1–2 frases): primeira frase da descrição truncada para ~180 chars + tipo detectado.

Função pura, testável, sem dependência externa. Tudo "Não informado" quando não detectado.

---

## Submissão e persistência

`useCreateDemand` (em `src/hooks/useDemand.ts`) ganha campos opcionais sem quebrar callers:

- `demand_type` recebe o tipo detectado (default `outro`).
- `title` recebe o título automático.
- `priority` recebe urgência detectada (default `normal`).
- `description` = texto original completo do cliente.
- `requester_metadata` = `{ name, company }` (sem email/phone/role nesse fluxo).
- Novo bloco em `requester_metadata.interpretation`: `{ summary, detected_type, detected_urgency, amounts[], dates[], parties[] }` — guardado como JSON dentro de `requester_metadata` (campo `jsonb` que já existe), evitando migration.

**Sem migration de schema** — todas as colunas necessárias já existem em `financial_demands` (`description`, `demand_type`, `priority`, `title`, `supplier_name`, `requester_metadata` jsonb, anexos via `financial_demand_documents`). Demandas antigas continuam compatíveis: painel interno, listagens, kanban e detalhes seguem lendo os mesmos campos.

Tratamento de erro:
- Se `useCreateDemand` falhar: toast "Não foi possível enviar a demanda agora. Tente novamente em alguns instantes.", formulário **preserva** texto e anexos (não reseta state em erro).
- Se Asana falhar: já é fire-and-forget com `asana_sync_status='pending_sync'/'error'` — comportamento atual mantido, demanda fica salva e pode ser reprocessada via `asana-retry-sync`.

---

## Integração com Asana

Atualizar `supabase/functions/asana-create-task/index.ts` (e idem `asana-update-task`) na função `buildNotes()` para refletir o novo modelo quando houver `requester_metadata.interpretation`:

Novo formato `notes` (em vez do bloco antigo de "Demanda/Contraparte"):

```
Nova demanda recebida pelo sistema CW
────────────────────────────
👤 SOLICITANTE
Nome: {requester.name}
Empresa: {requester.company}
────────────────────────────
🧠 RESUMO INTERPRETADO
{interpretation.summary || "Não informado"}
────────────────────────────
📝 SOLICITAÇÃO ORIGINAL DO CLIENTE
{description}
────────────────────────────
🔎 INFORMAÇÕES IDENTIFICADAS AUTOMATICAMENTE
- Tipo provável: {detected_type}
- Urgência provável: {detected_urgency}
- Valores citados: {amounts || "Não informado"}
- Datas/vencimentos: {dates || "Não informado"}
- Pessoas/empresas: {parties || "Não informado"}
- Documentos anexados: {N} ({nomes})
────────────────────────────
Status inicial: Em análise
Origem: Portal do cliente
Enviada em: {timestamp BRT}
🔗 Link interno: {origin}/demands/{id}
```

- Título da task no Asana: usa `d.title` (já gerado automaticamente).
- Documentos anexados: a função carrega `financial_demand_documents` antes de montar `notes` para listar nomes; o upload real (`uploadAttachments`) continua igual.
- Compatibilidade: se `requester_metadata.interpretation` não existir (demandas antigas/admin), cai no formato antigo `buildNotes` — fluxo interno administrativo segue intacto.

---

## Tela 2 — Sucesso (ajustes mínimos)

`DemandSuccessExperience` + `SummaryBlock`:

- Cards superiores agora exibem: **Código**, **Status (Em análise)**, **Solicitante**, **Empresa**. Remover "Tipo" e "Próximo passo" do grid (ou substituir "Próximo passo" por "Empresa").
- "Resumo" passa a usar `interpretation.summary` quando disponível; fallback para `buildDemandSummary` atual.
- `SuccessActionButtons`: remover botão "Acompanhar demanda". Manter "Criar nova demanda". "Voltar para a Central" só renderiza se o usuário tiver `role` admin/manager (via `useUserRole`); cliente puro vê apenas "Criar nova demanda".
- Manter toda a animação CW, GlassCard, orbs, footer.

---

## Out of scope
- Sem mudanças de schema/RLS.
- Sem mudanças em login, rotas, permissões, painel interno, kanban, filtros, listagens.
- Sem alteração visual do design system (cores, tokens, sombras, fonts).
- Sem IA — interpretação é determinística para evitar invenção de dados.

---

## Validação
1. Abrir `/demands/new` → ver header + 3 cards + botão (sem stepper, sem sidebar).
2. Enviar sem nome/empresa/descrição → mensagens inline.
3. Enviar com texto contendo "pagar R$ 1.000 vencimento 20/05 fornecedor X" → demanda criada com `demand_type='pagamento'`, título "Solicitação de pagamento — {empresa}", priority correta.
4. Anexar PDF → arquivo aparece em `financial_demand_documents` e como anexo no Asana.
5. Conferir task no Asana com os 5 blocos novos.
6. Tela final mostra Código, Status, Solicitante, Empresa + resumo interpretado, sem botão "Acompanhar demanda".
7. Cliente sem acesso à Central não vê o botão "Voltar para a Central".
8. Demanda antiga abre normalmente no painel admin.
9. Mobile (375px) e desktop (1306px): sem overflow, textarea confortável, botão acessível.
10. Se Asana cair: demanda persiste com `asana_sync_status='error'`, dados do cliente preservados.
