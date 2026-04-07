

## Adicionar documentação do webhook na integração Mercado Pago

### O que será feito

Abaixo da URL do webhook na integração do Mercado Pago, adicionar uma mini-documentação (igual já existe para `manual_payment`) explicando:

1. Que o MP envia automaticamente — não é necessário configurar body
2. O formato do JSON que o endpoint recebe
3. Onde configurar no painel do Mercado Pago

### Mudança

| Arquivo | Ação |
|---------|------|
| `src/components/settings/IntegrationsSection.tsx` | Adicionar bloco de documentação para `configDialog?.id === "mercadopago"` logo após o bloco de webhook URL |

### Conteúdo da documentação na UI

```text
📄 Como configurar

1. Acesse o painel do Mercado Pago
2. Vá em Configurações > IPN (Notificações)
3. Cole a URL acima no campo "URL de notificação"
4. Selecione o evento "Pagamentos"

O Mercado Pago envia automaticamente:

{
  "resource": "PAYMENT_ID",
  "topic": "payment"
}

Não é necessário configurar nenhum body manualmente.
```

Apenas um bloco condicional novo, sem alterar nenhuma lógica existente.

