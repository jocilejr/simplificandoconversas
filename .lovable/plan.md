
## Causa raiz (confirmada)

`deploy/backend/src/routes/payment.ts` — endpoint `POST /api/payment` que **gera boleto/PIX no Mercado Pago** — faz, ao final, um `upsert` em `conversations` com `instance_name: null`:

```ts
// Upsert conversation if phone provided
if (customer_phone) {
  const phone = customer_phone.replace(/\D/g, "");
  const remoteJid = `${phone}@s.whatsapp.net`;
  await supabase.from("conversations").upsert(
    { user_id, workspace_id, remote_jid, contact_name, phone_number, email, instance_name: null },
    { onConflict: "user_id,remote_jid,instance_name" }
  );
}
```

Por isso a conversa da **Rosemeri** nasceu 20ms depois da transação, com `instance_name = ''`. Esse upsert é o gerador das 282 órfãs.

> Observação: o repo do Lovable (`deploy/backend/src/routes/payment.ts`) atualmente só tem o `select` (linha 184). O container em produção tem uma versão divergente que ainda contém o `upsert`. O plano abaixo deixa o repo coerente e remove o upsert independente do estado atual do arquivo.

## Plano

### 1. Remover o upsert em `conversations` no `payment.ts`

Editar `deploy/backend/src/routes/payment.ts` e **deletar o bloco inteiro** "Upsert conversation if phone provided" que vem após `dispatchRecovery`. Conversas devem nascer apenas via:
- `whatsapp-proxy.ts` (mensagem enviada manualmente pelo Chat ao Vivo)
- webhook do Baileys em `webhook.ts` (mensagem recebida)
- `execute-flow.ts` (envio automático do chatbot)

Esses três já fazem upsert com `instance_name` correto. Nenhuma criação a partir de transação.

### 2. Verificar se há o mesmo padrão em outros webhooks

Inspecionar dentro do container e remover, se encontrado, o mesmo padrão em:
- `yampi-webhook.ts`
- `manual-payment-webhook.ts`
- `payment-openpix.ts`

(Pelo grep anterior no repo, eles só inserem em `transactions`, mas o container pode estar divergente. Vou rodar o mesmo `grep` no container antes de editar.)

### 3. Filtro defensivo no Chat ao Vivo

Atualizar três queries para ignorar conversas sem instância:
- `src/hooks/useConversationsLive.ts`
- `src/hooks/useCrossInstanceConversations.ts`
- `deploy/backend/src/routes/extension-api.ts`

Adicionar `.not('instance_name', 'is', null).neq('instance_name', '')`.

Isso protege a UI mesmo se algum código novo voltar a inserir órfãs.

### 4. Cleanup das 282 órfãs (executado pelo usuário na VPS)

```sql
DELETE FROM public.conversations c
WHERE (c.instance_name IS NULL OR c.instance_name = '')
  AND NOT EXISTS (
    SELECT 1 FROM public.messages m WHERE m.conversation_id = c.id
  );
```

(Já confirmamos: 282 sem mensagens, 0 com mensagens — então o DELETE é seguro.)

### 5. Deploy

Após eu editar o repo, você roda na VPS:
```bash
cd /opt/simplificandoconversas && ./update.sh
```
O `update.sh` rebuilda o `simplificando_backend` e o novo `payment.ts` para de criar conversas.

## Resumo executivo

- **Antes:** boleto/PIX gerado pelo app → cria transação → cria card vazio no Chat ao Vivo.
- **Depois:** boleto/PIX gerado pelo app → cria só transação. Card só aparece quando uma mensagem real for enviada (recuperação) ou recebida.
- **Importação CSV de leads:** preservada — continua acessível pela página de Leads.
- **Funcionalidade de recuperação automática (`dispatchRecovery`):** preservada — quando a recuperação realmente disparar a mensagem, o `whatsapp-proxy` cria a conversa com `instance_name` correto.

Aprova para eu aplicar?
