

## Plano: Salvar últimas mensagens como contexto do lembrete

### Problema
Atualmente a IA gera um resumo interpretado como `description` do lembrete, o que tira o contexto real. O usuário quer ver as **mensagens originais** do contato.

### Solução

**`deploy/backend/src/routes/webhook.ts`** — Na função `handleAIListen`, antes de chamar a OpenAI:

1. Buscar as últimas N mensagens (ex: 5) da tabela `messages` para o `remote_jid` + `user_id`, ordenadas por `created_at DESC`
2. Formatar como texto simples: `"[hora] nome: mensagem"` por linha
3. Ao inserir o reminder, usar essas mensagens formatadas como `description` em vez do `args.description` gerado pela IA
4. Remover o campo `description` do tool calling (`create_reminder`), já que a IA não precisa mais gerar isso

### Alteração (linhas ~811-822)

```typescript
const args = JSON.parse(toolCall.function.arguments);

// Fetch last messages as context
const { data: lastMsgs } = await supabase
  .from("messages")
  .select("content, from_me, created_at")
  .eq("remote_jid", remoteJid)
  .eq("user_id", userId)
  .order("created_at", { ascending: false })
  .limit(5);

const contextLines = (lastMsgs || [])
  .reverse()
  .map(m => {
    const time = new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
    const sender = m.from_me ? "Você" : (contactName || phone);
    return `[${time}] ${sender}: ${m.content}`;
  })
  .join("\n");

await supabase.from("reminders").insert({
  user_id: userId,
  title: args.title,
  description: contextLines || null,  // mensagens reais, não resumo da IA
  due_date: args.due_date,
  remote_jid: remoteJid,
  phone_number: phone,
  contact_name: contactName || null,
  instance_name: instanceName,
});
```

Também remover `description` do schema do tool `create_reminder` (linha 782) para que a IA não gaste tokens gerando um resumo desnecessário.

