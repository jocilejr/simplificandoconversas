

## Diagnóstico: "Erro ao adicionar pixel"

A tabela `meta_pixels` existe no banco, o schema está correto, e as políticas RLS estão configuradas adequadamente. O problema mais provável é que o **token JWT do usuário está expirado** (o token capturado mostra `exp: ~2026-03-13`, mas a data atual é 2026-03-15), e o auto-refresh pode ter falhado silenciosamente, fazendo com que a requisição de insert seja rejeitada pelo RLS.

Além disso, o hook `useMetaPixels` usa casts `as any` desnecessários (a tabela `meta_pixels` JÁ existe nos types gerados), o que esconde possíveis erros de tipagem.

## Correções

### 1. Remover casts `as any` do hook `useMetaPixels`
- A tabela `meta_pixels` já está nos types do Supabase, então os casts são desnecessários e escondem erros
- Remover todos os `as any` das chamadas `.from()`, `.insert()`, `.update()` e do retorno

### 2. Melhorar tratamento de erro
- Adicionar `err.message` na descrição do toast de erro (já está lá, mas garantir que a mensagem real do Supabase apareça)
- Adicionar um `console.error` antes do toast para facilitar debug futuro

### 3. Forçar refresh de sessão antes do insert
- No `mutationFn` do `addPixel`, usar `supabase.auth.getUser()` (que já faz refresh automático) - isso já está implementado, mas verificar se o token retornado está válido

Essas mudanças vão: (a) melhorar a tipagem, (b) mostrar o erro real do Supabase no toast, e (c) garantir que a sessão esteja válida antes do insert.

