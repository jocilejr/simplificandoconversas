

## Plano: Migrar para deploy direto com Docker Compose + Corrigir erros de build

### Problema atual
Os arquivos de deploy possuem dois problemas que impedem o build:
1. **`deploy/baileys-service/Dockerfile`** -- falta `RUN apk add --no-cache git` (o pacote `@whiskeysockets/baileys` requer git para instalar)
2. **`deploy/backend/src/routes/evolution-proxy.ts`** -- `@types/node@22` faz `Response.json()` retornar `unknown`, causando 5 erros de TypeScript

Além disso, o deploy usa formato Portainer que será substituído por Docker Compose direto.

---

### Alterações

**1. Corrigir `deploy/baileys-service/Dockerfile`**
Adicionar `RUN apk add --no-cache git` antes do `COPY package.json`.

**2. Corrigir erros TS em `deploy/backend/src/routes/evolution-proxy.ts`**
- Linha 16: `return resp.json() as Promise<any>;`
- Linha 70: `const userData: any = await userResp.json();`

Essas duas mudanças resolvem todos os 5 erros (linhas 29, 71, 102, 195, 221) porque `baileysRequest` já retorna `Promise<any>` e `userData` passa a ser `any`.

**3. Simplificar `deploy/docker-compose.yml`**
- Remover atributo `version` (obsoleto)
- O nginx monta `./frontend` como volume local (sem volume externo do Portainer)
- Já está correto no arquivo atual

**4. Remover `deploy/portainer-stack.yml` e `deploy/PORTAINER.md`**
Não são mais necessários.

**5. Atualizar `deploy/install.sh`**
- Remover referências ao Portainer
- Manter o fluxo: gerar secrets, buildar frontend, `docker compose up -d`
- Já está correto para Docker direto

**6. Criar `deploy/README.md`** (substituindo PORTAINER.md)
Documentação simples para deploy direto na VPS com Docker Compose:
- Pré-requisitos: Docker, Docker Compose, Node.js 20+
- Rodar `./install.sh` (faz tudo automaticamente)
- Comandos úteis: logs, restart, update
- Arquitetura da stack

---

### Resumo dos arquivos
| Arquivo | Ação |
|---------|------|
| `deploy/baileys-service/Dockerfile` | Adicionar `git` |
| `deploy/backend/src/routes/evolution-proxy.ts` | Cast `any` em 2 pontos |
| `deploy/docker-compose.yml` | Remover `version` |
| `deploy/portainer-stack.yml` | Deletar |
| `deploy/PORTAINER.md` | Deletar |
| `deploy/README.md` | Criar (docs de deploy direto) |

