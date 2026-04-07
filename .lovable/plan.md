

## Sistema de Recuperação via Extensão WhatsApp na Página de Transações

### Objetivo
Adicionar botões de recuperação rápida nas abas "Boletos Ger." e "PIX/Cartão Pend." da tabela de transações, seguindo o padrão do Finance Hub. O sistema permite copiar mensagens prontas e abrir conversas no WhatsApp via extensão Chrome.

### Arquitetura (baseada no Finance Hub)

O Finance Hub usa comunicação via `window.postMessage` entre a aplicação web e a extensão Chrome instalada no navegador. A extensão escuta pings e comandos (OPEN_CHAT, SEND_TEXT, SEND_IMAGE) e responde via postMessage.

### Componentes a Criar/Modificar

**1. `src/hooks/useWhatsAppExtension.ts` (NOVO)**
- Hook que gerencia a comunicação com a extensão Chrome via `window.postMessage`
- Detecta se a extensão está conectada (ping/pong)
- Expõe: `openChat(phone)`, `sendText(phone, text)`, `extensionStatus`, `retryConnection`
- Protocolo multi-formato para compatibilidade (v1.x e v2.x da extensão)
- Baseado diretamente no código do Finance Hub

**2. `src/components/transactions/RecoveryPopover.tsx` (NOVO)**
- Popover compacto que aparece ao clicar no ícone WhatsApp de uma transação pendente
- Carrega mensagem de recuperação do `profiles` (campo `recovery_message_boleto` ou `recovery_message_pix`) com variáveis: `{saudação}`, `{nome}`, `{primeiro_nome}`, `{valor}`
- Botões: "Copiar" e "WhatsApp" (abre chat via extensão)
- Contador de tentativas de recuperação por transação

**3. `src/components/transactions/TransactionsTable.tsx` (MODIFICAR)**
- Nas abas "boletos-gerados" e "pix-cartao-pendentes", adicionar coluna/botão de ação WhatsApp ao lado das ações existentes
- Renderizar o `RecoveryPopover` para cada transação pendente
- Mobile: botão WhatsApp nos cards

**4. `src/pages/RecuperacaoBoletos.tsx` (MODIFICAR)**
- Transformar de placeholder para página de configuração das mensagens de recuperação
- Duas seções: "Mensagem Boleto" e "Mensagem PIX/Cartão"
- Textarea com variáveis suportadas e botão salvar

### Armazenamento das Mensagens

Usar a tabela `profiles` adicionando dois campos via migration:
- `recovery_message_boleto` (text, nullable)
- `recovery_message_pix` (text, nullable)

Isso evita criar tabelas extras e mantém as mensagens por usuário/workspace.

### Armazenamento dos Cliques de Recuperação

Migration para criar tabela `recovery_clicks`:
- `id` (uuid PK)
- `transaction_id` (text, ref transactions.id)
- `user_id` (uuid)
- `workspace_id` (uuid)
- `recovery_type` (text: 'boleto' | 'pix' | 'cartao')
- `created_at` (timestamptz)

RLS: workspace members podem ler/inserir.

### Fluxo do Usuário

1. Na aba "Boletos Ger." ou "PIX/Cartão Pend.", cada linha terá um ícone WhatsApp
2. Ao clicar, abre popover com a mensagem formatada (variáveis substituídas)
3. Botão "Copiar" copia a mensagem, botão "WhatsApp" abre o chat na extensão
4. Badge mostra quantas vezes já tentou recuperar aquela transação
5. Na página "Recuperação", configura as mensagens padrão

### Arquivos Envolvidos

| Arquivo | Ação |
|---------|------|
| `src/hooks/useWhatsAppExtension.ts` | Criar |
| `src/components/transactions/RecoveryPopover.tsx` | Criar |
| `src/components/transactions/TransactionsTable.tsx` | Modificar (add WhatsApp button) |
| `src/pages/RecuperacaoBoletos.tsx` | Reescrever (config mensagens) |
| Migration SQL | Criar (campos em profiles + tabela recovery_clicks) |

