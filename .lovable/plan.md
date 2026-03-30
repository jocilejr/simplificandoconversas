

## Fix: TypeScript Error in external-webhook.ts

**Problem**: Line 205 — `sendData` is typed as `unknown` (from `.json()`), so accessing `.key?.id` fails TypeScript strict checks.

**Fix**: Cast `sendData` to `any` on line 204:

```typescript
const sendData: any = await sendResult.json();
```

Single line change in `deploy/backend/src/routes/external-webhook.ts`, line 204.

After fix, rebuild:
```bash
cd /root/simplificandoconversas/deploy && docker compose up -d --build backend
```

