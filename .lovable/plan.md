

# Plano: Adicionar delay na sincronização de invite links

## Problema
O endpoint `sync-invite` faz um `for` loop chamando a Evolution API para cada grupo sem nenhum intervalo. Após ~10 chamadas consecutivas, a API passa a rejeitar ou retornar erro, resultando em apenas parte dos links sendo sincronizados.

## Solução
Adicionar um `await sleep(500)` entre cada chamada à Evolution API no loop, evitando rate-limit.

## Alteração

### `deploy/backend/src/routes/groups-api.ts` (linhas 1546-1569)
- Adicionar função `sleep` (ou reutilizar existente)
- Inserir `await new Promise(r => setTimeout(r, 500))` entre cada iteração do loop
- Opcionalmente: adicionar log do progresso (`[smart-link] synced ${synced}/${groupLinks.length}`)

## Deploy
```bash
cd /root/simplificandoconversas/deploy && docker compose up -d --build backend
```

