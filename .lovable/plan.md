

## Plano: Centralizar Agendamentos na aba Lembretes

### Contexto
A página `/schedule` (Agendamentos) é apenas um placeholder sem funcionalidade real. A página `/reminders` (Lembretes) já está totalmente funcional com criação, filtros e gestão de tarefas. O usuário quer unificar tudo na aba de Lembretes.

### Alterações

**1. Remover a página e rota de Agendamentos**
- `src/App.tsx` — Remover import de `Schedule`, remover rota `/schedule`, adicionar redirect `/schedule → /reminders` para não quebrar links antigos.
- `src/pages/Schedule.tsx` — Deletar o arquivo.

**2. Atualizar sidebar**
- `src/components/AppSidebar.tsx` — Remover o item "Agendamentos" (`/schedule`) do array `mainItems`. O item "Lembretes" (`/reminders`) já existe e permanece com o ícone de sino.

**3. Renomear a aba (opcional)**
- Atualizar o título da página Reminders de "Lembretes" para "Lembretes & Agendamentos" para deixar claro que centraliza ambos. Ou manter apenas "Lembretes" — depende da preferência.

### Resultado
- Menu lateral terá: Dashboard, Contatos, Fluxos, Lembretes, (Sistema)
- `/schedule` redireciona para `/reminders`
- Uma única página centraliza lembretes e agendamentos

