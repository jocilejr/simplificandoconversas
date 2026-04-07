

## Diagnóstico: Mensagem automática não é enviada ao receber transação

### Causa raiz

Existem **duas versões** da função `enqueueRecovery`:

1. **`deploy/backend/src/lib/recovery-enqueue.ts`** — versão antiga, usada pelos webhooks (`payment.ts`, `yampi-webhook.ts`, `manual-payment-webhook.ts`). Ela filtra por `.eq("enabled", true)`, que é a coluna antiga. Como agora a ativação é por tipo (`enabled_boleto`, `enabled_pix`, `enabled_yampi`), a coluna `enabled` provavelmente está `false`, e a função retorna sem enfileirar nada.

2. **`deploy/backend/src/routes/auto-recovery.ts`** — versão atualizada com lógica per-type. Porém **nenhum webhook importa desta versão**. Ela é exportada mas só usada internamente pelo router.

Resultado: quando um webhook recebe uma transação, chama a versão antiga que silenciosamente ignora porque `enabled = false`.

### Solução

Atualizar `deploy/backend/src/lib/recovery-enqueue.ts` para usar a mesma lógica per-type da versão em `auto-recovery.ts`, e remover a função `enqueueRecovery` duplicada de `auto-recovery.ts`.

| Arquivo | Alteração |
|---------|-----------|
| `deploy/backend/src/lib/recovery-enqueue.ts` | Substituir filtro `.eq("enabled", true)` por consulta sem filtro de `enabled` + checagem per-type (`enabled_boleto`, `enabled_pix`, `enabled_yampi`) |
| `deploy/backend/src/routes/auto-recovery.ts` | Remover a função `enqueueRecovery` duplicada (linhas 10-62), manter apenas `processRecoveryQueue` e o router |

### Detalhes técnicos

A nova lógica em `recovery-enqueue.ts` será:

```text
1. Buscar recovery_settings pelo workspace_id (sem filtrar por enabled)
2. Se não existir settings → return
3. Verificar por tipo:
   - boleto → settings.enabled_boleto
   - yampi/yampi_cart → settings.enabled_yampi
   - outros → settings.enabled_pix
4. Se tipo não habilitado → return
5. Verificar duplicata e inserir na fila
```

### Após deploy na VPS

```bash
cd ~/simplificandoconversas/deploy && docker compose up -d --build backend
```

Verificar nos logs:
```bash
docker logs deploy-backend-1 --tail 50 -f
```

Gerar uma transação de teste e confirmar que aparece `[auto-recovery] Enqueued tx ...` nos logs.

