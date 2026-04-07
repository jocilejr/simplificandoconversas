

# Plano: Salvar PDF do Boleto no Filesystem ao Criar e Limpar Após Vencimento

## Problema
O link do PDF do boleto no Mercado Pago pode ficar indisponível após horas. Atualmente o frontend tenta buscar o PDF diretamente desse link, resultando em "PDF não disponível".

## Solução

Salvar o PDF do boleto no volume `/media-files` (já montado no backend e servido pelo Nginx via `/media/`) no momento da criação da cobrança, e referenciar o caminho local no `metadata` da transação. Adicionar limpeza automática de boletos vencidos.

### 1. Backend: Baixar e salvar PDF ao criar boleto (`deploy/backend/src/routes/payment.ts`)

Após criar o pagamento no Mercado Pago e obter o `paymentUrl` (ticket_url), se o tipo for `boleto`:
- Fazer `fetch(paymentUrl)` server-side para obter o PDF
- Salvar em `/media-files/{userId}/boletos/{externalId}.pdf`
- Incluir no `metadata` da transação: `boleto_file: "/media/{userId}/boletos/{externalId}.pdf"`

```text
[Após linha ~168, antes de salvar a transação]
if (type === "boleto" && paymentUrl) {
  fetch PDF → salvar em /media-files/{userId}/boletos/{mpData.id}.pdf
  metadata.boleto_file = `/media/${userId}/boletos/${mpData.id}.pdf`
}
```

### 2. Frontend: Usar arquivo local no `BoletoQuickRecovery.tsx`

Alterar `loadPdf()` para buscar o PDF do caminho local (`metadata.boleto_file`) via a URL pública do app (`/media/...`), em vez do link do Mercado Pago:

```text
const boletoFile = metadata?.boleto_file;
if (boletoFile) {
  const apiUrl = profile?.app_public_url || window.location.origin;
  fetch(`${apiUrl}${boletoFile}`) → blob → setPdfBlobUrl
}
```

### 3. Backend: Limpeza automática de boletos vencidos

Adicionar um cron job (já existe infra de cron no `index.ts`) que roda diariamente:
- Busca transações de boleto com status `pendente` criadas há mais de 5 dias (boletos vencem em ~3 dias úteis)
- Deleta os arquivos PDF do filesystem
- Limpa o campo `boleto_file` do metadata

### 4. Configuração Nginx

A rota `/media/` já está configurada para servir arquivos estáticos do volume `chatbot_media`. Nenhuma alteração necessária.

## Arquivos Modificados

| Arquivo | Alteração |
|---------|-----------|
| `deploy/backend/src/routes/payment.ts` | Baixar PDF após criação do boleto, salvar no filesystem |
| `deploy/backend/src/index.ts` | Adicionar cron de limpeza diária |
| `src/components/transactions/BoletoQuickRecovery.tsx` | Usar `metadata.boleto_file` em vez do link MP |

## Instruções VPS

Após deploy, apenas rebuild do backend:
```bash
cd ~/simplificandoconversas/deploy && docker compose up -d --build backend
```

