

## Plano: IA Escuta ativa por padrão para todos os contatos sem fluxo ativo

### Situação atual
- A IA Escuta só funciona se existir um registro na tabela `ai_listen_contacts` com `enabled=true` para aquele contato específico
- Na extensão, o toggle "IA Escuta" começa desligado até o usuário ativar manualmente
- Isso exige ativação manual contato por contato

### Mudanças

**1. Backend — `deploy/backend/src/routes/webhook.ts` (função `checkAndAutoListen`)**

Inverter a lógica: em vez de exigir um registro `ai_listen_contacts` com `enabled=true`, verificar se existe um registro com `enabled=false` (opt-out). Se não houver registro ou se `enabled=true`, a escuta funciona.

Também adicionar verificação de fluxo ativo — se o contato tem fluxo ativo, pular a escuta:

```
// Substituir linhas 679-688 por:
// Check if user explicitly disabled listen for this contact
const { data: aiListenOff } = await supabase
  .from("ai_listen_contacts")
  .select("id")
  .eq("user_id", userId)
  .eq("remote_jid", remoteJid)
  .eq("enabled", false)
  .maybeSingle();

if (aiListenOff) return; // User explicitly disabled

// Skip if contact has active flow
const { data: activeFlows } = await supabase
  .from("flow_executions")
  .select("id")
  .eq("user_id", userId)
  .eq("remote_jid", remoteJid)
  .in("status", ["running", "waiting", "waiting_click", "waiting_reply"])
  .limit(1);

if (activeFlows && activeFlows.length > 0) return;
```

**2. Backend — `deploy/backend/src/routes/extension-api.ts` (GET ai-status)**

Alterar a resposta do endpoint `ai-status` (linhas 542-546): retornar `listen: true` por padrão quando não existe registro (em vez de `false`). Retornar `false` apenas se existir registro com `enabled=false`:

```
listen: listenRes.data ? listenRes.data.enabled : true,  // default true
```

**3. Backend — `deploy/backend/src/routes/extension-api.ts` (POST ai-listen-toggle)**

Ajustar a lógica do toggle (linhas 594-624): quando desativado, fazer upsert com `enabled=false` em vez de deletar o registro. Quando ativado, deletar o registro (volta ao padrão ativo):

```
if (enabled) {
  // Remove opt-out record (default is enabled)
  await sb.from("ai_listen_contacts").delete()
    .eq("user_id", userId).eq("remote_jid", remoteJid);
} else {
  // Insert opt-out record
  await sb.from("ai_listen_contacts").upsert({
    user_id: userId, remote_jid: remoteJid,
    instance_name: instanceName, enabled: false,
  }, { onConflict: "user_id,remote_jid,instance_name" });
}
```

**4. Extensão — `chrome-extension/content.js`**

Nenhuma mudança necessária na extensão. O toggle já renderiza com base no valor retornado pela API (`aiListenEnabled`). Como a API agora retorna `true` por padrão, o toggle já aparecerá ativo automaticamente.

### Resumo do comportamento novo
- **Sem registro na tabela** → IA Escuta ATIVA (padrão)
- **Registro com `enabled=false`** → IA Escuta DESATIVADA (opt-out explícito)
- **Contato com fluxo ativo** → IA Escuta PULADA (mesmo se ativa)
- **Toggle na extensão** → Começa ligado por padrão

