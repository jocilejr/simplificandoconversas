

## Corrigir validação de webhook da OpenPix (retornar 200)

### Problema
A OpenPix envia uma requisição GET para validar o endpoint antes de registrar o webhook. O backend só tem `router.post("/:source")`, então retorna 404 no GET e a OpenPix recusa o cadastro.

### Solução
Adicionar uma rota GET no `deploy/backend/src/routes/webhook-transactions.ts` que responda 200 para qualquer source.

### Mudança

**`deploy/backend/src/routes/webhook-transactions.ts`** — Adicionar antes do `router.post`:

```typescript
// GET /api/webhook-transactions/:source — health check for webhook validation
router.get("/:source", (req: Request, res: Response) => {
  console.log(`[webhook-transactions] GET validation from ${req.params.source}`);
  res.status(200).json({ ok: true, source: req.params.source });
});
```

### Após o deploy
1. Rebuildar o backend na VPS:
```bash
cd /root/simplificandoconversas/deploy
docker compose up -d --build backend
```
2. Testar manualmente:
```bash
curl -s https://app.chatbotsimplificado.com/api/webhook-transactions/openpix?user_id=test
```
Deve retornar `{"ok":true,"source":"openpix"}` com status 200.

3. Cadastrar o webhook na OpenPix novamente.

