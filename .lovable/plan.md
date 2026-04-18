
O usuário quer que o `update.sh` faça automaticamente o "Pull and redeploy" no Swarm — criando o serviço `baileys-gateway` quando ele não existir, sem precisar abrir o Portainer.

**Diagnóstico:**
- No Swarm, `docker service update` só atualiza serviços que já existem.
- Quando um novo serviço é adicionado ao stack (caso do `baileys-gateway`), é preciso fazer `docker stack deploy` apontando pro `portainer-stack.yml` pra criar o serviço novo.
- O script atual detecta Swarm mas só faz `service update --force`, então pula serviços ausentes.

**Solução:**
Modificar `deploy/update.sh` no passo [5/5] pra, quando estiver em Swarm, executar `docker stack deploy -c deploy/portainer-stack.yml ${STACK_NAME}` em vez de iterar `service update`. Isso:
1. Cria serviços novos (ex: `baileys-gateway`)
2. Atualiza os existentes com as novas imagens
3. Mantém o mesmo comportamento que "Pull and redeploy" do Portainer

Detalhes:
- Carregar `.env` já é feito no início do script — o `stack deploy` vai herdar as variáveis via `export` (preciso garantir export das vars do `.env`).
- Após `stack deploy`, forçar update das imagens locais recém-buildadas (`backend`, `baileys-gateway`) com `--force` pra garantir que o Swarm pegue a nova `:latest`.
- Manter fallback do compose intacto.

**Plano de mudanças (1 arquivo):**

`deploy/update.sh` — passo [5/5] no branch Swarm:
```bash
# Garante export das variáveis do .env pro stack deploy
set -a; source "$DEPLOY_DIR/.env"; set +a

echo "   → Aplicando stack (cria serviços novos + atualiza existentes)..."
docker stack deploy -c "$DEPLOY_DIR/portainer-stack.yml" "$STACK_NAME" --with-registry-auth --resolve-image=always
echo "✓ Stack aplicada"

# Força recriação dos serviços que receberam imagens novas
for svc in backend baileys-gateway nginx; do
  if docker service inspect "${STACK_NAME}_${svc}" >/dev/null 2>&1; then
    docker service update --force "${STACK_NAME}_${svc}" >/dev/null 2>&1 \
      && echo "✓ ${svc} reiniciado" \
      || echo "⚠ Falha reiniciando ${svc}"
  fi
done
```

Depois disso, basta `cd /opt/simplificandoconversas && git pull && bash deploy/update.sh` e o `baileys-gateway` sobe automaticamente — sem precisar do Portainer.
