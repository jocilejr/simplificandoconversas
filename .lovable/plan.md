

## Fix: QR Code not showing when clicking "Conectar"

### Root Cause
The backend returns the QR code in the structure `{ qrcode: { base64: "..." } }`, but the UI checks for `result?.base64` instead of `result?.qrcode?.base64`.

### Change
**`src/components/settings/ConnectionsSection.tsx`** — Fix the `handleConnect` function:

```typescript
// Current (broken):
if (result?.base64) {
  setQrCode({ instanceName, base64: result.base64 });
}

// Fixed:
if (result?.qrcode?.base64) {
  setQrCode({ instanceName, base64: result.qrcode.base64 });
}
```

Single line fix in one file.

