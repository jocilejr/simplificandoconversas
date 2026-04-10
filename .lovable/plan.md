

## Reverter URLs para formato `domain/phone`

O formato `/:phone` já funciona na VPS, então vamos reverter os 4 arquivos para gerar links no formato simples.

### Alterações

1. **`src/components/leads/LeadDetailDialog.tsx`** — reverter para `` `${domain}/${normalized}` ``
2. **`src/components/membros/MemberClientCard.tsx`** — reverter para `` `${memberDomain}/${normalizePhone(phone)}` ``
3. **`src/components/entrega/LinkGenerator.tsx`** — reverter para `` `${domain}/${normalized}` ``
4. **`src/components/entrega/DeliveryFlowDialog.tsx`** — reverter para `` `${domain}/${normalized}` ``

Remover `/a/entrega` do template de URL em cada arquivo. Mudança de uma linha em cada.

