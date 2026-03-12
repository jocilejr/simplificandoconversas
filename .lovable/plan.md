## Problema

As fotos de perfil nao estao sendo puxadas. A logica atual depende do hook `useContactPhotos` no frontend, que chama a edge function `whatsapp-proxy` com `fetch-profile-pictures`. Problemas identificados:

1. Para contatos `@lid`, o backend envia `number: jid.split("@")[0]` para a Evolution API, que nao e um numero de telefone valido -- a API nao consegue resolver.
2. O fetch de fotos e lazy (so acontece quando o usuario abre a tela de conversas), em vez de ser persistido durante o sync.
3. Nao ha logica para usar `phone_number` quando disponivel no lugar do `@lid`.

## Solucao

Buscar e persistir fotos de perfil **durante o sync-chats** no backend, armazenando na tabela `contact_photos`. O frontend continua lendo do cache (banco), mas o backend garante que as fotos estao la.

## Alteracoes

### 1. `deploy/backend/src/routes/whatsapp-proxy.ts` — sync-chats

Apos sincronizar cada contato, buscar a foto de perfil via Evolution API e salvar na tabela `contact_photos`:

- Usar `phone_number` quando disponivel (contatos `@s.whatsapp.net` ou `@lid` com numero resolvido)
- Para `@lid` sem numero, tentar com o lid mesmo (pode funcionar em alguns casos)
- Fazer upsert em `contact_photos` com `onConflict: "user_id,remote_jid"`
- Processar em batches de 3 para nao sobrecarregar a Evolution API
- Pular contatos que ja tem foto no banco (verificar `contact_photos` antes)

### 2. `deploy/backend/src/routes/whatsapp-proxy.ts` — fetch-profile-picture (single)

Corrigir para usar `phone_number` da conversa quando o JID e `@lid`:

- Buscar a conversa no banco para obter `phone_number`
- Se tiver `phone_number`, usar ele na chamada da Evolution API
- Senao, tentar com o JID original

### 3. `deploy/backend/src/routes/whatsapp-proxy.ts` — fetch-profile-pictures (batch)

Mesma correcao: para cada JID que e `@lid`, buscar o `phone_number` correspondente no banco antes de chamar a Evolution API.

### 4. `src/hooks/useContactPhoto.ts` — Ajuste no hook de background refresh

- Aumentar o `staleTime` para 24h (fotos raramente mudam)
- Manter o fallback via API para contatos que o sync nao cobriu

### Resultado

- Sync-chats puxa e persiste fotos automaticamente
- Contatos `@lid` usam `phone_number` para buscar foto quando disponivel
- Fotos ficam no banco e so atualizam quando o sync roda novamente
- Frontend carrega instantaneamente do cache