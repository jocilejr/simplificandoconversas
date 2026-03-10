

## Diagnóstico: Dois Problemas Identificados

### Problema 1: Mensagens antigas não importam
`findChats` retorna `[]` porque o Docker Compose tem `DATABASE_SAVE_DATA_HISTORIC: "false"`. Isso impede a Evolution API de persistir e retornar o histórico de chats. Mesmo com `DATABASE_SAVE_DATA_CHATS: "true"`, os chats históricos anteriores à conexão não foram salvos.

### Problema 2: Mensagens novas demoram a aparecer na UI
Na VPS não existe o serviço Supabase Realtime (não está no docker-compose). O frontend detecta falha no WebSocket e ativa polling de fallback: **5s para mensagens** e **10s para conversas**. Isso explica o atraso — as mensagens chegam ao DB instantaneamente via webhook, mas a UI só busca a cada 5-10 segundos.

---

## Plano de Correção

### 1. Habilitar histórico na Evolution API (docker-compose.yml)
Mudar `DATABASE_SAVE_DATA_HISTORIC` de `"false"` para `"true"` nas linhas 143 e equivalente no portainer-stack.yml. Após isso, reconectar a instância para que a Evolution importe o histórico.

### 2. Reduzir intervalo de polling no frontend
- `src/hooks/useMessages.ts`: mudar `refetchInterval` de `5000` para `2000`
- `src/hooks/useConversations.ts`: mudar `refetchInterval` de `10000` para `3000`
- Ativar polling **sempre** (não apenas quando realtime falha), já que na VPS o realtime nunca funcionará

### 3. Deploy
```bash
cd ~/simplificandoconversas && git pull origin main
cd deploy && docker compose up -d --build backend
docker compose restart evolution
```
Após restart da Evolution, reconectar a instância WhatsApp para importar histórico.

