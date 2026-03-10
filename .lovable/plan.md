

## Diagnóstico

O log mostra claramente o erro:

```
Create result: {"status":400,"error":"Bad Request","response":{"message":["Invalid integration"]}}
```

A Evolution API v2.2.3 **exige** o campo `integration` no payload de criação de instância. O código atual envia apenas `{ instanceName: newName }`, faltando o campo obrigatório.

## Correção

No `deploy/backend/src/routes/whatsapp-proxy.ts`, linha 103, alterar o payload do create:

```typescript
// DE:
const createResult = await evolutionRequest("/instance/create", "POST", { instanceName: newName });

// PARA:
const createResult = await evolutionRequest("/instance/create", "POST", {
  instanceName: newName,
  integration: "WHATSAPP-BAILEYS",
  qrcode: true,
});
```

O campo `qrcode: true` faz a Evolution API já retornar o QR code na resposta da criação, eliminando a necessidade da chamada separada ao `/instance/connect`.

## Deploy

```bash
cd ~/simplificandoconversas/deploy
git pull origin main
docker compose up -d --build backend
# Testar e verificar logs:
docker compose logs backend --tail=20
```

