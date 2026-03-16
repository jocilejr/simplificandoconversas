
Objetivo
- Corrigir de forma definitiva a identificação do lead quando o WhatsApp mostra nome salvo (sem número no header), para a extensão sempre resolver o número/JID e funcionar em Contato, IA e disparo de fluxo.

Diagnóstico (onde está quebrando hoje)
1) `chrome-extension/content.js`
- Erro principal: `currentPhone.match(...)` quando `currentPhone === null` (causa a tela de erro “Cannot read properties of null (reading 'match')”).
- Polling da aba Contato só roda se `currentPhone` existir; quando há só nome, o estado não atualiza.
- Disparo manual de fluxo envia apenas `currentPhone`; com nome salvo, vai `null`.

2) `deploy/backend/src/routes/extension-api.ts`
- Lookup por nome está com `eq("contact_name", name)` (match exato), sem priorizar instância atual e sem fallback robusto.
- Isso falha com variações de nome (acento, espaços, casing, alias), então não resolve `remote_jid/phone_number`.

Plano de implementação
1) Resolver crash e estado no content script
- Trocar o cálculo de `displayPhone` para versão null-safe.
- Corrigir polling para rodar com `(currentPhone || currentContactName)`.
- Introduzir `resolvedPhone` e `resolvedRemoteJid` derivados de `contactData.contact` (não depender só de `currentPhone`).

2) Melhorar “onde encontrar o número” (ordem de prioridade)
- Prioridade A: número/JID vindo da conversa no backend (lookup por telefone/nome + instância).
- Prioridade B: número detectado no header quando o título já é numérico.
- Prioridade C (fallback): extração do número no painel “Dados do contato” do WhatsApp via regex de telefone BR em `span[data-testid="selectable-text"]` dentro do drawer, quando disponível.

3) Fortalecer resolução no backend (helper único)
- Criar helper de resolução de contato para reutilizar em:
  - `/api/ext/contact-status`
  - `/api/ext/contact-cross`
  - `/api/ext/ai-status`
- Estratégia:
  - se `phone`: buscar por `phone_number` e `remote_jid` compatível;
  - se `name`: tentar por instância atual primeiro, depois match case-insensitive/flexível;
  - fallback para conversa mais recente do usuário.
- Sempre retornar melhor `remote_jid`, `phone_number`, `instance_name`.

4) Corrigir disparo manual com nome salvo
- Em `content.js`, enviar para trigger:
  - `phone: resolvedPhone` quando existir;
  - caso contrário, enviar `remoteJid`.
- Em `/api/ext/trigger-flow`, aceitar `phone` OU `remoteJid`; montar `remoteJid` final sem exigir número obrigatório.

5) Refino do ícone da extensão (garantia de exibição)
- Validar manifesto e paths de ícone usados pelo Chrome action.
- Padronizar fallback visual no header da sidebar quando imagem não carregar.

Arquivos que serão alterados
- `chrome-extension/content.js`
- `deploy/backend/src/routes/extension-api.ts`
- `chrome-extension/manifest.json` (somente se necessário para ícone action/fallback)

Detalhes técnicos (seu pedido “onde vai encontrar”)
- A extensão passará a “encontrar” o número por três fontes, nesta ordem:
  1. Base de conversas do backend (mais confiável para ações);
  2. Header da conversa no WhatsApp (quando for número);
  3. Drawer “Dados do contato” (fallback visual do próprio WhatsApp).
- Isso elimina dependência de um único seletor e evita quebra quando o lead está salvo como nome.

Validação pós-implementação
1) Contato com número visível no header: deve resolver instantaneamente.
2) Contato salvo por nome: deve carregar contato sem erro e exibir número quando existir.
3) Disparo de fluxo em contato salvo por nome: deve funcionar sem exigir número no header.
4) IA Responde/IA Escuta em contato salvo por nome: toggles devem carregar e salvar normalmente.
5) Reabrir WhatsApp e trocar de conversa: sem regressão, sem erro de `match` nulo.
