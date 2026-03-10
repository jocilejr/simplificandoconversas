

## Diagnóstico

O fix `router.post("/*")` está correto no código (linha 81). Porém os logs da Evolution mostram:

```
"Erro não recuperável (404): Cancelando retentativas."
```

A Evolution API recebeu 404 **antes do rebuild** do backend, marcou o webhook como falho e **parou de enviar**. Mesmo após o rebuild, a Evolution não tenta novamente até ser reiniciada.

## Plano

Nenhuma alteração de código necessária. Apenas comandos operacionais na VPS:

### 1. Garantir que o backend está com o código atualizado
```bash
cd ~/simplificandoconversas && git pull origin main
cd deploy && docker compose up -d --build backend
```

### 2. Reiniciar a Evolution API para resetar o estado dos webhooks
```bash
docker compose restart evolution
```

### 3. Aguardar ~30 segundos e verificar
```bash
docker compose logs evolution --tail=10 -f
```
Envie uma mensagem WhatsApp de teste. Deve aparecer nos logs da Evolution o envio do webhook **sem erro 404**, e nos logs do backend:
```bash
docker compose logs backend --tail=10 -f
```
Deve aparecer `Webhook event: messages.upsert instance: Adsd`.

Se ainda der 404 após restart, o problema é que o `docker compose build backend` não incorporou a mudança. Nesse caso, forçar rebuild sem cache:
```bash
docker compose build --no-cache backend && docker compose up -d backend && docker compose restart evolution
```

