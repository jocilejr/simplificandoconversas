

# Visualização detalhada da fila por instância

## Problema atual
A fila só mostra um resumo compacto (badge de status). O usuário quer:
1. Um botão por instância que abre uma visão detalhada
2. Ver mensagens pendentes na fila
3. Ver histórico de mensagens já enviadas (sent/failed)
4. Poder limpar o histórico

## Solução

### 1. Backend: `deploy/backend/src/lib/message-queue.ts`
Adicionar à classe `MessageQueue`:
- `history: Array<{ label, status: "sent"|"failed", timestamp, error? }>` — registra cada envio/falha
- Limite de 200 itens no histórico (FIFO)
- No `processNext()`, após `item.fn()`, push ao `history` com status `sent` ou `failed`
- `getStatus()` já retorna `pendingLabels` — adicionar campo `history`
- Novo método `clearHistory()` que limpa o array

Adicionar função exportada `clearQueueHistory(instanceName)`.

### 2. Backend: `deploy/backend/src/index.ts`
Adicionar endpoint `POST /api/queue-clear-history` que recebe `{ instanceName }` e chama `clearQueueHistory()`.

### 3. Frontend: `src/hooks/useQueueStatus.ts`
- Atualizar interface `QueueStatus` para incluir `history`
- Adicionar função `clearQueueHistory(instanceName)` que faz POST ao endpoint

### 4. Frontend: `src/components/settings/ConnectionsSection.tsx`
Adicionar um botão "Fila" (ícone Inbox) na barra de ações de cada instância. Ao clicar, abre um `Dialog` com:
- **Aba "Pendentes"**: lista das mensagens aguardando na fila (label de cada uma)
- **Aba "Histórico"**: lista de mensagens enviadas/falhadas com badge verde (Sent) ou vermelha (Failed), timestamp e erro se houver
- **Botão "Limpar histórico"**: chama o endpoint de clear

## Arquivos alterados
1. `deploy/backend/src/lib/message-queue.ts` — history tracking + clearHistory
2. `deploy/backend/src/index.ts` — endpoint POST clear-history  
3. `src/hooks/useQueueStatus.ts` — interface atualizada + função clear
4. `src/components/settings/ConnectionsSection.tsx` — botão + dialog detalhado

## Deploy
```bash
cd ~/simplificandoconversas/deploy && docker compose up -d --build backend
```

