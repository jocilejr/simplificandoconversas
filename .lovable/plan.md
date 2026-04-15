

## Problemas identificados

1. **Scroll além do conteúdo**: O wrapper com `overflow-y-auto` permite scroll além do preview porque o container escalado (`scale(0.85)`) não limita a altura visível — o browser calcula o scroll baseado no tamanho pré-scale.

2. **Aviso errado de erro**: Linha 158-160 mostra `reasonTitle` (vindo de `failure_reason` ou `queue_error_summary[0]`) mesmo quando todos os queue_items foram enviados com sucesso. Falta validar se realmente houve falhas antes de exibir.

3. **Card precisa de mais refino**: falta acabamento visual — gradientes sutis, tipografia mais refinada, melhor separação entre seções.

## Correções

### 1. WhatsAppPreview — eliminar scroll além do conteúdo
**Arquivo:** `src/components/grupos/WhatsAppPreview.tsx`

- Remover `overflow-y-auto` do wrapper compact — o preview deve mostrar o conteúdo fixo, sem scroll
- Usar `overflow: hidden` no container para cortar o que exceder
- Manter `scale(0.85)` mas o wrapper fica com `overflow: hidden` em vez de scroll

### 2. SchedulerDebugPanel — corrigir aviso falso de erro
**Arquivo:** `src/components/grupos/SchedulerDebugPanel.tsx`

- Só mostrar `reasonTitle` quando `failedCount > 0` ou quando `msg.status_code === 'failed' || msg.status_code === 'missed'`
- Condição atual (linha 158): `{reasonTitle && (` → mudar para `{reasonTitle && failedCount > 0 && (`

### 3. SchedulerDebugPanel — refinar visual do card
**Arquivo:** `src/components/grupos/SchedulerDebugPanel.tsx`

- Adicionar gradiente sutil no fundo da seção de info: `bg-gradient-to-b from-card to-card/80`
- Separador visual entre preview e info com linha sutil `border-t border-white/5`
- Barra de stats com `py-3` e fontes `text-lg` para os números
- Sombra interna no preview: `shadow-[inset_0_-20px_30px_-10px_rgba(0,0,0,0.5)]` para fade suave na transição preview→info
- Card ativo com sombra mais forte: `shadow-[0_12px_50px_-10px_rgba(0,0,0,0.6)]`

