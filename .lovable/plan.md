

## Substituir slider por ícone de engrenagem com input manual

### O que será feito

Remover o slider de "Intervalo entre mensagens" que ocupa espaço abaixo de cada instância. No lugar, adicionar um botão de engrenagem (⚙️) na barra de ações da instância que abre um Popover com um input numérico onde o usuário digita manualmente o número de segundos (1–10).

### Mudanças

**`src/components/settings/ConnectionsSection.tsx`**

1. Importar `Settings` (lucide) e `Popover`/`PopoverTrigger`/`PopoverContent` do shadcn
2. Remover o bloco do slider (linhas 343-364) — o `<div className="mt-3 pt-3 border-t">` inteiro com slider, labels 1s/10s
3. Na barra de botões de ação (linha 284, `<div className="flex items-center gap-1">`), adicionar um botão de engrenagem com Popover:
   - Botão: ícone `Settings` (engrenagem), `variant="ghost"`, `size="sm"`
   - Popover: contém label "Intervalo entre mensagens", um `Input type="number"` (min 1, max 10, step 0.5) mostrando o valor atual em segundos, e um botão "Salvar"
   - Ao salvar, chama `updateDelay.mutate(...)` e fecha o popover

### Resultado
Interface mais limpa — a engrenagem fica alinhada com os outros botões (QR Code, Reconexão, Sincronizar, Ativar, Lixeira). O intervalo só aparece quando o usuário clica na engrenagem.

