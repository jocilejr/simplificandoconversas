

## Diagnóstico

Card "contact" (5 grupos, 5 falhas) tem o mesmo bug raiz que áudio: `groups-api.ts` no dispatch trata `contact` como mídia genérica e cai em `/message/sendMedia`, mas Evolution exige endpoint específico `/message/sendContact` com payload diferente (`{ number, contact: [{ fullName, wuid, phoneNumber }] }`).

Preciso confirmar na VPS:

```bash
docker exec deploy-postgres-1 psql -U postgres -d postgres -c "
SELECT id, group_jid, error_message, content
FROM group_message_queue
WHERE message_type='contact' AND status='failed'
  AND created_at > now() - interval '24 hours'
ORDER BY created_at DESC LIMIT 5;" | cat
```

E olhar o trecho atual:
```bash
sed -n '1230,1290p' ~/simplificandoconversas/deploy/backend/src/routes/groups-api.ts
```

## Fix proposto

`deploy/backend/src/routes/groups-api.ts` — adicionar branch para `contact` antes do `else` genérico:

```typescript
} else if (item.message_type === "contact") {
  // content esperado: { fullName, phoneNumber, organization?, email? }
  // ou array { contacts: [{...}] }
  const contacts = Array.isArray(content.contacts) 
    ? content.contacts 
    : [{
        fullName: content.fullName || content.name || "",
        wuid: (content.phoneNumber || content.phone || "").replace(/\D/g, ""),
        phoneNumber: content.phoneNumber || content.phone || "",
        organization: content.organization || "",
        email: content.email || "",
      }];
  
  if (!contacts[0]?.fullName || !contacts[0]?.phoneNumber) {
    throw new Error(`invalid_contact_data: ${JSON.stringify(content)}`);
  }
  
  const r = await fetch(`${baseUrl}/message/sendContact/${encoded}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: apiKey },
    body: JSON.stringify({ number: item.group_jid, contact: contacts, mentionsEveryOne }),
  });
  if (!r.ok) throw new Error(await r.text());
}
```

## Investigação extra (form de criação)

Verificar como `GroupScheduledMessageForm.tsx` salva contact — qual shape de `content`? Para garantir que o backend leia as chaves certas. Vou ler o form na hora de implementar.

## Comandos VPS pós-fix

```bash
cd ~/simplificandoconversas && git pull && cd deploy && docker compose up -d --build backend

docker exec deploy-postgres-1 psql -U postgres -d postgres -c "
UPDATE group_message_queue
SET status='pending', error_message=NULL, started_at=NULL, completed_at=NULL
WHERE message_type='contact' AND status='failed'
  AND created_at > now() - interval '24 hours';"
```

## Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| `deploy/backend/src/routes/groups-api.ts` | Branch dedicado para `contact` usando `/message/sendContact` |

