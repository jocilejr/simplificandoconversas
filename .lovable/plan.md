
Objetivo: destravar o debug do metaPixel agora e eliminar a ambiguidade de ambiente (o `curl localhost:3001` está batendo em outro serviço, não no backend do compose atual).

1) Diagnóstico confirmado (causa raiz)
- O container `deploy-backend-1` está rodando, mas no `docker compose ps` ele aparece com `3001/tcp` (sem bind para host).
- Portanto, `curl http://localhost:3001/...` no host não deveria atingir esse container; está atingindo outro processo legado que responde `"Token não fornecido"`.
- Isso explica por que os logs esperados de metaPixel não aparecem.

2) Plano de debug imediato (sem alterar código)
- Validar quem está ouvindo a porta 3001 no host:
  - `ss -ltnp | grep :3001`
  - `docker ps --format '{{.Names}} {{.Ports}}' | grep 3001`
- Testar o health no backend correto (dentro da rede docker):
  - `docker compose exec backend sh -lc "wget -qO- http://localhost:3001/api/health/db"`
- Testar o mesmo endpoint via nginx interno:
  - `docker compose exec nginx sh -lc "wget -qO- http://backend:3001/api/health/db"`
- Só depois disso, monitorar logs e disparar fluxo:
  - `docker compose logs -f backend 2>&1 | grep -Ei "metaPixel|Processing node|execute-flow|meta_pixels"`

3) Validação funcional do metaPixel (na VPS)
- Confirmar pixel salvo para o usuário:
  - consultar `meta_pixels` no postgres do stack (id, user_id, pixel_id).
- Confirmar que o nó do fluxo usa `selectedPixelId` válido.
- Disparar fluxo real e observar:
  - se aparece `metaPixel query error` => problema de DB/permissão/dado.
  - se aparece `metaPixel response` com `error` da Meta => credencial/pixel/evento.
  - se não aparece `metaPixel` mas aparece `Processing node` => fluxo não está passando no nó.

4) Endurecimento de diagnóstico (implementação recomendada em seguida)
- Em `execute-flow.ts`, tratar `metaResult.error` antes de marcar `ok`.
- Criar endpoint dedicado `/api/health/meta-pixel-test` para disparo isolado.
- Adicionar `/api/health/version` com identificador de build (commit/timestamp) para evitar confusão entre serviços.
- No `update.sh`, incluir pós-deploy check obrigatório chamando health via `docker compose exec backend ...`; se falhar, abortar atualização.

5) Resultado esperado após aplicar o plano
- Você passa a testar o backend correto do stack.
- O erro `"Token não fornecido"` deixa de ser referência para esse serviço.
- O ponto exato da falha do pixel fica visível (consulta DB, payload, ou resposta da Meta), sem tentativa cega.
