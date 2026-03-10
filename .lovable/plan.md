

## Diagnóstico

`DATABASE_SAVE_DATA_HISTORIC: "true"` já está configurado, mas `findChats` retorna `[]` porque:

1. A instância "Adsd" foi criada **antes** de habilitar `HISTORIC=true`. O histórico só é importado no momento da **primeira conexão** da instância.
2. `DATABASE_SAVE_DATA_NEW_MESSAGE: "false"` — a Evolution **não salva mensagens** no seu banco interno, então `findChats` não tem dados para retornar.

Além disso, o delay na UI já foi reduzido (polling 2-3s), mas as mensagens estão aparecendo — o que indica que o sistema está funcionando para mensagens novas.

## Plano

### 1. Corrigir configuração da Evolution (docker-compose.yml + portainer-stack.yml)

Habilitar salvamento de mensagens no banco da Evolution para que `findChats` e `findMessages` retornem dados:

```
DATABASE_SAVE_DATA_NEW_MESSAGE: "true"
DATABASE_SAVE_MESSAGE_UPDATE: "true"  
DATABASE_SAVE_DATA_CONTACTS: "true"
```

### 2. Adicionar importação de mensagens no sync-chats (webhook-proxy.ts)

No action `sync-chats`, após importar os chats, também chamar `/chat/findMessages/{instance}` para cada chat, e inserir as mensagens que ainda não existem no banco da aplicação (verificando por `external_id` para evitar duplicatas).

### 3. Recriar a instância WhatsApp

Após o deploy, o usuário precisará:
1. Deletar a instância "Adsd" via Configurações
2. Criar uma nova instância
3. Escanear o QR code
4. Clicar em "Sincronizar" — agora com `HISTORIC=true` + `NEW_MESSAGE=true`, o `findChats` retornará os chats e o novo código importará as mensagens

### Resumo de alterações de código

- **deploy/docker-compose.yml** e **deploy/portainer-stack.yml**: Habilitar `DATABASE_SAVE_DATA_NEW_MESSAGE`, `DATABASE_SAVE_MESSAGE_UPDATE`, `DATABASE_SAVE_DATA_CONTACTS`
- **deploy/backend/src/routes/whatsapp-proxy.ts**: No `sync-chats`, após importar chats, buscar mensagens via `/chat/findMessages/{instance}` e inserir no banco (com dedup por `external_id`)

