

## Plano: Corrigir layout do painel e melhorar diagnóstico de mensagens perdidas

### Problema 1 — Layout quebrando boxes vizinhos

**Causa raiz**: `scrollIntoView()` na linha 233 move o scroll da página inteira, não só do container do carrossel. Isso empurra os boxes de cima e de baixo.

**Correção**: Trocar `scrollIntoView` por manipulação direta de `scrollLeft` no container `scrollRef`, calculando o offset do card alvo. Isso garante que só o scroll horizontal interno do carrossel muda, sem afetar nada fora dele.

```text
Antes:  targetCard.scrollIntoView({ inline: "center" })  ← move a página
Depois: container.scrollLeft = targetCard.offsetLeft - (container.clientWidth - cardWidth) / 2
```

**Arquivo**: `src/components/grupos/SchedulerDebugPanel.tsx`

---

### Problema 2 — Mensagens ignoradas por falta de timer

**Causa raiz**: Quando o scheduler não dispara (timer perdido, restart do backend, etc.), não há itens na fila nem diagnóstico runtime. O `resolveSchedulerStatus` já tem o caso `isPast && !hasTimer` → "O timer da publicação não estava ativo", que é correto.

Porém, a mensagem pode estar chegando como "Ignorada" em vez de "Perdida" se existirem itens cancelled na fila de uma execução anterior. A prioridade precisa ser ajustada:

**Correção no `resolveSchedulerStatus`**:
- **Antes** de checar cancelled items, verificar se o runtime diagnostic do scheduler tem um status mais específico (como `missed` com `reason_code`).
- Mover o bloco de `runtimeDiagnostic` para **antes** do bloco de `cancelledItems`, para que diagnósticos do scheduler tenham prioridade sobre itens cancelled genéricos.
- Diferenciar claramente: "Ignorada por anti-spam" (cancelled na fila com reason) vs "Perdida porque o timer não disparou" (sem fila, sem timer).

**Arquivo**: `deploy/backend/src/routes/groups-api.ts`

---

### Resumo das mudanças

| Arquivo | Mudança |
|---------|---------|
| `SchedulerDebugPanel.tsx` | Trocar `scrollIntoView` por `scrollLeft` direto |
| `groups-api.ts` | Reordenar prioridades no `resolveSchedulerStatus` — runtime diagnostic antes de cancelled items |

