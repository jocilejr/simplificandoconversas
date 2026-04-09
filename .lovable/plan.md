

# Fix: Agrupar leads por últimos 8 dígitos + normalizar exibição

## Problema

O código atual agrupa leads por `remote_jid` exato e filtra números com < 12 dígitos. Isso causa:
- Leads duplicados (`5524992011394` vs `24992011394`)
- Contatos válidos descartados
- Transações de boleto não vinculadas ao lead correto

## Solução — Arquivo único: `src/hooks/useLeads.ts`

### 1. Duas funções de normalização

```typescript
// Match: últimos 8 dígitos (para junção de dados)
const matchKey = (phone: string | null | undefined) =>
  phone ? phone.replace(/\D/g, "").slice(-8) : "";

// Display: normaliza para exibição (55 + DDD + número)
const displayPhone = (raw: string | null | undefined) => {
  if (!raw) return null;
  let phone = raw.replace(/\D/g, "").replace(/^0+/, "");
  if (phone.length >= 10 && phone.length <= 11 && !phone.startsWith("55"))
    phone = "55" + phone;
  return phone || null;
};
```

### 2. Mudanças na montagem dos leads (useMemo)

- **Remover** filtro `jidDigits.length < 12 || > 13` — aceitar qualquer conversa `@s.whatsapp.net` com 8+ dígitos
- **Agrupar por `matchKey`** em vez de `remote_jid`:
  - `map.has(matchKey(remote_jid))` → adiciona instância ao lead existente
  - `map.set(matchKey(remote_jid), lead)` → cria novo lead
- **`phone_number` do lead** usa `displayPhone()` para exibir normalizado
- **`remindersCount`** soma por `matchKey` em vez de `remote_jid` exato

### 3. Tags — match por `matchKey`

Em vez de `map.get(t.remote_jid)`, buscar por `map.get(matchKey(t.remote_jid))`.

### 4. Reminders — indexar por `matchKey`

Trocar `remindersByJid` para indexar por `matchKey(r.remote_jid)` e somar.

### Resultado

| Antes | Depois |
|-------|--------|
| Agrupado por `remote_jid` exato | Agrupado por últimos 8 dígitos |
| Filtro rígido 12-13 dígitos | Aceita 8+ dígitos |
| Exibição raw do banco | Normalizado com `55` |
| Leads duplicados | Unificados |
| Boletos não vinculados | Vinculados corretamente |

Sem mudança em `Leads.tsx` nem `LeadDetailDialog.tsx` — a correção é toda no hook.

