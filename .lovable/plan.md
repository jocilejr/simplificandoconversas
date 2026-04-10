

## Plano: Seletor de modelo OpenAI + Injetar dados do lead na IA

### Problemas identificados

1. **Modelo hardcodado**: Ambas as rotas (`/ai-context` e `/offer-pitch`) usam `gpt-4o-mini` fixo no código. Não há como trocar.
2. **Sem dados do lead**: A rota `/ai-context` recebe `profile` (memberSince, totalPaid etc.) mas **não recebe nem consulta dados do lead** (nome do contato, tags, histórico de conversas, notas). A IA gera mensagens sem contexto sobre o relacionamento anterior.

### Alterações

**1. Frontend — `src/components/settings/MemberAreaSettingsSection.tsx`**

Adicionar um `<Select>` na seção "Prompts de IA" do `AjustesTab` para escolher o modelo OpenAI:
- Opções: `gpt-4o-mini` (padrão), `gpt-4o`, `gpt-4.1-mini`, `gpt-4.1`, `o4-mini`
- Novo estado `aiModel` com default `gpt-4o-mini`
- Carregar de `settings.ai_model` e salvar no payload como `ai_model`

**2. Backend — `deploy/backend/src/routes/member-access.ts`**

Rota `GET /:phone`:
- Já retorna `settings` — adicionar `ai_model` ao select de `member_area_settings`

Rota `POST /ai-context`:
- Ler `ai_model` de `member_area_settings` junto com `ai_persona_prompt` e `greeting_prompt`
- Usar `settings.ai_model || "gpt-4o-mini"` na chamada à OpenAI
- **Buscar dados do lead**: consultar tabela `customers` pelo `workspaceId` + phone (receber phone no body) para pegar nome, tags, total_paid, total_transactions, first_seen_at
- Injetar esses dados no `userPrompt` como bloco `DADOS DO LEAD`

Rota `POST /offer-pitch`:
- Ler `ai_model` da mesma forma
- Usar na chamada à OpenAI

**3. Database — `deploy/fix-member-tables.sql`**

Adicionar coluna:
```sql
ALTER TABLE member_area_settings ADD COLUMN IF NOT EXISTS ai_model text DEFAULT 'gpt-4o-mini';
```

**4. Frontend — `src/pages/MemberAccess.tsx`**

Na chamada `loadAiContext`, adicionar `phone` ao payload enviado para `/ai-context` para que o backend possa buscar dados do lead.

### Resultado
- Em Configurações > Área de Membros > Ajustes, aparece um dropdown para escolher o modelo
- A IA recebe dados do lead (nome, valor pago, transações, data de entrada) para personalizar melhor
- Rodar `./update.sh` na VPS aplica a coluna automaticamente

