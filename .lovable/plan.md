

## Plano: Integrar stack com Traefik existente

### Contexto
O Traefik roda em Docker Swarm na rede `PrincipalNet`, com HTTPS via Let's Encrypt (`letsencryptresolver`) e redirect HTTP→HTTPS automático. Ele descobre serviços via labels Docker com `exposedbydefault=false`.

### Alterações no `deploy/docker-compose.yml`

**No serviço `nginx`:**
1. Remover `ports: - "8080:80"` (Traefik fará o roteamento)
2. Adicionar a rede externa `PrincipalNet`
3. Adicionar labels do Traefik para dois domínios:

   - **app.chatbotsimples.cloud** → rota para o Nginx interno (frontend + API)
   - **api.chatbotsimples.cloud** → mesma rota (o Nginx interno já faz o split por server_name)

Labels a adicionar:
```text
traefik.enable=true
traefik.http.routers.simplificando-app.rule=Host(`app.chatbotsimples.cloud`)
traefik.http.routers.simplificando-app.entrypoints=websecure
traefik.http.routers.simplificando-app.tls.certresolver=letsencryptresolver
traefik.http.routers.simplificando-api.rule=Host(`api.chatbotsimples.cloud`)
traefik.http.routers.simplificando-api.entrypoints=websecure
traefik.http.routers.simplificando-api.tls.certresolver=letsencryptresolver
traefik.http.services.simplificando-nginx.loadbalancer.server.port=80
```

**Adicionar rede externa no final do compose:**
```yaml
networks:
  default:
  traefik:
    external: true
    name: PrincipalNet
```

**Conectar o nginx à rede traefik:**
```yaml
nginx:
  networks:
    - default
    - traefik
```

### Resultado
- Traefik roteará `app.chatbotsimples.cloud` e `api.chatbotsimples.cloud` para o Nginx interno
- SSL será provisionado automaticamente pelo Let's Encrypt
- Não é necessário parar nenhum serviço existente, basta `docker compose down && docker compose up -d`

