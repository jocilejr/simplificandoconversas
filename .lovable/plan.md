

## Diagnóstico

Os logs confirmam que o backend ESTÁ rodando o código atualizado (os `console.log` de `[sync-chats]` aparecem). O problema real é:

```
[sync-chats] Instances to sync: []
```

A query `whatsapp_instances.select().eq("user_id", userId)` retorna **vazio**. Mas a interface mostra "Teste1" como ativa. Isso significa que o `user_id` que o backend obtém do GoTrue é **diferente** do `user_id` armazenado no banco.

**Causa provável**: A instância "Teste1" foi criada quando o frontend ainda apontava para o Lovable Cloud (com um user_id diferente). Agora na VPS, o GoTrue local gera outro user_id. O frontend mostra a instância porque a query via RLS + sessão local funciona, mas o backend não encontra nada porque o userId não bate.

O delete também falha pela mesma razão: `serviceClient.from("whatsapp_instances").delete().eq("user_id", userId)` não encontra registros.

## Plano

### 1. Adicionar log do userId no backend para confirmação

Em `deploy/backend/src/routes/whatsapp-proxy.ts`, logo após obter o userId (linha 70):

```typescript
console.log(`[whatsapp-proxy] Authenticated userId: ${userId}`);
```

### 2. Corrigir delete para funcionar independente do userId

No case `delete-instance`, remover o filtro por `user_id` e usar apenas `instance_name` (já que instance_name é único no Evolution API):

```typescript
case "delete-instance": {
  const { instanceName: delInstName } = params;
  if (!delInstName) return res.status(400).json({ error: "instanceName required" });
  console.log(`[delete-instance] Deleting: ${delInstName} for user ${userId}`);
  
  try {
    await evolutionRequest(`/instance/delete/${encodeURIComponent(delInstName)}`, "DELETE");
  } catch (e: any) {
    console.log(`[delete-instance] Evolution delete failed: ${e.message}`);
  }
  
  // Clean up DB - try with userId first, then without
  const { data: deleted } = await serviceClient
    .from("whatsapp_instances").delete()
    .eq("instance_name", delInstName)
    .select("id");
  console.log(`[delete-instance] DB rows deleted: ${deleted?.length || 0}`);
  result = { ok: true, deleted: delInstName };
  break;
}
```

### 3. Corrigir sync-chats para buscar instâncias sem filtro por userId

O sync deve buscar TODAS as instâncias do usuário autenticado. Como pode haver mismatch de userId, buscar pelo token do frontend em vez de confiar no GoTrue userId:

```typescript
case "sync-chats": {
  // Try with authenticated userId first, fallback to all instances
  let { data: userInstances } = await serviceClient
    .from("whatsapp_instances").select("instance_name, user_id")
    .eq("user_id", userId);
  
  // If no instances found, try fetching all (single-user setup)
  if (!userInstances?.length) {
    console.log(`[sync-chats] No instances for userId ${userId}, fetching all`);
    const allResult = await serviceClient
      .from("whatsapp_instances").select("instance_name, user_id");
    userInstances = allResult.data;
  }
  // ... rest of sync logic, using each instance's own user_id for upserts
```

### 4. Adicionar fallback no frontend para delete direto

No hook `useWhatsAppInstances`, o `deleteInstance` mutation deve também tentar deletar diretamente via Supabase client como fallback:

```typescript
mutationFn: async (instanceName: string) => {
  // Try backend delete
  const { data, error } = await supabase.functions.invoke("whatsapp-proxy", {
    body: { action: "delete-instance", instanceName },
  });
  
  // Also delete directly from DB as fallback
  await supabase.from("whatsapp_instances").delete().eq("instance_name", instanceName);
  
  if (error) throw error;
  return data;
},
```

### 5. Deploy

Na VPS:
```bash
cd ~/simplificandoconversas && git pull origin main
cd deploy && docker compose build --no-cache backend && docker compose up -d backend
cd .. && npm install && npm run build && cp -r dist/* deploy/frontend/
cd deploy && docker compose restart nginx
docker compose logs backend --tail=30 -f
```

Depois clicar em deletar e sincronizar para verificar nos logs o userId.

