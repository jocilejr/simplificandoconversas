

## Diagnóstico: 2 problemas

### Problema 1: GoTrue falha ao iniciar (unhealthy)

O GoTrue está crashando antes de passar o healthcheck. O `docker compose up -d` já falha porque o backend depende de `gotrue: condition: service_healthy`, e o GoTrue nunca fica healthy.

**Causa provável:** O GoTrue precisa que o schema `auth` exista com certas tabelas internas. Na versão atual do `init-db.sql`, removemos o `CREATE SCHEMA IF NOT EXISTS auth`. Mas o GoTrue v2.158.1 espera poder fazer suas migrações no schema auth -- porém algumas versões precisam que o schema já exista antes.

**Correção:** 
- Restaurar `CREATE SCHEMA IF NOT EXISTS auth;` no `init-db.sql` (apenas o schema, não as tabelas -- o GoTrue cria as tabelas)
- Remover a dependência `gotrue: condition: service_healthy` do backend -- usar apenas `condition: service_started` para que o compose não bloqueie
- No `install.sh`, o retry loop já cuida de esperar o GoTrue estabilizar

**Importante:** Preciso que você execute `docker compose logs gotrue` na VPS e cole o resultado aqui. Isso vai confirmar a causa exata do crash. As correções acima cobrem o cenário mais provável.

### Problema 2: URL abre outra aplicação

A imagem mostra "Simplificando Grupos" em `app.chatbotsimples.cloud`. Isso é um conflito de roteamento no Traefik -- o outro app na VPS está capturando o tráfego.

**Causa:** Os nomes dos routers Traefik podem estar conflitando, ou o domínio configurado no `.env` não está correto.

**Correção:**
- Verificar que os domínios no `.env` estão corretos e diferentes da outra aplicação
- Usar nomes de router Traefik únicos no `docker-compose.yml` (já usam `simplificando-app` e `simplificando-api`, que devem ser únicos)
- Garantir que o serviço Traefik tenha o `Host()` rule correto para os domínios da nova aplicação

### Mudanças no código

**1. `deploy/init-db.sql`** -- Restaurar criação do schema auth
```sql
CREATE SCHEMA IF NOT EXISTS auth;
```
Adicionar de volta antes do schema storage.

**2. `deploy/docker-compose.yml`** -- Relaxar dependência do GoTrue
- Backend: mudar `gotrue: condition: service_healthy` para `gotrue: condition: service_started`
- Nginx: remover `gotrue` do `depends_on` (nginx não precisa do GoTrue diretamente)

**3. `deploy/install.sh`** -- Adicionar `set +e` antes do `docker compose up -d`
- O `set -e` faz o script inteiro abortar quando o GoTrue falha o healthcheck
- Usar `docker compose up -d || true` para continuar mesmo se o GoTrue não estiver healthy imediatamente
- O retry loop no passo 7 já cuida de esperar

### Próximo passo do usuário

Após aplicar as mudanças, executar na VPS:
```bash
cd ~/simplificandoconversas/deploy
docker compose down -v
rm .env
bash install.sh
```

Se o GoTrue ainda falhar, executar `docker compose logs gotrue` e colar aqui para diagnóstico preciso.

