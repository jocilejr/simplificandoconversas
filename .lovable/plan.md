

## Bug: Aba "Semanal" trava a interface

### Causa raiz

`filteredMessages` é computado **uma única vez** no topo do componente (linha 44) filtrando por `activeTab`. Porém, ele é usado dentro de um `.map()` que renderiza **TODOS os 5 TabsContent** (linhas 103-184).

Resultado: quando `activeTab = "weekly"`, os 5 painéis de abas renderizam as **mesmas** mensagens semanais. Cada mensagem gera um `AlertDialog` (portal) e um `Switch` — ou seja, 5 cópias duplicadas de cada um existem no DOM simultaneamente. Isso causa:
- Cliques que disparam múltiplos handlers
- AlertDialogs empilhados
- Interface não-responsiva

### Correção: `GroupMessagesDialog.tsx`

Mover a filtragem para **dentro** de cada TabsContent, usando `tab.value` em vez de `activeTab`:

```typescript
// REMOVER linha 44:
// const filteredMessages = messages.filter(...)

// DENTRO do map de SCHEDULE_TABS (linha 103), no início de cada TabsContent:
const tabMessages = messages.filter((m: any) => m.schedule_type === tab.value);
```

E substituir todas as referências a `filteredMessages` por `tabMessages` dentro do bloco.

Isso garante que cada aba renderize apenas suas próprias mensagens, eliminando duplicações no DOM.

