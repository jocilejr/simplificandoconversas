

A porta 80 está sendo usada por **outro container Docker** (provavelmente de outra aplicação). Há duas opções:

### Opção 1: Mudar a porta do Nginx deste deploy (mais simples)
Alterar `deploy/docker-compose.yml` para usar outra porta (ex: `8080:80`). Acesso via `http://seu-ip:8080`.

### Opção 2: Usar o Nginx existente como reverse proxy
Não expor a porta 80 neste compose e configurar um virtual host no Nginx que já roda na porta 80, fazendo proxy para este deploy.

---

### Plano (Opção 1 — porta 8080)

**`deploy/docker-compose.yml`** — No serviço `nginx`, trocar:
```yaml
ports:
  - "80:80"
  - "443:443"
```
por:
```yaml
ports:
  - "8080:80"
```

Após o deploy: `docker compose up -d`

Acesso: `http://SEU_IP:8080`

