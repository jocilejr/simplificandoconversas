

## Instalação com um único `install.sh`

O script atual já faz quase tudo automaticamente, mas precisa de alguns ajustes para ficar completo:

### Problemas atuais

1. **Domínios não são perguntados** -- o script usa o IP público como fallback, mas não pergunta interativamente se o usuário quer usar domínios personalizados
2. **docker-compose.yml desatualizado** -- o Nginx ainda referencia `default.conf` em vez do template `default.conf.template` com envsubst
3. **Falta passar `APP_DOMAIN`/`API_DOMAIN`** como env vars para o container Nginx no docker-compose.yml

### Mudanças

1. **`deploy/install.sh`** -- Adicionar prompt interativo no início:
   - Perguntar `APP_DOMAIN` (default: IP público)
   - Perguntar `API_DOMAIN` (default: mesmo que APP_DOMAIN)
   - Mostrar resumo antes de continuar
   - Atualizar as URLs de saída no final para mostrar os domínios corretos

2. **`deploy/docker-compose.yml`** -- Sincronizar com o `portainer-stack.yml`:
   - Nginx: trocar volume de `default.conf` para `default.conf.template` em `/etc/nginx/templates/`
   - Nginx: adicionar env vars `APP_DOMAIN` e `API_DOMAIN`
   - Backend: adicionar `API_DOMAIN` como env var
   - GoTrue: usar `APP_DOMAIN` nas URLs (GOTRUE_SITE_URL, API_EXTERNAL_URL)
   - Remover portas internas desnecessárias (PostgREST, GoTrue, Storage) -- só Nginx precisa expor 80/443

### Resultado

O usuário faz:
```bash
git clone <REPO> app
cd app/deploy
chmod +x install.sh
./install.sh
```

O script pergunta os domínios, gera secrets, builda o frontend, sobe tudo com Docker, e no final mostra as URLs de acesso. Zero configuração manual.

