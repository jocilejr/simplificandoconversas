

## Problema

A rede `PrincipalNet` é uma rede Swarm e não permite attach manual por containers `docker compose` (não-Swarm). O erro `not manually attachable` ocorre porque a rede foi criada sem a flag `--attachable`.

## Solução

Recriar a rede `PrincipalNet` com a flag `--attachable`, permitindo que containers standalone (docker compose) se conectem a ela.

### Passos

1. **Verificar se a rede permite attachable:**
   ```bash
   docker network inspect PrincipalNet --format '{{.Attachable}}'
   ```

2. **Se retornar `false`, recriar a rede:**
   ```bash
   # Parar o stack do Traefik temporariamente
   docker stack rm traefik
   
   # Remover a rede antiga
   docker network rm PrincipalNet
   
   # Recriar com --attachable
   docker network create --driver overlay --attachable PrincipalNet
   
   # Redeployar o Traefik stack
   docker stack deploy -c <caminho-do-traefik-compose> traefik
   ```

3. **Subir o compose novamente:**
   ```bash
   cd ~/simplificandoconversas/deploy
   docker compose up -d
   ```

### Importante
- O Traefik ficará fora do ar por alguns segundos durante a recriação da rede
- Nenhuma alteração nos arquivos do projeto é necessária — o problema é na configuração da rede Docker no host

