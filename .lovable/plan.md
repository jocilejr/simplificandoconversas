

# Fix: Endpoint `boleto-pdf` deve apenas servir arquivo existente, sem re-download

## Problema

O endpoint `GET /payment/boleto-pdf/:transactionId` atualmente tenta re-baixar o PDF do Mercado Pago quando o arquivo não existe no disco. Isso causa tentativas repetidas de download que sempre falham (MP retorna HTML, não PDF direto via `ticket_url`).

O comportamento correto é:
1. Na **criação** do boleto, usar `external_resource_url` (URL direta do PDF) para baixar e salvar
2. No **acesso** ao boleto, apenas servir o arquivo que já está no banco/disco. Se não existir, retornar erro claro

## Alterações

### 1. Criação: usar `external_resource_url` para download (`payment.ts` linhas 234-255)

Separar as URLs:
- `paymentUrl` = `ticket_url` (página interativa, salva no banco para o usuário)
- `pdfDownloadUrl` = `external_resource_url` (PDF direto, usado para download no servidor)

Passar `pdfDownloadUrl` para `downloadAndSaveBoletoPdf` em vez de `paymentUrl`.

### 2. Endpoint `boleto-pdf`: remover re-download (`payment.ts` linhas 398-458)

Simplificar para:
1. Buscar transação no banco
2. Verificar se `metadata.boleto_file` existe
3. Se sim, ler do disco e servir
4. Se o arquivo não estiver no disco OU não tiver `boleto_file` no metadata, retornar `404` com mensagem: "O boleto não existe no banco de dados"
5. **Nunca** tentar re-baixar

### 3. Salvar `pdf_download_url` no metadata da criação

Guardar a `external_resource_url` no metadata para referência futura, sem usá-la para re-download automático.

## Arquivo Modificado

| Arquivo | Alteração |
|---------|-----------|
| `deploy/backend/src/routes/payment.ts` | Usar `external_resource_url` na criação; remover re-download do endpoint `boleto-pdf` |

## VPS

```bash
cd ~/simplificandoconversas/deploy && docker compose up -d --build backend
```

