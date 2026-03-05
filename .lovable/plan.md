

## Fix: Backend TypeScript compilation failing

The `npx tsc` step fails but Docker doesn't show the specific TypeScript errors. The most likely causes are:

1. **`atob` usage in `webhook.ts` line 54** — `atob` is a browser/DOM API. With `"lib": ["ES2022"]` only, TypeScript doesn't include DOM types. Node 20 has `atob` at runtime but the types aren't included without `"DOM"` in lib.

2. **Potential other type mismatches** across the 561-line `execute-flow.ts` and other files.

### Changes

**`deploy/backend/tsconfig.json`** — Two fixes:
- Add `"DOM"` to the `lib` array so `atob`, `fetch`, and other globals are typed
- Ensure `skipLibCheck` is true (already set)

```json
"lib": ["ES2022", "DOM"]
```

**`deploy/backend/src/routes/webhook.ts`** (safer alternative) — Replace `atob` + manual byte conversion (line 54-58) with Node-native `Buffer.from(base64, "base64")`, matching how `evolution-proxy.ts` already does it:

```typescript
const buffer = Buffer.from(base64, "base64");
const bytes = new Uint8Array(buffer);
```

Both changes together ensure the build works regardless of lib configuration.

