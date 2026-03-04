

## Plan: Nó Agente IA Completo — Contexto de Funil, Banco de Dados e Histórico

### Problema atual

O nó `aiAgent` já existe no código, mas é básico — envia apenas o histórico de mensagens para a OpenAI. Falta contexto de negócio: quem é o contato, em que etapa do funil está, quais labels/tags tem, dados da conversa, etc.

### O que será adicionado

O nó será aprimorado para injetar automaticamente no system prompt um **bloco de contexto estruturado** com:

1. **Dados do contato** — nome, número, data do primeiro contato
2. **Labels/Tags da conversa** — todas as etiquetas aplicadas (indicam etapa do funil)
3. **Histórico completo** — últimas N mensagens com tipo de mídia e direção
4. **Metadados da conversa** — total de mensagens não lidas, última interação
5. **Variáveis do fluxo** — variáveis capturadas por nós anteriores (waitForReply, action)

Isso permite que o prompt do usuário diga coisas como "Se o contato tem a tag 'lead-quente', ofereça desconto" e a IA terá os dados para agir.

### Mudanças no Properties Panel

Adicionar novos campos de configuração:

| Campo | Tipo | Default |
|---|---|---|
| Incluir dados do contato | Switch | true |
| Incluir labels/tags | Switch | true |
| Incluir variáveis do fluxo | Switch | true |
| Instruções de funil | Textarea | "" (placeholder com exemplo de mapeamento label→etapa) |

### Mudanças no backend (execute-flow)

No handler `aiAgent`, antes de montar o payload OpenAI:

1. Buscar dados da conversa (`conversations` — nome, unread_count, created_at)
2. Buscar labels da conversa (`conversation_labels` + `labels` — nomes e cores)
3. Montar um bloco de contexto em texto e prepend ao system prompt:

```
--- CONTEXTO DO CONTATO ---
Nome: João Silva
Número: +5511999999999
Primeiro contato: 01/03/2026
Mensagens não lidas: 3
Labels: lead-quente, interessado-plano-pro
Variáveis do fluxo: {nome: "João", interesse: "plano pro"}
--- FIM DO CONTEXTO ---
```

4. O system prompt do usuário vem depois, permitindo que ele referencie esses dados.

### Arquivos a editar

1. **`src/types/chatbot.ts`** — Adicionar campos: `aiIncludeContactData`, `aiIncludeLabels`, `aiIncludeFlowVars`, `aiFunnelInstructions`
2. **`src/components/chatbot/PropertiesPanel.tsx`** — Adicionar switches e textarea de funil na seção `aiAgent`
3. **`src/components/chatbot/StepNode.tsx`** — Melhorar descrição do nó para mostrar contextos habilitados
4. **`supabase/functions/execute-flow/index.ts`** — Buscar dados do contato, labels e variáveis; montar contexto estruturado; injetar no system prompt antes de chamar OpenAI

### Fluxo de variáveis

O `execute-flow` já precisa propagar variáveis entre nós (ex: `waitForReply` captura em `{{resposta}}`). Será adicionado um `Map<string, string>` de variáveis que:
- É preenchido por nós `waitForReply` e `action` (set_variable)
- É lido pelo nó `aiAgent` para injetar no contexto
- É atualizado com a resposta da IA (`aiResponseVariable`)

