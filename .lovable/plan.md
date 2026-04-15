

# Plano: Delay 5s, detecção de banimento no sync manual, e validação do auto sync

## Diagnóstico

Analisei os 3 pontos:

1. **Delay**: O `sync-invite` (manual) tem delay de 500ms. O `sync-all` (cron) **não tem nenhum delay** entre grupos. Ambos precisam de 5s.

2. **Auto sync (`sync-all`)**: Já está implementado e roda a cada 15 minutos via cron. Já atualiza `invite_url` e `member_count` (via `findGroupInfos`). Já grava `last_successful_sync_at`, `last_sync_error`, etc. Funciona corretamente.

3. **Detecção de banimento**: 
   - **`sync-all` (cron)**: Implementado. Se a instância está online e o `inviteCode` falha ou retorna vazio → marca `gl.status = "banned"` e limpa a URL.
   - **`sync-invite` (manual)**: **NÃO implementado**. Se o `inviteCode` falha, simplesmente ignora. Não marca como banido nem como ativo. Também não busca `member_count` real via `findGroupInfos` — só lê da tabela `group_selected`.

## Alterações

### 1. `deploy/backend/src/routes/groups-api.ts` — endpoint `sync-invite` (linhas 1546-1578)

- Mudar delay de `500` para `5000` (5 segundos)
- Adicionar chamada `findGroupInfos` para obter `member_count` real (igual ao `sync-all`)
- Adicionar lógica de detecção de banimento:
  - Se `inviteCode` retorna código → `gl.status = "active"`, atualiza URL
  - Se `inviteCode` retorna vazio ou falha (mas instância online) → `gl.status = "banned"`, limpa URL
- Atualizar `last_successful_sync_at` e campos de erro no banco após sync

### 2. `deploy/backend/src/routes/groups-api.ts` — endpoint `sync-all` (linhas 1730-1778)

- Adicionar `await new Promise(r => setTimeout(r, 5000))` entre cada grupo no loop
- Manter toda a lógica existente de banimento (já funciona)

### 3. Nada no frontend
A tabela já renderiza o badge "Banido" e o ícone correto — só precisa que o backend preencha o campo `status` corretamente no sync manual.

## Resultado
- Sync manual e automático processam 1 grupo a cada 5 segundos
- Ambos detectam grupos banidos com a mesma lógica
- Ambos atualizam `member_count` real via Evolution API
- A tabela no frontend reflete o status atualizado automaticamente

## Deploy
```bash
cd /root/simplificandoconversas/deploy && docker compose up -d --build backend
```

