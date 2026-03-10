

## Fix: Instance creation doesn't show QR code or appear in list

### Root Cause

Two issues:

1. **No QR code**: Evolution API v2's `/instance/create` does NOT return a QR code in the response. The QR code is only available via `/instance/connect/{name}`. The frontend checks `result?.qrcode?.base64` which is always empty after create.

2. **Instance not appearing**: The `createInstance` mutation's `onSuccess` invalidates queries, but the instance may not appear because the `create-instance` action in the backend upserts with `is_active: false`, and the refetch of remote instances might have a timing issue.

### Fix

**`deploy/backend/src/routes/whatsapp-proxy.ts`** — In the `create-instance` case, after creating the instance, automatically call `/instance/connect/{name}` to get the QR code:

```typescript
case "create-instance": {
  const newName = `sc-${Date.now().toString(36)}`;
  const createResult = await evolutionRequest("/instance/create", "POST", { instanceName: newName });
  await serviceClient.from("whatsapp_instances").upsert(
    { user_id: userId, instance_name: newName, status: "close", is_active: false },
    { onConflict: "user_id,instance_name" }
  );
  // Fetch QR code via connect endpoint
  let connectResult: any = {};
  try {
    connectResult = await evolutionRequest(`/instance/connect/${encodeURIComponent(newName)}`, "GET");
  } catch {}
  result = { ...createResult, ...connectResult, instanceName: newName };
  break;
}
```

**`src/components/settings/ConnectionsSection.tsx`** — Improve QR code extraction to handle more response formats and ensure the instance list refreshes:

```typescript
const handleCreateInstance = async () => {
  const result = await createInstance.mutateAsync();
  const base64 = result?.qrcode?.base64 || result?.base64;
  if (base64) {
    setQrCode({ instanceName: result.instanceName, base64 });
  }
};
```

### Summary

The backend will now automatically connect after creating, returning the QR code in the same response. The frontend already handles both `qrcode.base64` and `base64` formats in `handleConnect`, but `handleCreateInstance` was only checking `qrcode.base64`.

