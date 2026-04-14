

# Fix: Mensagem de entrega não substitui {link} no DeliveryFlowDialog

## Problema

Na linha 337 de `DeliveryFlowDialog.tsx`:

```typescript
const finalMessage = deliveryMsg ? `${deliveryMsg}\n\n${finalLink}` : finalLink;
```

Isso **sempre** concatena o link no final, ignorando a variável `{link}` configurada na mensagem. Se a mensagem contém `{link}`, o resultado fica com o link duplicado ou posicionado errado.

O `LinkGenerator.tsx` já implementa a lógica correta (3 caminhos).

## Correção

**Arquivo**: `src/components/entrega/DeliveryFlowDialog.tsx` — linha 337

Substituir:
```typescript
const finalMessage = deliveryMsg ? `${deliveryMsg}\n\n${finalLink}` : finalLink;
```

Por:
```typescript
let finalMessage: string;
if (deliveryMsg && deliveryMsg.includes("{link}")) {
  finalMessage = deliveryMsg.replace(/\{link\}/g, finalLink);
} else if (deliveryMsg) {
  finalMessage = `${deliveryMsg}\n\n${finalLink}`;
} else {
  finalMessage = finalLink;
}
```

Apenas 1 arquivo, 1 linha expandida para 7.

