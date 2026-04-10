

## Melhorias visuais na Área de Membros

### Alterações em `src/pages/MemberAccess.tsx`

**1. Remover header "Área de Membros"** (linhas 488-503)
Remover completamente o bloco sticky header com o título "Área de Membros" e saudação.

**2. Cards de produto mais compactos** (linhas 435-483)
- Reduzir altura da imagem de cover de `h-[160px]` para `h-[120px]`
- Reduzir altura do fallback sem imagem de `h-[140px]` para `h-[100px]`
- Remover a barra inferior "Toque para acessar" — o card inteiro já é clicável, não precisa dessa indicação

**3. Caixa de texto da IA mais compacta** (linhas 507-535)
- Reduzir padding do container
- Reduzir tamanho do texto da mensagem de `text-[13px]` para `text-xs`
- Reduzir avatar de `h-10 w-10` para `h-8 w-8`
- Reduzir nome de `text-[13px]` para `text-xs`

**4. Efeito de digitação com delay de 3 segundos**
- Quando a resposta da IA chega, não mostrar imediatamente
- Manter o indicador "digitando..." com os 3 pontinhos por 3 segundos após receber a resposta
- Após o delay, exibir o texto letra por letra (typewriter effect) usando um intervalo de ~20ms por caractere
- Novo estado `typedText` que vai acumulando caracteres do `greeting` com `setInterval`
- O balão mostra `typedText` em vez do texto completo

### Resultado
- Sem header no topo — mais espaço para conteúdo
- Cards mais baixos e sem barra "Toque para acessar"
- Mensagem da IA aparece com delay de 3s + efeito typewriter
- Caixa de chat mais compacta e elegante

