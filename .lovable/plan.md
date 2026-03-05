

## Deploy via Portainer

### Problema

O `docker-compose.yml` atual usa `build: ./baileys-service` e `build: ./backend`, que precisam do código-fonte local para buildar. No Portainer, o ideal é usar **imagens pré-buildadas** ou apontar para um **repositório Git**.

### Abordagem: Portainer Stack com Git Repository

O Portainer suporta **Stacks** que puxam um `docker-compose.yml` direto de um repositório Git. A forma mais simples:

1. **Adaptar o `docker-compose.yml`** para que os serviços `backend` e `baileys` usem imagens de um registry (GitHub Container Registry ou Docker Hub) em vez de `build` local
2. **Criar um `portainer-compose.yml`** alternativo que funcione sem build context -- usando multi-stage builds inline ou imagens publicadas
3. **Criar um guia** de como configurar a Stack no Portainer

### O que muda

Como o Portainer **não suporta `build:`** direto em Stacks (apenas imagens), temos duas opções:

**Opção A -- GitHub + Portainer Git deploy (recomendado)**
- O Portainer puxa o repo Git inteiro e faz `docker compose up` com build
- Basta apontar o Portainer para o repo, path `deploy/`, e adicionar as env vars
- Funciona com o `docker-compose.yml` atual sem mudanças

**Opção B -- Imagens publicadas no GHCR**
- Criar GitHub Actions para buildar e publicar as imagens `backend` e `baileys-service`
- O compose referencia `ghcr.io/usuario/backend:latest` em vez de `build: ./backend`
- Mais limpo no Portainer, mas exige CI/CD

### Plano de implementação

1. **Criar `deploy/portainer-stack.yml`** -- versão do compose otimizada para Portainer:
   - Substituir `build:` por referência ao Git repo (Portainer faz o build se configurado como "Git repository" stack)
   - Mover volumes de config (nginx, init-db) para configs inline ou volumes nomeados
   - Remover portas internas desnecessárias (só expor Nginx 80/443)

2. **Criar `deploy/PORTAINER.md`** -- guia passo a passo:
   - Como criar a Stack no Portainer
   - Como configurar as variáveis de ambiente
   - Como buildar o frontend e colocar no volume
   - Como acessar o sistema

3. **Ajustar `deploy/docker-compose.yml`** -- tornar compatível com Portainer Git deploy:
   - Adicionar labels para organização
   - Garantir que o `init-db.sql` seja montado corretamente via volume

Na prática, como você já usa Portainer: vá em **Stacks > Add Stack > Repository**, aponte para o seu repo Git, defina `deploy/` como compose path, preencha as env vars, e clique em Deploy. O Portainer faz o build e sobe tudo.

O principal entregável é o `PORTAINER.md` com instruções claras e um `portainer-stack.yml` otimizado.

