

## Objetivo
Adicionar opção "Usar número da instância de envio" no card de contato do `GroupScheduledMessageForm`. Quando ativa, o número manual fica desabilitado e o backend resolve dinamicamente o telefone da instância no momento do envio.

## Investigação rápida necessária

1. Ver o bloco de "contact" no `GroupScheduledMessageForm.tsx` (campos `contactName`, `contactPhone`).
2. Ver onde a `instance` da campanha está disponível no form (passada via prop ou do `selectedCampaign`).
3. Ver como `groups-api.ts` (branch contact) lê hoje o `content` para incluir o novo flag.
4. Ver se já existe util backend `whatsapp-proxy` ou Evolution `/instance/fetchInstances` que retorne o número conectado da instância.

## Mudanças

### Frontend — `src/components/grupos/GroupScheduledMessageForm.tsx`
- Adicionar estado `useInstanceNumber: boolean` (default `false`).
- No bloco de contato, adicionar Switch "Usar número da instância de envio" acima dos inputs.
- Quando `useInstanceNumber=true`:
  - Input `contactPhone` fica `disabled` e mostra placeholder "Número da instância (resolvido no envio)".
  - Input `contactName` permanece editável (default: nome amigável da instância) — opcionalmente também pode ter toggle, mas mantém manual por padrão.
  - Validação do submit ignora exigência de `contactPhone`.
- Salvar no `content`: `{ contactName, contactPhone, useInstanceNumber: true }`.

### Backend — `deploy/backend/src/routes/groups-api.ts` (branch `contact`)
- Se `content.useInstanceNumber === true`:
  - Buscar número da instância via Evolution: `GET ${baseUrl}/instance/fetchInstances?instanceName=${instanceName}` → extrair `instance.owner` (ou `instance.profileName`/`number` dependendo da resposta v2).
  - Strip `@s.whatsapp.net`, garantir só dígitos.
  - Usar como `phoneNumber` e `wuid`.
  - Se `contactName` vazio, usar `instance.profileName` como fallback.
- Caso contrário, mantém fluxo atual (manual).

### Cache opcional (refinamento, não bloqueante)
Buscar a cada envio é OK (poucas chamadas). Sem cache adicional nesta primeira versão.

## Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| `src/components/grupos/GroupScheduledMessageForm.tsx` | Switch + campo desabilitado + persistência do flag `useInstanceNumber` |
| `deploy/backend/src/routes/groups-api.ts` | Branch contact resolve telefone via `/instance/fetchInstances` quando `useInstanceNumber=true` |

## Comandos VPS pós-deploy
```bash
cd ~/simplificandoconversas && git pull && cd deploy && docker compose up -d --build backend
```

Sem necessidade de reprocessar nada — é feature nova.

