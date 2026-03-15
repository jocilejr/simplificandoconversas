

## Problema

O `package-lock.json` está desatualizado em relação ao `package.json`. O `npm ci` exige sincronização exata e falha. Além disso, o script parou antes de completar os passos 3 e 4.

## Plano

1. **Atualizar `deploy/update.sh`** — trocar `npm ci` por `npm install` no fallback npm (linha que já existe), garantindo que o lockfile seja atualizado automaticamente durante o build.

2. **Corrigir o caminho do docker compose** — o erro "no configuration file provided" indica que o `docker compose` não encontrou o `docker-compose.yml` porque o script mudou de diretório. Garantir que os comandos de migration e rebuild rodem no diretório correto (`$DEPLOY_DIR`).

Após implementar, rode na VPS:
```bash
cd ~/simplificandoconversas && npm install && cd deploy && chmod +x update.sh && ./update.sh
```

