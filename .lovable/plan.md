

# Fix TypeScript errors in payment.ts

The `fetch().json()` method returns `unknown` in strict TypeScript. The fix is to cast `mpData` as `any` in all three places where it's used.

## File: `deploy/backend/src/routes/payment.ts`

Three changes needed — cast the result of `.json()` to `any`:

1. **Line ~98** (in `/create`): `const mpData = await mpResp.json();` → `const mpData: any = await mpResp.json();`
2. **Line ~196** (in `/webhook`): `const mpData = await mpResp.json();` → `const mpData: any = await mpResp.json();`
3. **Line ~249** (in `/status/:transactionId`): `const mpData = await mpResp.json();` → `const mpData: any = await mpResp.json();`

This is a one-line-per-location fix. The backend `tsconfig.json` has `strict: false` but `fetch` response typing still defaults to `unknown` for `.json()`.

