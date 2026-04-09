
# Reformulação total da Entrega Digital

## Diagnóstico do problema
O layout atual realmente ainda preserva a estrutura antiga:
- o dialog continua estreito (`max-w-md`)
- o header é só uma linha com nome + valor
- o botão de fechar do componente base fica absoluto no canto superior direito e invade a área do badge de valor
- a seleção de pagamento ainda parece uma lista simples, não uma interface nova
- o card de produto também continua com visual básico demais

Ou seja: mudou conteúdo, mas não mudou a arquitetura visual.

## O que vou reformular

### 1. Refazer completamente o `DeliveryFlowDialog`
Arquivo: `src/components/entrega/DeliveryFlowDialog.tsx`

Vou trocar o layout atual por um dialog totalmente novo, com cara de painel premium:

- aumentar largura do dialog para um formato mais nobre (`sm:max-w-2xl` ou similar)
- criar um header em 2 blocos:
  - lado esquerdo: produto, slug e contexto da ação
  - lado direito: valor em card/badge próprio
- reservar espaço real para o botão `X`, eliminando a sobreposição com o valor
- remover a sensação de “modal padrão com campos empilhados”

### 2. Criar uma composição visual totalmente diferente por etapa
Em vez de um bloco simples trocando conteúdo, vou organizar assim:

```text
┌──────────────────────────────────────────────┐
│ Header refinado com produto + valor          │
├──────────────────────────────────────────────┤
│ Stepper/status discreto                      │
├──────────────────────────────────────────────┤
│ Conteúdo principal da etapa                  │
│                                              │
│ [telefone]                                   │
│ ou                                           │
│ [3 cards de pagamento em grid]               │
│ ou                                           │
│ [resumo do lead + acesso + link]             │
└──────────────────────────────────────────────┘
```

### 3. Etapa 1: telefone com visual novo
Não será mais só input + botão soltos.

Vou criar:
- bloco introdutório com texto curto e sofisticado
- campo de telefone dentro de card clean
- botão “Continuar” menor, alinhado com elegância
- microtexto de apoio discreto
- espaçamento, contraste e hierarchy no padrão da ferramenta

### 4. Etapa 2: pagamento em grid visual realmente novo
Hoje parece lista. Vou refazer como 3 cards em grid, com linguagem visual premium:

- 3 cards lado a lado em desktop
- ícones menores e sofisticados
- títulos curtos e subtítulos discretos
- hover e selected state elegantes
- borda, fundo e densidade visual alinhados ao resto do sistema
- cada card com composição própria, não “botão grande genérico”

Cards:
- PIX
- Cartão
- Boleto

### 5. Etapa 3/4: unificar resultado em uma tela mais profissional
Vou transformar a área final em uma composição com dois blocos:

**Bloco A — Identidade do lead**
- nome
- telefone
- email
- CPF
- status de correspondência/encontro
- produtos já liberados

**Bloco B — Liberação**
- método usado
- produto liberado
- link final
- mensagem pronta para copiar
- CTA discreto de copiar
- ação “Nova liberação”

Tudo com visual minimalista, usando:
- `rounded-xl`
- divisões elegantes
- tipografia menor e mais refinada
- badges secundárias pequenas
- sem cards “pesados” ou botões exagerados

### 6. Melhorar também os cards de produto na aba
Arquivo: `src/components/entrega/ProductsTab.tsx`

Vou reformular os próprios cards dos produtos para já preparar a experiência:
- card com mais presença visual
- área clicável mais clara
- valor com melhor destaque
- slug e status mais organizados
- ações de editar/duplicar/excluir mais discretas
- hover mais sofisticado
- sensação de “abrir fluxo” ao clicar no card

Assim a aba inteira fica coerente, não só o modal.

## Correção específica do X em cima do valor
O problema vem do `DialogContent` com botão close absoluto no topo direito e do header atual que usa o mesmo espaço visual.

Vou corrigir isso no redesign de duas formas:
- reorganizar o topo com padding direito suficiente para o close
- tirar o valor da mesma linha do canto superior direito, colocando-o em um bloco separado e protegido

Resultado: sem sobreposição e com topo muito mais elegante.

## Referência visual que vou seguir
Vou aproximar a Entrega Digital do padrão visual já visto nos melhores trechos da ferramenta:
- estrutura refinada como dialogs de detalhe
- `rounded-xl`
- divisores suaves
- ícones lucide pequenos
- texto técnico discreto
- cards limpos, sem excesso de cor
- aparência profissional e não genérica

## Arquivos que serão alterados
- `src/components/entrega/DeliveryFlowDialog.tsx`
- `src/components/entrega/ProductsTab.tsx`

## Resultado esperado
Depois dessa mudança:
- a aba ficará visualmente diferente da antiga
- o fluxo de liberação parecerá um painel novo, não uma adaptação
- o botão `X` não vai mais colidir com o valor
- os cards de pagamento terão aparência profissional
- o card com dados do lead ficará minimalista e premium
- a experiência inteira da Entrega Digital vai ficar coerente com uma ferramenta SaaS bem acabada

## Observação importante para sua VPS
Como você usa só a VPS, depois da implementação eu também vou te passar exatamente o que validar aí dentro:
- qual arquivo conferir
- como verificar se o build novo subiu
- como confirmar que o componente novo está sendo servido pela VPS
