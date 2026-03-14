

## Sistema Anti-Ban: Fila Global de Mensagens

### Problema
Quando vários contatos entram no funil simultaneamente, o motor dispara mensagens em paralelo para todos. O WhatsApp detecta envios simultâneos como comportamento automatizado e pode banir o número.

### Solução
Criar uma **fila global de mensagens** (por instância WhatsApp) que serializa todos os envios com intervalo mínimo de 2 segundos entre cada mensagem, independente do contato.

### Arquitetura

```text
Flow A (contato 1) ──┐
Flow B (contato 2) ──┼──> MessageQueue (por instância)
Flow C (contato 3) ──┘         │
                          [msg1] → 2s → [msg2] → 2s → [msg3]
```

### Implementação

**1. Novo arquivo: `deploy/backend/src/lib/message-queue.ts`**
- Classe `MessageQueue` singleton por `instanceName`
- Método `enqueue(task)` que retorna uma Promise resolvida quando a mensagem é efetivamente enviada
- Worker interno que processa uma mensagem por vez com `sleep(2000)` entre cada envio
- Suporte a prioridade (presença/typing não conta como mensagem real)

**2. Alterar: `deploy/backend/src/routes/execute-flow.ts`**
- Na função `executeStep`, ao invés de chamar `evolutionRequest` diretamente para envio de mensagens (sendText, sendImage, sendAudio, sendVideo, sendFile, waitForClick, aiAgent), enfileirar na `MessageQueue`
- Os nós de tipo `waitDelay`, `condition`, `action`, `trigger` continuam sem passar pela fila (não enviam mensagem)
- `sendPresence` também não passa pela fila (não é mensagem)

**3. Mecânica da fila**
- Map global: `instanceName → MessageQueue`
- Cada item da fila contém: `{ fn: () => Promise<result>, resolve, reject }`
- O worker roda em loop: pega item → executa → aguarda 2s → próximo
- Se a fila esvazia, o worker para e reinicia quando um novo item chega
- Log: `[queue:{instance}] sending to {jid} (queue size: N)`

### Arquivos impactados
- `deploy/backend/src/lib/message-queue.ts` (novo)
- `deploy/backend/src/routes/execute-flow.ts` (alterar envios para usar fila)

### Após deploy
```bash
cd /opt/chatbot/deploy && docker compose build backend && docker compose up -d --force-recreate backend
```

