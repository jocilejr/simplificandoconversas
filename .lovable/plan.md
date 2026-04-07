
## Diagnóstico

O comportamento faz sentido com o código atual: a configuração “por tipo” ainda está misturada com o campo legado `instance_name`.

### Causa raiz
1. Em `src/components/transactions/AutoRecoveryConfig.tsx`, ao abrir o modal:
   - `instance_boleto` cai em `instance_name`
   - `instance_pix` cai em `instance_name`
   - `instance_yampi` cai em `instance_name`

   Hoje está assim:
   ```ts
   setInstanceBoleto(s.instance_boleto || s.instance_name || "");
   setInstancePix(s.instance_pix || s.instance_name || "");
   setInstanceYampi(s.instance_yampi || s.instance_name || "");
   ```

2. Ao salvar, o modal grava também:
   ```ts
   instance_name: instanceBoleto || instancePix || instanceYampi || null
   ```
   Então, se você escolhe só o número de boletos, esse valor vira o `instance_name` geral.

3. Na próxima leitura, como PIX e Yampi estão vazios, eles recebem fallback de `instance_name`, parecendo que “foi para todos”.

4. Existe ainda uma segunda tela em `src/pages/RecuperacaoBoletos.tsx` que continua usando apenas `instance_name`, então há dois modelos diferentes escrevendo na mesma tabela.

## Plano de correção

### 1) Separar de verdade os 3 selects
Em `AutoRecoveryConfig.tsx`:
- carregar cada campo apenas da sua coluna própria
- remover o fallback automático para `instance_name`

Novo comportamento esperado:
```ts
setInstanceBoleto(s.instance_boleto || "");
setInstancePix(s.instance_pix || "");
setInstanceYampi(s.instance_yampi || "");
```

### 2) Parar de espelhar um campo no outro ao salvar
Ainda em `AutoRecoveryConfig.tsx`:
- salvar `instance_boleto`, `instance_pix` e `instance_yampi` separadamente
- não popular `instance_name` com base em um dos três campos

Isso impede que escolher “Boletos” contamine PIX e Yampi.

### 3) Alinhar a tela antiga com a nova estrutura
Em `src/pages/RecuperacaoBoletos.tsx`:
- revisar o uso de `instance_name`
- decidir entre:
  - migrar essa tela para usar também os 3 campos separados, ou
  - deixá-la explicitamente como configuração legada sem sobrescrever a nova configuração

Minha recomendação: migrar essa tela para o mesmo modelo dos 3 campos, para evitar conflito futuro.

### 4) Manter compatibilidade no backend sem reintroduzir o bug
No backend (`deploy/backend/src/routes/auto-recovery.ts`):
- o fallback para `instance_name` pode continuar só como compatibilidade para registros antigos
- mas a UI não deve mais reutilizar esse fallback para preencher visualmente os 3 selects

## O que isso vai resolver
- selecionar um número em “Boletos” não preencherá PIX/Yampi
- cada tipo ficará independente
- o workspace continua isolado normalmente, porque a leitura já usa `workspace_id`

## Verificação na VPS

Antes e depois da correção, confirme o que está sendo salvo no banco:

```bash
docker compose exec -T postgres psql -U postgres -d postgres -c "SELECT workspace_id, instance_name, instance_boleto, instance_pix, instance_yampi, enabled, updated_at FROM public.recovery_settings ORDER BY updated_at DESC;"
```

### Resultado esperado após a correção
Se você salvar apenas:
- Boletos = `Recuperação de Boletos`

O registro deve ficar parecido com:
```text
instance_boleto = Recuperação de Boletos
instance_pix = null
instance_yampi = null
instance_name = null   -- ou preservado apenas se houver estratégia legada consciente
```

## Arquivos a ajustar
- `src/components/transactions/AutoRecoveryConfig.tsx`
- `src/pages/RecuperacaoBoletos.tsx`
- `deploy/backend/src/routes/auto-recovery.ts` (somente revisão de compatibilidade)
