## Diagnóstico (confirmado pelo grep do container)

O container **continua com a versão antiga** do `payment.ts`:

```
/app/src/routes/payment.ts:407:  await supabase.from("conversations").upsert(
```

Mas o repo já tem só o comentário de aviso (`payment.ts:402`). Conclusão: **o `update.sh` rodado anteriormente NÃO rebuildou a imagem** (Docker Swarm + cache de layer não invalidaram). Por isso o boleto continua criando card vazio — a transação `d567ef0a` da Rosemeri criou conversa 20ms depois, exatamente o padrão do upsert antigo.

PIX parou de criar card só porque, por coincidência, os PIX recentes vieram de telefones que já tinham conversa real. O bug do payment.ts atinge boleto e PIX igual — só não vimos PIX órfão nessa janela.

Além disso, identifiquei **outro ponto que cria conversas com instância correta** mas em massa, sem mensagem real: `light-sync.ts:117` e `:186`. Não é o causador das órfãs de boleto (ele preenche `instance_name`), mas é o que polui o Chat ao Vivo com contatos sem conversa real do `findChats`/`findContacts`. Vou tratar à parte (opcional, depende do que você quer).

## O que fazer

### 1. Deletar fisicamente o bloco upsert no container (hot patch via sed)

O repo já está correto — o problema é só o container. Patch direto no `/app/src/routes/payment.ts` dentro do container, depois reinício do serviço, sem depender de build:

```bash
BK=$(docker ps --format '{{.Names}}' | grep '^simplificando_backend\.' | head -1)

# Confirmar antes
docker exec $BK sed -n '400,420p' /app/src/routes/payment.ts

# Patch: remove o bloco "await supabase.from('conversations').upsert(...)" (linhas 405-413 aprox)
docker exec $BK sh -c "sed -i '/await supabase\.from(\"conversations\")\.upsert(/,/);/d' /app/src/routes/payment.ts"

# Confirmar depois
docker exec $BK grep -n 'conversations' /app/src/routes/payment.ts
```

Esperado: só restar `payment.ts:178` (comentário) e `:184` (select de email). Sem mais `upsert`.

> **Importante:** o backend roda com `tsx` ou compila no start? Preciso confirmar com você. Se rodar com `tsx`/`ts-node` (lê o `.ts` direto), reiniciar o container já aplica. Se rodar `dist/` compilado, o sed também precisa rodar em `/app/dist/routes/payment.js` — vou te dar os dois comandos.

### 2. Reiniciar o serviço para o patch ter efeito

```bash
docker service update --force simplificando_backend
```

### 3. Resolver o root cause: rebuild de verdade

O `update.sh` provavelmente está só fazendo `docker service update` sem `--build` ou sem invalidar cache. Vou inspecionar `deploy/update.sh` e ajustar para forçar:

```bash
docker compose -f deploy/docker-compose.yml build --no-cache backend
docker service update --force --image <nova-tag> simplificando_backend
```

(ou equivalente em Swarm — depende do fluxo atual do seu `update.sh`).

### 4. Cleanup das órfãs novas (4 da última hora)

```sql
DELETE FROM public.conversations c
WHERE (c.instance_name IS NULL OR c.instance_name = '')
  AND NOT EXISTS (SELECT 1 FROM public.messages m WHERE m.conversation_id = c.id)
  AND c.created_at > now() - interval '6 hours';
```

### 5. (Opcional) Decisão sobre `light-sync.ts`

O `light-sync` puxa **todos** os chats/contatos do Baileys e cria conversas em massa, mesmo que o usuário nunca tenha conversado com aquele contato no app. Isso enche o Chat ao Vivo de "contatos fantasma" do telefone do cliente. Se você quiser, posso:
- (a) Desativar o `light-sync` por completo (recomendado se você não usa).
- (b) Mantê-lo, mas só upsertar quando `lastMessage` existir de verdade.

Me diga qual.

## Resumo executivo

1. Hot patch no container (`sed -i`) remove o upsert imediatamente, sem esperar build.
2. Reinício do service aplica.
3. Conserto do `update.sh` evita que isso volte no próximo deploy.
4. Cleanup das 4 órfãs recentes.
5. Decisão pendente sobre `light-sync`.

Aprova pra eu te entregar os comandos finais já com confirmação se é `tsx` ou `dist/`?
