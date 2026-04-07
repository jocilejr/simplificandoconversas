

## Fix: Mover Fila de Mensagens para o Popover da Engrenagem

### Problema
1. A seção "Fila de Mensagens" separada no final da página ficou ruim visualmente
2. Erro ao salvar (provavelmente conflito entre o popover antigo que usa `updateDelay` na instancia e o novo `message_queue_config`)
3. Existem DOIS controles de delay: o popover antigo (linhas 467-510) que salva `message_delay_ms` na instancia, e a seção nova que salva na tabela `message_queue_config`

### Solução
- Remover a seção `MessageQueueSection` inteira (componente separado no final)
- Substituir o popover existente da engrenagem (que controla apenas `message_delay_ms`) por um popover com os 3 campos da fila: **Intervalo** (seg), **Pausar após** (msgs), **Pausa de** (min)
- Salvar via `useMessageQueueConfig.upsertConfig` ao invés de `updateDelay`
- Remover estado `delayInput` que era usado pelo popover antigo

### Arquivo

| Arquivo | Ação |
|---------|------|
| `src/components/settings/ConnectionsSection.tsx` | Remover `MessageQueueSection`, substituir popover da engrenagem com campos de fila completos |

