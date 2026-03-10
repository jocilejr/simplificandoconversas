

## Problema

As instâncias criadas antes do deploy existem na Evolution API mas **não no banco de dados local**. Elas aparecem na seção "Instâncias disponíveis no servidor" com apenas o botão "Vincular", sem opção de deletar. Além disso, se a Evolution API retornar erro ao deletar (instância já não existe), toda a operação falha.

## Plano

### 1. Backend: tornar delete resiliente a erros

**`deploy/backend/src/routes/whatsapp-proxy.ts`** - no case `delete-instance`:
- Envolver a chamada `evolutionRequest` em try/catch para não falhar se a instância não existir na Evolution
- Sempre deletar do banco local, independente do resultado da Evolution

```typescript
case "delete-instance": {
  const { instanceName: delInstName } = params;
  if (!delInstName) return res.status(400).json({ error: "instanceName required" });
  
  // Try Evolution delete, but don't fail if instance doesn't exist there
  try {
    await evolutionRequest(`/instance/delete/${encodeURIComponent(delInstName)}`, "DELETE");
  } catch (e: any) {
    console.log(`[delete-instance] Evolution delete failed (may not exist): ${e.message}`);
  }
  
  // Always clean up local DB
  await serviceClient.from("whatsapp_instances").delete()
    .eq("user_id", userId).eq("instance_name", delInstName);
  
  result = { ok: true, deleted: delInstName };
  break;
}
```

### 2. Frontend: adicionar botão de deletar nas instâncias remotas não vinculadas

**`src/components/settings/ConnectionsSection.tsx`** - na seção "unlinkedRemote" (linha ~284), adicionar um botão `Trash2` ao lado do "Vincular" que chama `deleteInstance.mutate(ri.name)`.

### 3. Frontend: adicionar diálogo de confirmação antes de deletar

Adicionar estado `confirmDelete` e um `AlertDialog` que pergunta "Tem certeza que deseja remover esta instância?" antes de executar a exclusão, tanto para instâncias vinculadas quanto não vinculadas.

### Deploy

```bash
cd ~/simplificandoconversas
git pull origin main
cd deploy
docker compose up -d --build backend
```

