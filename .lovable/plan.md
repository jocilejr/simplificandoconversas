

## Diagnóstico

O erro "Could not find the 'meta_access_token' column of 'profiles' in the schema cache" indica que as colunas `meta_pixel_id` e `meta_access_token` não existem mais na tabela `profiles` do banco de dados, mas o código ainda as referencia em `useProfile.ts`.

Como os pixels agora são gerenciados pela tabela `meta_pixels` (via `useMetaPixels`), essas referências legadas devem ser removidas.

## Plano

1. **Limpar `useProfile.ts`** — remover `meta_pixel_id` e `meta_access_token` do tipo do mutation `updateProfile`, já que essas configurações agora vivem na tabela `meta_pixels`.

2. **Remover colunas legadas do banco** — criar migration para dropar `meta_pixel_id` e `meta_access_token` da tabela `profiles` (se ainda existirem), garantindo consistência.

3. **Atualizar `deploy/init-db.sql`** — remover essas colunas da definição inicial da tabela `profiles` para novos deploys.

