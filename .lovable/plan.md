

# Plano: Sincronizar status do lembrete com API externa ao marcar como concluído

## Resumo

Quando o usuário marcar um lembrete como concluído (ou desmarcar) na interface, além de atualizar no banco local, o sistema também enviará um `PATCH` para a API externa (`/api/platform/reminders/:id`) para manter o sistema externo sincronizado.

## O que será alterado

### Arquivo: `src/hooks/useReminders.ts` — função `useToggleReminder`

Após atualizar o lembrete no banco local com sucesso (`onSuccess`), fazer uma chamada `PATCH` para a API da plataforma:

1. Buscar a API key do usuário na tabela `platform_connections` (platform = `custom_api`)
2. Buscar o `app_public_url` do perfil do usuário (que contém o domínio da API na VPS)
3. Se ambos existirem, enviar `PATCH` para `{app_public_url}/api/platform/reminders/{id}` com `{ completed: true/false }` e header `X-API-Key`
4. Se a chamada externa falhar, apenas logar no console (não bloquear o fluxo local)

### Detalhes técnicos

- A chamada externa será feita no `onSuccess` do mutation, de forma assíncrona (fire-and-forget)
- Caso o usuário não tenha API key configurada ou `app_public_url`, a sincronização será silenciosamente ignorada
- Nenhuma mudança no backend é necessária — o endpoint `PATCH /api/platform/reminders/:id` já existe e aceita `{ completed }` no body

