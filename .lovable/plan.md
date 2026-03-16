

## Plano: Desativar IA Responde quando contexto de parada for atingido

### Comportamento desejado
Quando a IA detectar que a mensagem do contato se encaixa em um "contexto de não resposta" (ex: "já paguei"), ela deve **desativar o toggle "IA Responde"** para aquele contato (deletar o registro de `ai_auto_reply_contacts`), e não apenas silenciar naquela mensagem.

### Alterações

**1. Banco de dados — nova coluna na `ai_config`**

Migration para adicionar `reply_stop_contexts`:
```sql
ALTER TABLE ai_config ADD COLUMN IF NOT EXISTS reply_stop_contexts text DEFAULT '';
```

Também atualizar `deploy/init-db.sql` para incluir a coluna.

**2. Backend — `deploy/backend/src/routes/webhook.ts` (função `checkAndAutoReply`)**

- Carregar `reply_stop_contexts` do `config` (já carregado na linha 592)
- Se houver contextos de parada, injetar no prompt: instruir o modelo a retornar `[HUMAN_NEEDED]` quando detectar essas situações
- Após receber a resposta do modelo, se for `[HUMAN_NEEDED]`:
  - **Deletar** o registro de `ai_auto_reply_contacts` para aquele `user_id` + `remote_jid` (desativa o toggle)
  - Não enviar mensagem
  - Retornar sem fazer nada

```typescript
// Após obter reply (linha 643):
if (reply.trim() === "[HUMAN_NEEDED]") {
  // Desativar IA Responde para este contato
  await supabase.from("ai_auto_reply_contacts").delete()
    .eq("user_id", userId).eq("remote_jid", remoteJid);
  console.log(`[ai-reply] Disabled for ${remoteJid} — human needed`);
  return;
}
```

**3. Frontend — `src/components/settings/AISection.tsx`**

Adicionar campo "Contextos de Não Resposta" na seção "IA Responde":
- Textarea com placeholder explicativo
- Salvar junto com os outros campos via `updateConfig.mutate`

**4. Hook — `src/hooks/useAIConfig.ts`**

Adicionar `reply_stop_contexts` ao tipo aceito pelo `mutationFn`.

**5. Extensão — sem mudanças de código**

O toggle já reflete o estado da API. Quando o registro for deletado no banco, na próxima consulta `GET /ai-status` o toggle aparecerá desligado automaticamente. Se a extensão já estiver aberta, o toggle atualizará no próximo polling.

### Resumo do fluxo
1. Contato envia "já paguei" → webhook chama `checkAndAutoReply`
2. Modelo recebe prompt com contextos de parada → retorna `[HUMAN_NEEDED]`
3. Backend deleta registro em `ai_auto_reply_contacts` → toggle desativa
4. Nenhuma mensagem é enviada ao contato
5. Na extensão, o toggle "IA Responde" aparece desligado

