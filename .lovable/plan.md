

# Fix: Download do PDF do boleto falha por falta de User-Agent

## Diagnóstico

O n8n baixa o PDF com sucesso da mesma URL (`external_resource_url`). A diferença é que o `fetch` do Node.js no backend não envia um `User-Agent` de navegador, e o Mercado Pago retorna HTML (página de redirect) em vez do PDF para requests sem User-Agent válido.

O código atual envia apenas `Accept: application/pdf`, o que não é suficiente.

## Correção

Em `deploy/backend/src/routes/payment.ts`, na função `downloadAndSaveBoletoPdf`, adicionar headers que simulam um navegador real:

```typescript
const pdfResp = await fetch(paymentUrl, {
  headers: {
    "Accept": "application/pdf,*/*",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  },
  redirect: "follow",
});
```

Também adicionar log do content-type e tamanho para diagnóstico:

```typescript
console.log(`[payment] PDF response: status=${pdfResp.status}, content-type=${contentType}, size=${buffer.length}`);
```

## Arquivo

| Arquivo | Alteração |
|---------|-----------|
| `deploy/backend/src/routes/payment.ts` | Adicionar User-Agent de navegador na função `downloadAndSaveBoletoPdf` |

## VPS

```bash
cd ~/simplificandoconversas/deploy && docker compose up -d --build backend
```

Depois de criar um boleto de teste:
```bash
docker logs $(docker ps --format '{{.Names}}' | grep backend | head -n 1) 2>&1 | grep -i "boleto PDF" | tail -10
```

