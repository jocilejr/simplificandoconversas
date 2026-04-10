

## Problemas identificados

### 1. Scroll quebrado no "Ver mais"
O componente tem **dois containers de scroll sobrepostos**:
- Linha 395: `<div className="... max-h-[calc(90vh-120px)] overflow-y-auto">` (container pai)
- Linha 517: `<ScrollArea className="max-h-[400px]">` (container filho)

Quando o conteúdo cresce ao clicar "Ver mais", o `ScrollArea` interno bate no `max-h-[400px]` e o `overflow-y-auto` do pai conflita com o scroll interno do Radix ScrollArea. Resultado: o scroll trava.

**Correção**: Remover o `max-h` fixo do ScrollArea e deixar apenas o container pai controlar o overflow. Ou melhor: remover o `overflow-y-auto` do pai e deixar o ScrollArea ser o único responsável pelo scroll, com altura dinâmica baseada no viewport.

### 2. Possível filtragem indevida por `type`
A query na linha 147 filtra `.eq("type", "pix")`. Se transações OpenPix forem salvas com outro valor de `type` (ex: `"pix_openpix"`, `"openpix"`), elas serão excluídas. Preciso da resposta dos comandos SQL acima para confirmar.

---

## Plano de correção

### Arquivo: `src/components/entrega/DeliveryFlowDialog.tsx`

**A. Corrigir scroll (garantido)**
- Remover `overflow-y-auto` do container pai (linha 395) quando estiver no step `select-tx`
- No `ScrollArea` (linha 517), trocar `max-h-[400px]` por `max-h-[calc(70vh-200px)]` para adaptar ao viewport
- Isso elimina o conflito de dois scroll containers aninhados

**B. Ampliar filtro de tipo (condicional — depende da resposta SQL)**
- Se houver tipos além de `"pix"`, trocar `.eq("type", "pix")` por `.in("type", ["pix", "pix_openpix", ...])` ou remover o filtro de tipo e filtrar apenas por `status = aprovado` + `source` relevante

### Verificação na VPS
```bash
docker exec deploy-nginx-1 sh -lc 'grep -c "70vh" /usr/share/nginx/html/assets/*.js && echo "BUILD OK" || echo "BUILD ANTIGO"'
```

