

## Fix: Baileys Docker Build — Git não encontrado

O erro ocorre porque o pacote `@whiskeysockets/baileys` precisa do `git` para ser instalado (ele referencia dependências via Git), mas a imagem `node:20-alpine` não inclui `git` por padrão.

### Mudança

**`deploy/baileys-service/Dockerfile`** — Adicionar `apk add --no-cache git` antes do `npm install`:

```dockerfile
FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache git
COPY package.json ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npx tsc
EXPOSE 8084
CMD ["node", "dist/index.js"]
```

Uma única linha resolve o problema.

