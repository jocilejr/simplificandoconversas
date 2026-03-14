

## Fix: TS2698 Spread error in extension-api.ts

The TypeScript compiler rejects `...result` because `executeRes.json()` returns `unknown` in Node 22 types. The fix is to cast the result.

### Change in `deploy/backend/src/routes/extension-api.ts`

**Line 159-160**: Cast `.json()` result to `any`:
```typescript
const result = await executeRes.json() as any;
res.json({ ok: true, ...result });
```

One line change, one file.

