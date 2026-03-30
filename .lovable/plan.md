

# Plano: Sincronização bidirecional de lembretes (sua app → app externa)

## Contexto
Quando você marca um lembrete na sua app, a app externa não é notificada. Precisamos configurar um webhook de callback para a app externa.

## O que será feito

### 1. Adicionar campo `webhook_url` nas configurações da API

**Arquivo**: `src/components/settings/IntegrationApiSection.tsx`

Adicionar um campo de input para o usuário configurar a URL de webhook da aplicação externa (ex: `https://minha-app-externa.com/api/webhook`). Esse valor será salvo em `platform_connections.credentials.webhook_url`.

### 2. Backend: enviar webhook ao atualizar lembrete via PATCH

**Arquivo**: `deploy/backend/src/routes/platform-api.ts`

No endpoint `PATCH /api/platform/reminders/:id`, após atualizar o banco, verificar se existe `webhook_url` configurado. Se sim, enviar um POST fire-and-forget para a URL com o payload:
```json
{
  "event": "reminder_updated",
  "id": "uuid",
  "completed": true,
  "title": "...",
  "due_date": "..."
}
```

### 3. Frontend: chamar PATCH da VPS ao marcar lembrete

**Arquivo**: `src/hooks/useReminders.ts`

No `onSuccess` do `useToggleReminder`, fazer uma chamada fire-and-forget para `PATCH {apiUrl}/api/platform/reminders/:id` com o campo `completed`, usando a API key e o `app_public_url` do perfil (com a substituição `app.` → `api.`). Similar ao que tínhamos antes, mas agora faz sentido porque o backend vai repassar para a app externa.

### 4. Criar endpoint na app externa

Você precisará criar na app externa um endpoint tipo:
```
POST /api/webhook
```
Que aceite o payload acima e atualize o lembrete internamente.

## Resultado
- Usuário configura a URL de webhook da app externa em Configurações → API
- Ao marcar lembrete na sua app → frontend chama PATCH na VPS → backend atualiza DB + envia webhook para app externa
- Ao marcar na app externa → app externa envia webhook para sua VPS → banco atualizado → realtime propaga para UI

