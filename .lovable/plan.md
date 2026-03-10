

## Diagnóstico Confirmado

Os comandos confirmam:
- `service_role` tem `rolbypassrls = t` — BYPASSRLS está OK
- A tabela `whatsapp_instances` está **vazia** (o comando falhou por falta de `less`, mas o fallback no sync-chats também retorna `[]`)
- `flow_timeouts` tem 0 rows

A causa raiz é simples: a tabela `whatsapp_instances` no banco da VPS está vazia. As instâncias que aparecem na UI vêm do **Evolution API** (`fetch-instances` → `remoteInstances`), não do banco. O `create-instance` provavelmente falhou ao gravar no banco por causa do RLS (antes do fix do BYPASSRLS), então as instâncias foram criadas apenas na Evolution API.

O `sync-chats` busca instâncias da tabela `whatsapp_instances` → encontra vazio → não sincroniza nada.

## Plano

### 1. Corrigir `sync-chats` para usar Evolution API como fonte de instâncias

Em `deploy/backend/src/routes/whatsapp-proxy.ts`, no case `sync-chats` (linhas 228-238), substituir a lógica de busca de instâncias:

Em vez de buscar do banco `whatsapp_instances`, buscar direto da Evolution API via `fetchInstances`, e usar o `userId` autenticado para todos os upserts:

```typescript
case "sync-chats": {
  // Get instances from Evolution API (source of truth)
  const allEvolutionInstances = await evolutionRequest("/instance/fetchInstances", "GET");
  const evolutionList = Array.isArray(allEvolutionInstances) ? allEvolutionInstances : [];
  
  const instancesToSync = evolutionList.map((i: any) => 
    i.name || i.instanceName || i.instance?.instanceName || "unknown"
  );
  console.log(`[sync-chats] Instances from Evolution API: ${JSON.stringify(instancesToSync)}`);

  // Ensure all instances exist in DB
  for (const instName of instancesToSync) {
    await serviceClient.from("whatsapp_instances").upsert(
      { user_id: userId, instance_name: instName, status: "close", is_active: false },
      { onConflict: "user_id,instance_name" }
    );
  }
  // ... rest of sync logic using instancesToSync and userId
```

### 2. Corrigir `create-instance` para ser idempotente

Sem mudança necessária — agora com BYPASSRLS o upsert vai funcionar para novas instâncias.

### 3. Corrigir `delete-instance` 

Já está funcionando via Evolution API. Adicionar log para confirmar resultado da chamada Evolution.

### 4. Melhorar log do `check-timeouts`

Em `deploy/backend/src/routes/check-timeouts.ts`, usar `JSON.stringify(fetchErr)` em vez de apenas `fetchErr` para ver o erro real. Além disso, como a tabela tem 0 rows e não há timeouts pendentes, verificar se o erro é porque a tabela não é acessível ou a query está malformada.

### 5. Comando de verificação pós-deploy

Na VPS:
```bash
cd ~/simplificandoconversas && git pull origin main
cd deploy && docker compose build --no-cache backend && docker compose up -d backend
docker compose logs backend --tail=30 -f
```

Depois clicar em "Sincronizar" — agora deve funcionar porque busca instâncias da Evolution API, não do banco vazio.

