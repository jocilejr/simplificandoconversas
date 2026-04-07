

# Fix: Boleto PDF Not Saving + Webhook Overwriting Metadata + Wrong URL

## 3 Problems Found

### Problem 1: PDF save silently fails
The code at `payment.ts:175-192` tries to save the PDF but if it fails (network issue, empty `paymentUrl`, etc.), it just logs a warning and continues. The filesystem listing confirms: **no `boletos/` folder exists** — meaning it never saved successfully.

**Likely cause**: The Mercado Pago `ticket_url` may return HTML (a redirect page) instead of a direct PDF download, or the fetch inside the Docker container fails due to DNS/network.

### Problem 2: Webhook overwrites all metadata
At `payment.ts:296-303`, the webhook replaces the entire `metadata` object with only 3 fields, destroying `boleto_file`, `barcode`, and `qr_code`.

### Problem 3: Frontend fetches from wrong domain
At `BoletoQuickRecovery.tsx:137`, it uses `app_public_url` (APP_DOMAIN). But `/media/` is only served on API_DOMAIN (confirmed in `default.conf.template:213`).

## Fixes

### 1. Backend: Make PDF save robust (`deploy/backend/src/routes/payment.ts`)

- Add retry logic and content-type validation when downloading the PDF
- If save fails, still create the transaction but log a clear error
- Add a **separate endpoint** `GET /payment/boleto-pdf/:transactionId` that:
  - Checks if local file exists, serves it
  - If not, tries to fetch from `payment_url`, saves it, then serves it
  - This is a fallback so existing transactions can still get their PDF

### 2. Backend: Merge metadata in webhook (`deploy/backend/src/routes/payment.ts`)

Change webhook to fetch existing metadata first, then merge:
```typescript
const { data: existing } = await supabase
  .from("transactions")
  .select("metadata")
  .eq("external_id", String(paymentId))
  .eq("source", "mercadopago")
  .single();

const existingMeta = (existing?.metadata as any) || {};
const updateData = {
  status: newStatus,
  metadata: {
    ...existingMeta,
    mp_status: mpData.status,
    mp_status_detail: mpData.status_detail,
    payment_method: mpData.payment_method_id,
  },
};
```

### 3. Frontend: Use API domain for PDF URL (`src/components/transactions/BoletoQuickRecovery.tsx`)

Instead of `app_public_url`, use the API base URL derived from `VITE_SUPABASE_URL`:
```typescript
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
// Extract API domain from supabase URL
// Or use the new endpoint: apiUrl(`payment/boleto-pdf/${transaction.id}`)
```

Use the new backend endpoint to fetch the PDF, which handles both cached and on-demand download.

## Files Modified

| File | Change |
|------|--------|
| `deploy/backend/src/routes/payment.ts` | Add retry, content validation, merge metadata in webhook, add boleto-pdf endpoint |
| `src/components/transactions/BoletoQuickRecovery.tsx` | Use API domain / new endpoint for PDF fetch |

## VPS Commands After Deploy

```bash
cd ~/simplificandoconversas/deploy && docker compose up -d --build backend
```

## Diagnostic Commands

After deploying, create a test boleto and then run:
```bash
docker exec -it $(docker ps --format '{{.Names}}' | grep backend | head -n 1) sh -lc 'ls -la /media-files/*/boletos/ 2>/dev/null || echo "No boletos folder yet"'
```

```bash
docker logs $(docker ps --format '{{.Names}}' | grep backend | head -n 1) 2>&1 | grep -i boleto | tail -20
```

