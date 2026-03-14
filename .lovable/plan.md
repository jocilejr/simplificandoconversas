

## Configurar intervalo anti-ban por instância

### O que será feito

Adicionar um campo `message_delay_ms` na tabela `whatsapp_instances` e permitir que o usuário configure o intervalo entre mensagens diretamente na UI de cada instância. O backend usará esse valor ao invés do hardcoded 2000ms.

### Mudanças

**1. Migração de banco** — Adicionar coluna `message_delay_ms` à tabela `whatsapp_instances`:
```sql
ALTER TABLE whatsapp_instances ADD COLUMN message_delay_ms integer NOT NULL DEFAULT 2000;
```

**2. Backend: `deploy/backend/src/lib/message-queue.ts`**
- Adicionar propriedade `delayMs` configurável na classe `MessageQueue`
- Método `setDelay(ms)` para atualizar o delay
- `getMessageQueue()` aceita delay opcional

**3. Backend: `deploy/backend/src/routes/execute-flow.ts`**
- Antes de iniciar a execução, buscar `message_delay_ms` da instância no banco
- Passar o delay ao criar/obter a fila: `getMessageQueue(instanceName, delayMs)`

**4. Frontend: `src/components/settings/ConnectionsSection.tsx`**
- Adicionar um slider ou input numérico abaixo de cada instância vinculada
- Label: "Intervalo entre mensagens" com valor em segundos (ex: 1s a 10s)
- Ao alterar, salvar `message_delay_ms` na tabela `whatsapp_instances` via Supabase
- Mostrar valor atual com indicação visual (ex: "2s" ao lado do slider)

**5. Hook: `src/hooks/useWhatsAppInstances.ts`**
- Incluir `message_delay_ms` na interface `WhatsAppInstance`
- Adicionar mutation `updateDelay` para atualizar o campo no banco

### Arquivos impactados
- Migração SQL (nova coluna)
- `deploy/backend/src/lib/message-queue.ts`
- `deploy/backend/src/routes/execute-flow.ts`
- `src/components/settings/ConnectionsSection.tsx`
- `src/hooks/useWhatsAppInstances.ts`

### Após deploy
```bash
cd /opt/chatbot/deploy && docker compose build backend && docker compose up -d --force-recreate backend
```

