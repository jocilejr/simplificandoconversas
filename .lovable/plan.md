

## Problema

O sistema atual de notificações (`useTransactionNotifications`) depende do **Supabase Realtime** (canais WebSocket) que **não existe na VPS**. Por isso, nenhuma notificação é disparada. Além disso, só usa a API nativa `Notification` do navegador — sem popup visual na interface.

## Solução

Reescrever o sistema de notificações baseando-se no Finance Hub, usando **polling** (que já funciona na VPS) em vez de Realtime, com:

1. **Popup visual in-app** (NotificationPopup) no header
2. **Tab title piscando** quando há transações novas em background
3. **Notificação do navegador** como complemento (não dependência principal)

## Arquivos a criar/alterar

### 1. Criar `src/components/layout/NotificationPopup.tsx`
- Componente Popover no header mostrando lista de notificações recentes
- Ícones por tipo (boleto/pix/cartão) e cores por status
- Botão "Ver todas" navegando para `/transacoes`
- Botão dismiss para limpar

### 2. Reescrever `src/hooks/useTransactionNotifications.ts`
- Trocar canal Realtime por **polling** (comparação de IDs a cada 15s)
- Manter um `Set<string>` de IDs já vistos (inicializado com transações atuais)
- Quando detectar IDs novos: criar notificação in-app + browser notification (se permitida)
- Expor `notifications[]`, `dismissAllNotifications()` para o popup
- Incluir lógica de tab title piscando (como `useTabNotification` do Finance Hub)

### 3. Alterar `src/components/AppLayout.tsx`
- Importar `NotificationPopup`
- Renderizar o popup no header ao lado do `SidebarTrigger`
- Passar `notifications` e `onDismiss` do hook reescrito

### Detalhes técnicos

**Polling em vez de Realtime:**
```
- A cada 15s, buscar transações recentes (últimas 24h) com viewed_at IS NULL
- Comparar com Set de IDs já conhecidos
- Novos IDs → gerar notificação
- Usar refetchInterval do React Query que já está em uso no projeto
```

**Estrutura da notificação:**
```typescript
interface TransactionNotification {
  id: string;
  type: string;      // boleto, pix, cartao, card, yampi_cart
  status: string;    // pendente, aprovado, rejeitado, abandonado
  customerName: string;
  amount: number;
  timestamp: Date;
}
```

**Tab title piscando:**
- Quando tab está em background e há notificações pendentes
- Alterna entre `🔔 (N) Nova Venda!` e título original a cada 1s
- Reseta ao voltar para a tab

