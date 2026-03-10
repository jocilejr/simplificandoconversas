

## Diagnóstico Confirmado

Os testes de dentro do Docker provam que **todos os endpoints da Evolution API funcionam perfeitamente**:
- `sendText` enviou mensagem com sucesso
- `findMessages` retornou 3 mensagens com formato `messages.records`

### Problema Real: `fetch-instances` não popula o banco local

O fluxo quebrado:

```text
Frontend chama fetch-instances
  → Backend retorna dados da Evolution API (OK)
  → MAS NÃO grava na tabela whatsapp_instances (BUG)
  → Tabela whatsapp_instances fica vazia
  → send-message tenta resolver instanceName do banco → undefined
  → Chamada vai para /message/sendText/undefined → falha silenciosa
```

O `fetch-instances` (linha 96-98) apenas repassa o resultado da API sem gravar nada no banco. Já o `sync-chats` (linha 240) faz upsert, mas só é chamado manualmente pelo botão "Sincronizar".

### Plano de Correção

**Arquivo:** `deploy/backend/src/routes/whatsapp-proxy.ts`

**1. Corrigir `fetch-instances` (linhas 96-98)**
Após obter as instâncias da Evolution API, fazer upsert automático na tabela `whatsapp_instances` para cada instância encontrada, incluindo o `connectionStatus`. Também marcar a primeira instância como `is_active: true` se nenhuma estiver ativa.

```typescript
case "fetch-instances": {
  const instances = await evolutionRequest("/instance/fetchInstances", "GET");
  const list = Array.isArray(instances) ? instances : [];
  
  // Auto-populate whatsapp_instances table
  for (const inst of list) {
    const name = inst.name || inst.instanceName || "unknown";
    const status = inst.connectionStatus || "close";
    if (name === "unknown") continue;
    await serviceClient.from("whatsapp_instances").upsert(
      { user_id: userId, instance_name: name, status, is_active: false },
      { onConflict: "user_id,instance_name" }
    );
  }
  
  // Ensure at least one instance is active
  const { data: activeCheck } = await serviceClient
    .from("whatsapp_instances")
    .select("id").eq("user_id", userId).eq("is_active", true).limit(1);
  if ((!activeCheck || activeCheck.length === 0) && list.length > 0) {
    const firstName = list[0].name || list[0].instanceName;
    if (firstName) {
      await serviceClient.from("whatsapp_instances")
        .update({ is_active: true })
        .eq("user_id", userId).eq("instance_name", firstName);
    }
  }
  
  result = instances;
  break;
}
```

**2. Nenhuma outra mudança necessária**
- O `sync-chats` já funciona corretamente (usa `findMessages` com `{ where: {} }` que retorna dados no formato `messages.records`, tratado na linha 275)
- O `send-message` já resolve `instanceName` do banco (linha 82-89) -- vai funcionar assim que `whatsapp_instances` estiver populada
- Os demais endpoints (`get-qrcode`, `logout-instance`, etc.) recebem `instanceName` diretamente do frontend

### Deploy
```bash
cd ~/simplificandoconversas && git pull origin main
cd deploy && docker compose up -d --build backend
```

Após deploy, basta abrir a página de Configurações (que chama `fetch-instances`) ou Conversas para que a tabela seja populada automaticamente.

