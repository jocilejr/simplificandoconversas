

## Causa raiz encontrada

O erro é simples: `GOTRUE_SMTP_PORT` está definido como string vazia `""` no `docker-compose.yml`, e o GoTrue tenta converter para `int`, falhando.

**Nada a ver com roles ou schemas** -- era apenas uma variável de ambiente com valor vazio.

## Correção

No `deploy/docker-compose.yml`, nas variáveis do serviço `gotrue`, mudar as variáveis SMTP vazias para valores válidos ou removê-las:

```yaml
# De:
GOTRUE_SMTP_HOST: ""
GOTRUE_SMTP_PORT: ""
GOTRUE_SMTP_USER: ""
GOTRUE_SMTP_PASS: ""

# Para:
GOTRUE_SMTP_HOST: "localhost"
GOTRUE_SMTP_PORT: "587"
GOTRUE_SMTP_USER: ""
GOTRUE_SMTP_PASS: ""
```

`SMTP_HOST` e `SMTP_PORT` precisam de valores válidos mesmo que o SMTP não seja usado (o GoTrue faz parse obrigatório). `SMTP_USER` e `SMTP_PASS` podem ficar vazios.

## Após aplicar

```bash
cd ~/simplificandoconversas/deploy
docker compose down -v
rm .env
bash install.sh
```

