

## Plano: Mostrar token do Access Token no Pixel e investigar problema de disparo

### 1. Tornar o Access Token visível

**`src/components/settings/AppSection.tsx`**:

- Na view de leitura (`!editing`, linha 22-35): adicionar uma linha truncada mostrando os primeiros 20 caracteres do token + "..." com um botão de copiar ou toggle de visibilidade (ícone Eye/EyeOff).
- Na view de edição (linha 48-51): adicionar um toggle Eye/EyeOff ao lado do input para alternar entre `type="password"` e `type="text"`.

Isso permite ao usuário verificar rapidamente se o token salvo está correto, sem precisar entrar em modo de edição.

### 2. Sobre o Pixel não estar marcando

Isso é um problema no backend self-hosted (`deploy/backend/src/routes/webhook.ts` ou `execute-flow.ts`). Preciso investigar como o nó `metaPixel` busca o pixel e dispara para a API do Meta. Posso verificar isso em paralelo ou como próximo passo após essa mudança de UI.

