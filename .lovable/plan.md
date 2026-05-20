
# Remover aviso da etapa de Revisão (Criar demanda)

Escopo único e trivial.

## Arquivo

`src/pages/demands/NewDemandPage.tsx`

## Mudança

Remover o bloco azul de aviso renderizado dentro do `step === 4` (Revisão), linhas 201–204:

```tsx
<div className="mt-4 rounded-xl bg-primary/[0.06] border border-primary/20 px-3 py-2.5 text-[12px] text-foreground/80 leading-snug">
  Ao enviar, esta demanda será registrada no sistema e encaminhada à equipe responsável.
  Uma tarefa também será criada automaticamente no Asana, se a integração estiver ativa.
</div>
```

Após a remoção, a tela de Revisão mostrará apenas o `ReviewBlock` dentro do `GlassCard`, sem o aviso sobre Asana.

## O que NÃO muda

- Lógica de envio da demanda
- Integração com Asana (continua rodando em background)
- `ReviewBlock`, footer de ações, demais steps
- Nenhum outro arquivo é tocado
