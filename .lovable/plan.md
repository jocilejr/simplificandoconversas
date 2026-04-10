

## Problema

Todos os links de acesso gerados no sistema usam o formato antigo `${domain}/${phone}` em vez do novo formato `${domain}/a/entrega/${phone}`.

## Arquivos afetados (4 pontos de geração de URL)

1. **`src/components/leads/LeadDetailDialog.tsx`** (linha 294)
   - Atual: `` `${domain.replace(/\/$/, "")}/${normalized}` ``
   - Novo: `` `${domain.replace(/\/$/, "")}/a/entrega/${normalized}` ``

2. **`src/components/membros/MemberClientCard.tsx`** (linha 66)
   - Atual: `` `${memberDomain.replace(/\/$/, "")}/${normalizePhone(phone)}` ``
   - Novo: `` `${memberDomain.replace(/\/$/, "")}/a/entrega/${normalizePhone(phone)}` ``

3. **`src/components/entrega/LinkGenerator.tsx`** (linha 201)
   - Atual: `` `${domain.replace(/\/$/, "")}/${normalized}` ``
   - Novo: `` `${domain.replace(/\/$/, "")}/a/entrega/${normalized}` ``

4. **`src/components/entrega/DeliveryFlowDialog.tsx`** (linha 313)
   - Atual: `` `${domain.replace(/\/$/, "")}/${normalized}` ``
   - Novo: `` `${domain.replace(/\/$/, "")}/a/entrega/${normalized}` ``

## Alteração

Trocar `/${phone}` por `/a/entrega/${phone}` nos 4 arquivos. Mudança simples de string template em cada um.

Após o deploy na VPS, todos os links gerados passarão a usar o novo formato.

