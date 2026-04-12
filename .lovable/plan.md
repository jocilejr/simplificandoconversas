

## Plano: Sanitização manual + Título dinâmico + Notificações

### 1. Script `deploy/sanitize-storage.sh` (manual, sem cron)

Script para rodar manualmente quando quiser liberar espaço. Dois modos:

```text
./sanitize-storage.sh          → mostra o que seria apagado (dry-run)
./sanitize-storage.sh --execute → executa a limpeza de verdade
```

Ações do script:
- `docker builder prune -a -f` → ~26.5 GB
- `docker rmi atendai/evolution-api:v2.2.3` → 1.37 GB
- `docker rmi joseluisq/static-web-server:2-alpine` → 28 MB
- `docker image prune -f` → só dangling (~452 MB)
- Truncar logs de containers > 50MB → ~2.2 GB
- Mídia efêmera > 30 dias no volume → ~7 MB
- Mostra `df -h` antes e depois

Nenhum cron, nenhum agendamento. Só roda quando você executar.

### 2. Título dinâmico — `src/hooks/useUnseenTransactions.ts`

`useEffect` que altera `document.title`:
- Com novas: `(3) Nova transação! | Simplificando`
- Sem novas: restaura título original

### 3. Notificações nativas — `src/hooks/useTransactionNotifications.ts`

- Pede permissão via `Notification.requestPermission()`
- Escuta INSERT em `transactions` via realtime
- Dispara notificação por tipo/status:
  - 📄 Boleto gerado / ✅ Boleto pago / ❌ Boleto falhou
  - 💠 PIX gerado / ✅ PIX recebido
  - 💳 Cartão gerado / ✅ Cartão aprovado / ❌ Cartão recusado
  - 🛒 Carrinho abandonado
- Corpo: nome do cliente + valor em R$

### 4. Integração — `src/components/AppLayout.tsx`

Monta o hook de notificações para funcionar em todas as páginas.

### Arquivos

| Arquivo | Ação |
|---------|------|
| `deploy/sanitize-storage.sh` | Criar |
| `src/hooks/useUnseenTransactions.ts` | Alterar (document.title) |
| `src/hooks/useTransactionNotifications.ts` | Criar |
| `src/components/AppLayout.tsx` | Alterar |

