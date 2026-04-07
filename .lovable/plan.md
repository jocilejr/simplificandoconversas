

# Fix: Yampi webhook HMAC validation quebrando silenciosamente

## Problema

O webhook da Yampi está configurado corretamente na URL `https://api.chatbotsimplificado.com/functions/v1/yampi-webhook` e a rota funciona (teste interno retornou `{"ok":true}`). Porém nenhum evento real da Yampi chegou nas últimas 24h.

Há dois problemas:

### 1. HMAC calculado sobre JSON re-serializado (bug crítico)
Na linha 97, o código faz `JSON.stringify(req.body)` para calcular o HMAC. Mas o Express já fez o parse do JSON — ao re-serializar, a ordem das chaves, espaçamentos e formatação podem diferir do body original que a Yampi usou para gerar a assinatura. Resultado: **HMAC mismatch silencioso → 401 retornado para a Yampi → ela para de enviar**.

### 2. Sem log de chegada antes da validação HMAC
O primeiro log só aparece se tudo passar. Se o HMAC falhar, o único log é "HMAC mismatch" — sem detalhes do evento ou IP.

## Solução

### Arquivo: `deploy/backend/src/routes/yampi-webhook.ts`

1. **Capturar o raw body** antes do JSON parse para usar no HMAC. Como o Express global já faz `express.json()`, precisamos de um middleware que salve o buffer original antes do parse.

### Arquivo: `deploy/backend/src/index.ts`

2. **Adicionar `verify` callback** no `express.json()` para salvar o raw body em `req.rawBody` — mas isso afeta todas as rotas. Alternativa mais limpa: usar um middleware específico na rota yampi.

### Abordagem escolhida (mais simples e sem impacto em outras rotas)

No `index.ts`, antes do `express.json()` global, adicionar um middleware que intercepta apenas `/api/yampi-webhook` e salva o raw body:

```typescript
// Save raw body for HMAC validation (yampi webhook)
app.use("/api/yampi-webhook", (req, res, next) => {
  let chunks: Buffer[] = [];
  req.on("data", (chunk) => chunks.push(chunk));
  req.on("end", () => {
    (req as any).rawBody = Buffer.concat(chunks);
    next();
  });
});
```

**Problema**: isso não funciona se `express.json()` já consumiu o stream. A solução correta é usar o parâmetro `verify` do `express.json`:

```typescript
app.use(express.json({
  limit: "50mb",
  verify: (req: any, _res, buf) => {
    // Save raw body for routes that need HMAC verification
    if (req.url?.startsWith("/api/yampi-webhook")) {
      req.rawBody = buf;
    }
  },
}));
```

No `yampi-webhook.ts`, usar `(req as any).rawBody` em vez de `JSON.stringify(req.body)`:

```typescript
const hmacHeader = req.headers["x-yampi-hmac-sha256"] as string | undefined;
if (secretKey && hmacHeader) {
  const rawBody = (req as any).rawBody;
  if (!rawBody) {
    console.log("[yampi-webhook] No raw body available for HMAC validation, skipping");
  } else {
    const computed = crypto
      .createHmac("sha256", secretKey)
      .update(rawBody)
      .digest("hex");
    if (computed !== hmacHeader) {
      console.log("[yampi-webhook] HMAC mismatch — computed:", computed, "received:", hmacHeader);
      return res.status(401).json({ error: "Invalid signature" });
    }
    console.log("[yampi-webhook] HMAC validated OK");
  }
}
```

3. **Melhorar logs**: adicionar log no início com IP e evento antes de qualquer validação.

## Arquivos alterados

- `deploy/backend/src/index.ts` — adicionar `verify` no `express.json()`
- `deploy/backend/src/routes/yampi-webhook.ts` — usar `rawBody` no HMAC + melhorar logs

## Deploy

```bash
cd ~/simplificandoconversas/deploy && docker compose up -d --build backend
```

## Diagnóstico adicional na VPS

Após o deploy, testar externamente para confirmar que o endpoint está acessível:

```bash
curl -s -w "\n%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -d '{"event":"test.ping","resource":{}}' \
  https://api.chatbotsimplificado.com/functions/v1/yampi-webhook
```

Se retornar 200, o problema era HMAC. Monitorar os logs para ver os próximos eventos reais da Yampi.

