

# Visualizar Fila de Mensagens por Instância

## Abordagem

A fila de mensagens vive **na memória do backend** (classe `MessageQueue`). Para visualizá-la no frontend, precisamos:

1. **Expor o estado da fila via API** — adicionar um método `getStatus()` na classe `MessageQueue` e um endpoint REST que retorna o estado de todas as filas
2. **Consumir no frontend** — criar um componente que faz polling do endpoint e exibe o estado da fila dentro de cada card de instância

## Arquivos alterados

### 1. `deploy/backend/src/lib/message-queue.ts`
Adicionar método `getStatus()` à classe `MessageQueue`:
- `queueSize` — itens aguardando
- `processing` — se está processando
- `sendCount` — envios desde último cooldown
- `currentLabel` — label do item sendo processado
- `delayMs`, `pauseAfterSends`, `pauseMinutes` — config atual

Exportar função `getAllQueuesStatus()` que itera o `Map<string, MessageQueue>` e retorna um array com o status de cada fila.

### 2. `deploy/backend/src/index.ts`
Adicionar endpoint `GET /api/queue-status` que:
- Importa `getAllQueuesStatus()`
- Retorna o JSON com status de todas as filas
- Sem autenticação (interno, acessado via proxy Nginx)

### 3. `src/hooks/useQueueStatus.ts` (novo)
Hook React que faz polling (`refetchInterval: 3000`) para `GET /api/queue-status` via `supabase.functions.invoke("whatsapp-proxy", { body: { action: "queue-status" } })` ou chamada direta ao backend.

### 4. `src/components/settings/ConnectionsSection.tsx`
Dentro de cada card de instância, adicionar uma seção colapsável "Fila" que mostra:
- Número de mensagens na fila
- Status: Processando / Aguardando / Em Cooldown / Vazia
- Label da mensagem atual sendo processada
- Contador de envios desde último cooldown
- Indicador visual (badge com cor) do estado

### 5. `deploy/backend/src/routes/whatsapp-proxy.ts`
Adicionar handler para `action: "queue-status"` que chama `getAllQueuesStatus()` e retorna. Assim o frontend usa o mesmo proxy que já existe.

## Visualização na UI

Cada instância terá abaixo dos botões existentes uma linha compacta:

```text
┌─────────────────────────────────────────────┐
│ 📨 Fila: 3 pendentes · Enviando: recovery:abc │
│ ██████░░░░ 6/10 msgs antes do cooldown       │
└─────────────────────────────────────────────┘
```

- Badge verde "Vazia" quando `queueSize === 0`
- Badge amarela "Processando (N)" quando ativa
- Badge laranja "Em Cooldown" quando em pausa
- Atualiza a cada 3 segundos via polling

## Deploy
```bash
cd ~/simplificandoconversas/deploy && docker compose up -d --build backend
```

