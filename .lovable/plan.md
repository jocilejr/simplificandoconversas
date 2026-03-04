

## Plan: Nó "Agente IA" com OpenAI API Key do Usuário

### Abordagem

O usuário fornecerá sua própria API key da OpenAI, que será armazenada como secret no backend. O nó `aiAgent` chamará a API da OpenAI diretamente (não o Lovable AI Gateway), suportando texto, áudio, imagens e PDFs via modelos multimodais (GPT-4o).

### Secret necessário

- **OPENAI_API_KEY** — será solicitado ao usuário via ferramenta de secrets antes de implementar

### Configuração do nó (Properties Panel)

| Campo | Tipo | Default |
|---|---|---|
| Prompt do sistema | Textarea | "" |
| Modelo | Select | `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo` |
| Tipos de mídia aceitos | Checkboxes | Texto, Áudio, Imagem, PDF |
| Salvar resposta em | Input | `resposta_ia` |
| Enviar resposta automaticamente | Switch | true |
| Temperatura | Slider 0–1 | 0.7 |
| Max tokens | Input number | 500 |
| Histórico de mensagens | Input number | 10 |

### Visual

- **Ícone**: `BrainCircuit` · **Cor**: `#a855f7` (roxo) · **Label**: "Agente IA"
- Nova categoria "Inteligência Artificial" na paleta

### Execução no backend

No `execute-flow/index.ts`, o handler `aiAgent`:
1. Busca últimas N mensagens da conversa no banco
2. Monta payload multimodal OpenAI (`content` array com `text`, `image_url`, `input_audio`)
3. Chama `https://api.openai.com/v1/chat/completions` com `OPENAI_API_KEY`
4. Se `aiAutoSend` = true, envia resposta via Evolution API
5. Armazena resposta na variável especificada

### Arquivos a editar

1. **`src/types/chatbot.ts`** — Adicionar `aiAgent` ao type union, campos AI no `FlowNodeData`, entradas em `nodeTypeConfig` e `defaultNodeData`
2. **`src/components/chatbot/NodePalette.tsx`** — Nova categoria "Inteligência Artificial"
3. **`src/components/chatbot/StepNode.tsx`** — Caso `aiAgent` no `renderDescription()`
4. **`src/components/chatbot/PropertiesPanel.tsx`** — Seção completa com prompt, modelo, checkboxes de mídia, variáveis, temperatura, max tokens
5. **`supabase/functions/execute-flow/index.ts`** — Handler `aiAgent` chamando OpenAI diretamente
6. **`supabase/config.toml`** — Sem alteração (função já existe)

### Passo 0 (antes de codar)

Solicitar ao usuário a `OPENAI_API_KEY` via ferramenta de secrets.

