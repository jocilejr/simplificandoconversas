

## Plano: Atualizar favicon para a logo do projeto

O `index.html` não tem uma tag `<link rel="icon">` explícita, então o browser usa o `favicon.ico` padrão. A logo do projeto já existe em `public/images/logo-ov.png`.

### Alteração

**`index.html`** — Adicionar tag de favicon no `<head>` apontando para a logo existente:

```html
<link rel="icon" type="image/png" href="/images/logo-ov.png">
```

Isso fará o ícone da aba do Chrome exibir a logo do projeto.

