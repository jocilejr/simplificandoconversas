

# Plano: Corrigir sync congelado do Smart Link

## Problema
Quando o backend reinicia durante um `sync-all` (ex: deploy), o campo `sync_progress` fica com valor não-nulo para sempre. O frontend vê isso e mostra "Sincronizando..." infinitamente. Não existe nenhum mecanismo de recuperação.

Dois bugs específicos:
1. **Catch block (linha 1851-1857)**: quando o sync dá erro, ele grava `last_sync_error` mas **não limpa** `sync_progress: null`. O progresso fica preso.
2. **Sem detecção de sync stale**: se o processo morreu, ninguém limpa o `sync_progress` antigo.

## Correção

### 1. Backend — `deploy/backend/src/routes/groups-api.ts`

**A) No catch block do sync-all (~linha 1853):** adicionar `sync_progress: null` ao update de erro:
```typescript
await sb.from("group_smart_links").update({
  sync_progress: null,  // ← ADICIONAR
  last_sync_error: e.message || "Unknown error",
  last_sync_error_at: new Date().toISOString(),
}).eq("id", sl.id);
```

**B) No início do sync-all (~linha 1712, logo após buscar os smart links):** resetar sync_progress travados há mais de 10 minutos:
```typescript
// Recover stale syncs (stuck >10 min)
await sb.from("group_smart_links")
  .update({ sync_progress: null, last_sync_error: "Sync travou — resetado automaticamente" })
  .not("sync_progress", "is", null)
  .lt("updated_at", new Date(Date.now() - 10 * 60 * 1000).toISOString());
```

**C) No catch block do sync-invite manual (~linha 1608):** mesma correção — limpar `sync_progress: null` no erro.

### 2. Para destravar agora (VPS)
```bash
docker exec deploy-postgres-1 psql -U postgres -d postgres -c "
UPDATE group_smart_links 
SET sync_progress = NULL, 
    last_sync_error = 'Sync travado — resetado manualmente',
    last_sync_error_at = now(),
    updated_at = now()
WHERE sync_progress IS NOT NULL;
"
```

### 3. Deploy
```bash
cd ~/simplificandoconversas && git pull && cd deploy && docker compose up -d --build backend
```

## Resultado esperado
- Se o sync crashar ou o backend reiniciar, o `sync_progress` é limpo automaticamente no próximo ciclo (máx 10 min)
- O catch block não "esquece" de limpar o progresso
- O frontend para de mostrar "Sincronizando..." infinitamente

