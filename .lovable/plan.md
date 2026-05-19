## Objetivo

Ocultar a barra superior (busca, Exportar, filtro de data, sino de notificações) para usuários com papel `cliente`, mantendo apenas o essencial para logout.

## Alterações

**`src/components/layout/DashboardLayout.tsx`**
- Usar `useUserRole()` para detectar `isClient`.
- Se `isClient`, não renderizar `<DashboardHeader />`. Em vez disso, renderizar um header mínimo contendo apenas o avatar com dropdown "Sair" (para que o cliente consiga deslogar, já que a sidebar pode estar recolhida em mobile).
- Usuários não-cliente continuam vendo o `DashboardHeader` completo, sem alterações.

## Resultado

- Cliente (`cwfinancas`): vê apenas a sidebar com "Nova Demanda" + header minimalista com avatar/Sair. Sem busca, sem Exportar, sem filtro global, sem sino.
- Demais usuários: experiência inalterada.
