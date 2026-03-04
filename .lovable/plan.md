

## Diagnóstico

Os logs do `evolution-webhook` confirmam que **nenhum evento** está chegando da instância "Meire Rosana - Entregas" — nem `messages.upsert`, nem `connection.update`. Apenas eventos de `FunilPrincipal` e `sc-mmciul2y` estão sendo recebidos.

Embora o `sync-webhooks` tenha retornado sucesso com `enabled: true`, a instância tem espaços no nome ("Meire Rosana - Entregas"). A URL `${baseUrl}/webhook/set/Meire Rosana - Entregas` contém espaços não-codificados, o que pode causar problemas na configuração real do webhook no servidor da Evolution API.

Além disso, o `create-instance` (linha 164) não inclui `enabled: true` no webhook, então instâncias criadas por esse fluxo também podem não ter webhook ativado.

## Correções

### 1. URL-encode os nomes de instância em TODAS as chamadas à Evolution API

Em `evolution-proxy/index.ts`, usar `encodeURIComponent(instanceName)` em todas as URLs que incluem o nome da instância:
- `set-webhook` (linha 262)
- `sync-webhooks` (linha 301)
- `connect-instance` (linha 206)
- `delete-instance` (linha 220)
- `set-proxy` (linha 245)
- `findMessages` (linha 450)
- `findChats` (linha 479)
- `send-message` (linha 357)
- `test-connection` (linha 333)
- `fetch-profile-picture` (linha 600)
- `fetch-instances` — não precisa (sem nome na URL)

### 2. Adicionar `enabled: true` no `create-instance`

Na linha 164, adicionar `enabled: true` ao objeto `webhook` para garantir que instâncias novas já nasçam com webhook ativado.

### Arquivo a editar
- `supabase/functions/evolution-proxy/index.ts` — adicionar `encodeURIComponent()` em todas as URLs com instance name + `enabled: true` no create-instance.

