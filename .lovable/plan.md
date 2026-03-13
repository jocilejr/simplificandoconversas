
## Fix: @lid → phone_number resolution for Evolution API — Concluído ✅

### Root Cause
O `execute-flow` usava o `remoteJid` (@lid) diretamente como `number` nas chamadas à Evolution API. A Evolution API não aceita @lid — precisa de número real (@s.whatsapp.net).

### Mudanças realizadas

| Arquivo | Mudança |
|---------|---------|
| **execute-flow.ts (backend)** | Nova variável `sendNumber`: resolve phone_number da conversa quando jid é @lid. Usado em todas as chamadas Evolution API. `jid` mantido para operações no banco. |
| **execute-flow/index.ts (edge)** | Mesma lógica de resolução `sendNumber` para paridade |
| **webhook.ts** | `resolvedPhone` enviado no body ao disparar fluxos para que execute-flow tenha o telefone disponível |
| **executeStep()** | Novo parâmetro `sendNumber` para usar número real nas chamadas Evolution |

### Estratégia de resolução (3 camadas)
1. `bodyResolvedPhone` do webhook (mais rápido)
2. `phone_number` da conversa por `remote_jid` lookup
3. `phone_number` da conversa por `lid` lookup
