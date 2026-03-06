

## Situação atual

1. O serviço `traefik_traefik` foi removido (por comando anterior), derrubando o proxy reverso de **todas** as aplicações
2. O compose do Traefik **não está** nos diretórios do Portainer (composes 5,8,9,13,14,15 são typebot, minio, rabbitmq, evolution, n8n, wordpress)
3. O Traefik foi provavelmente deployado diretamente via Portainer UI como um stack, mas o compose original não está visível nos arquivos encontrados

## Ação imediata: Restaurar o Traefik

Precisamos verificar o compose do Traefik. Ele pode estar em outro compose do Portainer (não listamos todos) ou no `/opt/dash-origem-viva/docker-compose-swarm.yml`. Execute:

```bash
# 1. Listar TODOS os composes do Portainer
ls /var/lib/docker/volumes/portainer_data/_data/compose/

# 2. Verificar o arquivo do dash-origem-viva (pode conter o Traefik)
cat /opt/dash-origem-viva/docker-compose-swarm.yml | head -50

# 3. Verificar se existe um stack "traefik" no Portainer data
find /var/lib/docker/volumes/portainer_data/_data -name "*.yml" -exec grep -l "traefik/traefik" {} \; 2>/dev/null
```

Se o compose do Traefik for encontrado, o deploy será:
```bash
docker stack deploy -c <arquivo-encontrado> traefik
```

## Sobre a rede PrincipalNet

Após restaurar o Traefik, para integrar nosso compose sem derrubar nada, a alternativa menos invasiva é **não usar a rede overlay** e sim expor as portas do Nginx diretamente, adicionando labels do Traefik via Docker API. Mas isso será tratado depois — a prioridade agora é restaurar o Traefik.

