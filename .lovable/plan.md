

## Fix: TypeScript compilation errors in webhook.ts

Two lines need `as any` casts on the `.json()` response from OpenAI fetch calls — same pattern already used elsewhere in this backend.

### Changes in `deploy/backend/src/routes/webhook.ts`:

**Line 642** — in `checkAndAutoReply`:
```typescript
// Before:
const completion = await openaiRes.json();
// After:
const completion = await openaiRes.json() as any;
```

**Line 761** — in `checkAndAutoListen`:
```typescript
// Before:
const completion = await openaiRes.json();
// After:
const completion = await openaiRes.json() as any;
```

That's it — two one-word additions. After this, re-run `bash update.sh`.

