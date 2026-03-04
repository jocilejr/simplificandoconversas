

## Analise do Problema

Analisei o print e os dados do banco. O problema tem **duas causas raiz**:

### 1. Bolinha de não lidas nunca aparece
Todas as conversas no banco têm `unread_count = 0`. O webhook tem um bug: ele faz `upsert` com `unread_count: 1` (que sobrescreve em vez de incrementar), e logo depois tenta incrementar, mas o valor já foi resetado pelo upsert. Resultado: o contador nunca acumula corretamente.

### 2. Mensagens muito longas na prévia
O `last_message` de várias conversas contém textos enormes (parágrafos inteiros com links). O `truncate` do CSS funciona, mas o texto no banco não está sendo cortado, então a prévia pode parecer pesada.

---

## Plano de Correção

### A. Corrigir contagem de não lidas no webhook (`evolution-webhook/index.ts`)
- Remover `unread_count` do `upsert` (evitar sobrescrita)
- Usar SQL `UPDATE ... SET unread_count = unread_count + 1` após o upsert para mensagens inbound, garantindo incremento atômico
- Isso faz com que novas mensagens recebidas acumulem corretamente o contador

### B. Limitar prévia da mensagem no webhook
- Truncar `last_message` a no máximo 100 caracteres antes de salvar no banco, para manter os dados limpos

### C. Garantir layout correto no `ConversationList.tsx`
- O código atual já está estruturado corretamente (nome + horário na linha 1, mensagem na linha 2, bolinha condicional)
- Uma vez que o `unread_count` estiver > 0 no banco, a bolinha verde vai aparecer automaticamente

### D. Atualizar unread_count das conversas existentes
- Executar SQL para recalcular `unread_count` com base nas mensagens inbound que ainda não foram "lidas"

