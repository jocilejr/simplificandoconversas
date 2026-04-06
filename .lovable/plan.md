

# Endereço aleatório via API de CEP para boletos

## Abordagem
Em vez de armazenar 3000 endereços completos, armazenar apenas ~3000 CEPs válidos de cidades brasileiras. Na hora de gerar um boleto, sortear um CEP e consultar a **BrasilAPI** (`https://brasilapi.com.br/api/cep/v2/{cep}`) para obter o endereço completo automaticamente.

## Alterações

### 1. Novo arquivo: `deploy/backend/src/lib/random-ceps.ts`
- Array exportado com ~3000 CEPs válidos de capitais e cidades grandes
- Função `getRandomCep()` que retorna um CEP aleatório

### 2. Novo arquivo: `deploy/backend/src/lib/cep-lookup.ts`
- Função `async lookupCep(cep: string)` que consulta `https://brasilapi.com.br/api/cep/v2/{cep}`
- Retorna objeto formatado para o Mercado Pago: `{ zip_code, street_name, neighborhood, city, federal_unit }`
- `street_number` sempre `"s/n"`
- Fallback para AwesomeAPI (`https://cep.awesomapi.com.br/json/{cep}`) caso BrasilAPI falhe

### 3. `deploy/backend/src/routes/payment.ts`
- Importar `getRandomCep` e `lookupCep`
- Na rota `/create`, quando `type === "boleto"`:
```ts
const cep = getRandomCep();
const addr = await lookupCep(cep);
paymentBody.payer.address = addr;
```
- Nenhuma alteração no frontend

## Resultado
Cada boleto terá um endereço real diferente, obtido dinamicamente via API de CEP. O formulário continua sem pedir endereço ao usuário.

