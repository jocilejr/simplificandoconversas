

# Separar completamente a recuperação por tipo de transação

## Problema atual
1. O backend (`recovery-dispatch.ts`) usa **uma única tabela** (`boleto_recovery_templates`) para TODOS os tipos — PIX/Cartão recebe 3 blocos (text+pdf+image) quando deveria receber apenas 1 texto
2. A aba "Carrinhos" diz "yampi-abandonados" mas recebe rejeitados de qualquer origem (Mercado Pago, etc.), não só Yampi
3. A aba "Carrinhos" não tem ⚙️ para configurar mensagem de recuperação
4. O `getRecoveryMessage()` no frontend trata tudo que não é boleto como PIX — sem mensagem própria para carrinhos/rejeitados
5. O `encodeURIComponent` não é aplicado no nome da instância, causando 404 na Evolution API

## Solução

### 1. Migração SQL — adicionar `recovery_message_abandoned` na tabela `profiles`

```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS recovery_message_abandoned text DEFAULT NULL;
```

Novo campo para a mensagem da aba de Rejeitados/Abandonados, independente das outras.

### 2. Renomear aba "Carrinhos" → "Rejeitados" no frontend

**`src/components/transactions/TransactionsTable.tsx`**:
- Tipo `TabKey`: renomear `yampi-abandonados` → `rejeitados` (ou manter a key e só trocar o label)
- Label da tab: "Carrinhos" → "Rejeitados/Abandonados"
- Adicionar ⚙️ `RecoverySettingsDialog` com `type="abandoned"` para essa aba

### 3. Expandir `RecoverySettingsDialog` para 3 tipos

**`src/components/transactions/RecoverySettingsDialog.tsx`**:
- Props `type`: `"boleto" | "pix" | "abandoned"`
- Mapear `abandoned` → campo `recovery_message_abandoned` na `profiles`
- Mensagem padrão para abandonados: texto genérico de carrinho abandonado
- Cada tipo lê/salva em seu campo exclusivo na `profiles`

### 4. Backend: cada tipo busca sua própria mensagem

**`deploy/backend/src/lib/recovery-dispatch.ts`** — refatorar o passo 6 (carregamento de template):

```text
if (txType === "boleto") {
  // Manter: carrega boleto_recovery_templates com is_default=true
  // Blocos: text, pdf, image — como hoje
} else {
  // PIX/Cartão ou Yampi/Rejeitado: carrega mensagem da profiles
  const fieldKey = (txType === "yampi_cart" || txType === "yampi") 
    ? "recovery_message_abandoned" 
    : "recovery_message_pix";
  
  const { data: profile } = await sb
    .from("profiles")
    .select(fieldKey)
    .eq("user_id", opts.userId)
    .maybeSingle();
  
  const message = profile?.[fieldKey] || DEFAULT_MESSAGE;
  blocks = [{ id: "profile-text", type: "text", content: message }];
}
```

Resultado: **Boleto** usa template multi-bloco. **PIX/Cartão** usa `recovery_message_pix`. **Abandonado/Rejeitado** usa `recovery_message_abandoned`. Nenhum tipo interfere no outro.

### 5. Fix `encodeURIComponent` na Evolution API

**`deploy/backend/src/lib/recovery-dispatch.ts`** — nos 3 `fetch()` dentro de `sendBlock()`:
- `sendText/${encodeURIComponent(instanceName)}`
- `sendMedia/${encodeURIComponent(instanceName)}` (pdf)
- `sendMedia/${encodeURIComponent(instanceName)}` (image)

### 6. Frontend: `getRecoveryMessage()` com 3 caminhos

```text
if (tab === "boletos-gerados") → recovery_message_boleto
if (tab === "pix-cartao-pendentes") → recovery_message_pix  
if (tab === "rejeitados") → recovery_message_abandoned
```

### 7. `AutoRecoveryConfig.tsx` — renomear label

"Carrinhos Yampi" → "Rejeitados/Abandonados"

## Arquivos alterados
1. **Migração SQL** — `ALTER TABLE profiles ADD COLUMN recovery_message_abandoned`
2. **`src/components/transactions/RecoverySettingsDialog.tsx`** — suportar type `abandoned`
3. **`src/components/transactions/TransactionsTable.tsx`** — renomear aba, adicionar ⚙️, ajustar `getRecoveryMessage`
4. **`src/components/transactions/AutoRecoveryConfig.tsx`** — renomear label
5. **`src/hooks/useProfile.ts`** — incluir novo campo no type (se necessário)
6. **`deploy/backend/src/lib/recovery-dispatch.ts`** — lógica de template por tipo + encodeURIComponent

## Deploy
```bash
cd ~/simplificandoconversas/deploy && docker compose up -d --build backend
```

