# LinkGenerator — Processo Visual de Busca + Mensagem Padrão

## Resumo

Transformar o LinkGenerator para mostrar um fluxo visual step-by-step ao liberar acesso, e adicionar campo "Mensagem padrão de entrega" nas configurações.

## 1. LinkGenerator — Fluxo visual step-by-step (`src/components/entrega/LinkGenerator.tsx`)

Após clicar "Liberar Acesso", em vez de rodar tudo silenciosamente, o dialog mostra cards minimalistas que vão aparecendo conforme cada etapa conclui:

```text
Estado: phone_input → processing → done

processing mostra cards sequenciais:
  [1] 🔍 Buscando lead...          (spinner enquanto busca)
  [2] ✅ Lead encontrado / ⚠️ Novo lead criado
  [3] 👤 Nome: João Silva          (se contact_name existir)
  [4] ✅ Acesso liberado
  [5] 📋 Mensagem pronta para copiar
```

A mutação será quebrada em etapas com `setState` entre cada passo para atualizar a UI:

- `step: "searching"` → busca conversations
- `step: "found"` ou `step: "created"` → mostra resultado do match
- `step: "granting"` → upsert member_products + insert transaction (se PIX)
- `step: "done"` → mostra link + mensagem para copiar

### Link gerado

O link de acesso usa o domínio publico configurado para a area de membros + número normalizado:

```
https://dominio.com/5589981340810
```

### Mensagem final

Se existe `delivery_message` em `delivery_settings` → usar essa mensagem + link na última linha.
Se não existe → apenas o link.

O botão "Copiar" copia a mensagem completa.

## 2. Configurações — Adicionar "Mensagem padrão de entrega" (`delivery_settings`)

### Migração SQL

Adicionar coluna `delivery_message` à tabela `delivery_settings`:

```sql
ALTER TABLE delivery_settings ADD COLUMN IF NOT EXISTS delivery_message text DEFAULT NULL;
```

### MemberAreaSettingsSection — Sub-aba "Ajustes"

Adicionar campo "Mensagem padrão de entrega" após os prompts de IA existentes (ou em posição mais lógica, antes dos prompts):

- Label: "Mensagem padrão de entrega"
- Textarea com placeholder: "Olá! Seu acesso está liberado..."
- Hint: "Enviada junto com o link ao liberar acesso. O link será adicionado na última linha. Deixe vazio para enviar apenas o link."

Este campo será salvo na tabela `delivery_settings` (não em `member_area_settings`), então precisa de uma query separada para `delivery_settings` na aba Ajustes, ou mover o campo para a aba Domínio onde já se consulta `delivery_settings`.

**Decisão**: Colocar o campo na sub-aba "Domínio" do `MemberAreaSettingsSection`, já que essa aba já consulta `delivery_settings`. Renomear a aba para "Domínio e Entrega" ou simplesmente manter em "Domínio" e adicionar o campo lá.

## 3. Arquivos alterados


| Arquivo                                                 | Mudança                                                             |
| ------------------------------------------------------- | ------------------------------------------------------------------- |
| Migration SQL                                           | `ALTER TABLE delivery_settings ADD COLUMN delivery_message text`    |
| `src/components/entrega/LinkGenerator.tsx`              | Fluxo visual step-by-step + link = domínio/número + mensagem padrão |
| `src/components/settings/MemberAreaSettingsSection.tsx` | Adicionar campo "Mensagem padrão de entrega" na sub-aba Domínio     |
