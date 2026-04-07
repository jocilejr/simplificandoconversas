

## Adicionar documentação do endpoint generate-payment na UI

### O que sera feito

Adicionar um novo bloco no Accordion da `IntegrationApiSection.tsx` documentando o endpoint `POST /api/platform/generate-payment`, para que você possa copiar a URL e ver o formato do payload diretamente na interface.

### Arquivo alterado

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/settings/IntegrationApiSection.tsx` | Adicionar AccordionItem "Gerar Cobrança (Boleto/PIX)" após o item de Transações, documentando o endpoint, payload e resposta |

### O que vai aparecer na UI

Novo bloco expansível **"Gerar Cobrança (Boleto/PIX)"** com:

- `POST https://SEU-API-DOMAIN/api/platform/generate-payment`
- Campos obrigatórios: `customer_name`, `amount`
- Campos opcionais: `customer_phone`, `customer_document`, `description`, `type` (boleto/pix, default: pix)
- Exemplo de resposta com `payment_url`, `barcode`, `qr_code`, etc.

### Após deploy na VPS

```bash
cd ~/simplificandoconversas/deploy && docker compose up -d --build backend
```

Não precisa rebuild do backend para esta mudança — é apenas frontend. Basta atualizar a página.

