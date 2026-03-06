

## Plano: Resolver conflito de porta 5432

O PostgreSQL do Docker não precisa expor a porta 5432 para o host — os outros containers (GoTrue, PostgREST, etc.) se conectam pela rede interna do Docker usando o hostname `postgres`.

### Correção

**`deploy/docker-compose.yml`** — Remover o bloco `ports` do serviço `postgres`:

```yaml
# REMOVER estas linhas:
    ports:
      - "5432:5432"
```

Isso elimina o conflito sem afetar nenhuma outra aplicação no servidor.

### Sobre o .env

Os warnings de variáveis não configuradas indicam que o arquivo `deploy/.env` não existe ou está vazio. Após a correção da porta, rode:

```bash
cd ~/simplificandoconversas/deploy
bash ../deploy/install.sh
```

Ou crie manualmente o `.env` seguindo o `deploy/.env.example`.

### Após a correção

```bash
cd ~/simplificandoconversas/deploy && docker compose up -d
```

