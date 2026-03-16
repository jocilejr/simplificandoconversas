

## Plano: Input manual de telefone na sidebar da extensão

### Problema
Contatos salvos por nome no WhatsApp não mostram o número na UI, impossibilitando a resolução automática. Em vez de tentar extrair o telefone programaticamente (abrir drawer, etc.), adicionar um campo de input manual.

### Solução

**Arquivo: `chrome-extension/content.js`**

1. **Na tela "Nenhum contato selecionado" (linha 417-424)** e **quando `contactData` retorna sem `contact` (contact === null)**: Mostrar um campo de input com placeholder "Digite o número (ex: 5589981340810)" e um botão "Buscar".

2. **Quando o header mostra um nome mas o backend não resolve** (contact é null no response): Mostrar o mesmo input manual abaixo do header do contato, permitindo o usuário digitar o número.

3. **Ao submeter o número manual**:
   - Setar `currentPhone = digits` e `currentContactName = raw` (manter nome do header para display)
   - Chamar `loadContactData()` novamente, agora com o telefone correto
   - O backend já resolve por telefone sem problemas

4. **Remover `extractPhoneFromUI()`** — não é mais necessário, simplifica o código.

### Fluxo do usuário
1. Abre conversa com "J Júnior" → header mostra nome → backend não encontra
2. Sidebar mostra: nome "J Júnior" + campo "Digite o número" + botão Buscar
3. Usuário digita `5589981340810` → sidebar carrega dados do contato normalmente

### Arquivos alterados
- `chrome-extension/content.js` — Adicionar input manual, remover `extractPhoneFromUI`

