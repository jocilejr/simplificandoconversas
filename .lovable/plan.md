

## Plano: Resolver detecção de contato quando header mostra nome salvo

### Problema confirmado
- Contato salvo no banco: `contact_name: "."`, `phone_number: 558981340810`
- WhatsApp header mostra: "J Júnior" (alias local do telefone do usuário)
- Extensão envia `name: "J Júnior"` → backend não encontra porque no banco é `"."`
- Wildcard no backend não resolve: `"."` nunca bate com `"%J%nior%"`

### Solução: 2 frentes

**Frente 1 — Extensão (`chrome-extension/content.js`): Extrair telefone do drawer**

Na função `detectContact()` (linha 143), quando o header mostra um nome (não um telefone), adicionar fallback:
1. Procurar no DOM o painel de informações do contato que já está aberto ou acessível
2. Extrair o telefone do elemento `span[data-testid="selectable-text"]` ou similar que mostra `+55 89 8134-0810`
3. Limpar e usar como `currentPhone` em vez de depender do `currentContactName`

Seletores candidatos para o telefone no drawer:
- `section span[data-testid="selectable-text"]` contendo padrão `+\d{2}\s\d{2}`
- `div[data-testid="contact-info-drawer"] span` com dígitos

Se o drawer não estiver aberto, manter o fallback por nome mas com a Frente 2.

**Frente 2 — Backend (`extension-api.ts`): Resolver por telefone parcial**

Na função `resolveContact()`, quando busca por nome falha:
1. Extrair dígitos do nome (caso venha com formato de telefone parcial)
2. Adicionar fallback: buscar em `phone_number` com `LIKE '%últimos8dígitos%'`
3. Manter prioridade: `phone` > `remoteJid` > `name` > fallback parcial

**Frente 3 — Extensão: Passar instância nos lookups**

Incluir `instance` nos calls de `contact-status` e `ai-status` (linha 221-225) para melhorar precisão multi-instância.

### Arquivos alterados
1. `chrome-extension/content.js` — `detectContact()` + `loadContactData()`
2. `deploy/backend/src/routes/extension-api.ts` — `resolveContact()`

### Impacto
- Zero breaking changes — fallback adicional, não substitui lógica existente
- Contatos com alias local diferente do banco passam a funcionar
- Contatos sem nome (armazenados como ".") são resolvidos pelo telefone do drawer

