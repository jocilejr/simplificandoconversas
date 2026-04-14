

## Fix: `workspace_id` ausente em todo o módulo de e-mail

### Problema
O arquivo `deploy/backend/src/routes/email.ts` não inclui `workspace_id` em **nenhum** insert. Todas as tabelas de e-mail (`email_sends`, `email_contacts`, `email_events`, `email_link_clicks`, `email_queue`, `email_follow_up_sends`, `api_request_logs`) exigem `workspace_id` NOT NULL. Isso causa erro 500 em qualquer operação de e-mail via API/n8n.

### Causa raiz
O módulo foi escrito antes da migração multi-tenant. O `workspace_id` nunca foi adicionado.

### Solução

**Arquivo:** `deploy/backend/src/routes/email.ts`

1. **Importar** `resolveWorkspaceId` de `../lib/workspace`

2. **Endpoint `/send` (L260)**: Após obter `userId`, resolver `workspaceId = await resolveWorkspaceId(userId)`. Adicionar `workspace_id: workspaceId` no insert de `email_sends` (L276), e passar para `logEvent` e `rewriteLinks`.

3. **Endpoint `/campaign` (L323)**: Resolver `workspaceId` após validar `userId`. Adicionar `workspace_id: workspaceId` nos inserts de:
   - `email_sends` (L442)
   - `email_follow_up_sends` (L497-505)

4. **Endpoint `/webhook/inbound` (L741)**: Após resolver `userId` (L754-766), resolver `workspaceId`. Adicionar `workspace_id: workspaceId` em:
   - `api_request_logs` (L771)
   - `email_sends` (L792)
   - `email_follow_up_sends` (L843)
   - `email_contacts` upsert (L874) — **este é o erro reportado**
   - `email_queue` (L916)

5. **Função `logEvent` (L200)**: Adicionar parâmetro `workspaceId` e incluir `workspace_id` no insert de `email_events`.

6. **Função `rewriteLinks` (L220)**: Adicionar parâmetro `workspaceId` e incluir `workspace_id` no insert de `email_link_clicks`.

7. **Endpoint de processamento de fila (queue/process ~L1080)**: Resolver `workspaceId` a partir de cada `item.user_id` (ou usar o workspace_id do próprio item da fila, se disponível). Adicionar em `email_sends` (L1123).

### Locais de insert afetados (total: ~10)
| Tabela | Linha aprox. | Endpoint |
|--------|------|----------|
| `email_sends` | 276 | `/send` |
| `email_events` | 204 | `logEvent()` |
| `email_link_clicks` | 240 | `rewriteLinks()` |
| `email_sends` | 442 | `/campaign` |
| `email_follow_up_sends` | 505 | `/campaign` |
| `api_request_logs` | 771 | `/webhook/inbound` |
| `email_sends` | 792 | `/webhook/inbound` |
| `email_follow_up_sends` | 843 | `/webhook/inbound` |
| `email_contacts` | 874 | `/webhook/inbound` |
| `email_queue` | 916 | `/webhook/inbound` |
| `email_sends` | 1123 | queue processor |

### Padrão de resolução
```typescript
import { resolveWorkspaceId } from "../lib/workspace";

// No início de cada handler:
const workspaceId = await resolveWorkspaceId(userId);
if (!workspaceId) return res.status(400).json({ error: "Workspace não encontrado" });
```

### Arquivo alterado
- `deploy/backend/src/routes/email.ts`

Após o deploy, rebuild com: `cd ~/simplificandoconversas/deploy && docker compose up -d --build backend`

