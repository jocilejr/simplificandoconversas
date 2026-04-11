## Plano: Redesign do step Boleto com dados pré-preenchidos e botão de edição

### Problemas

O boleto mostra campos vazios mesmo quando o sistema já tem o nome e CPF do lead. A UX atual com dois botões ("Editar dados" / "Confirmar") não é profissional. O botão usa a cor do tema em vez de verde.  
  
PROBLEMA 2: QUANDO ESCOLHO PIX OU CARTÃO NÃO RECEBO A TRANSAÇÃO NA ABA DE TRANSAÇÕES. RESOLVA ISSO

### Alteração em `src/components/membros/PaymentFlow.tsx`

Redesenhar o bloco `step === "boleto" && !boletoSent` (linhas 207-249):

**Novo comportamento:**

- Ao entrar no step boleto, buscar dados via `/api/member-purchase/customer-info` (já implementado)
- **Se dados existirem**: mostrar os dados em modo read-only com visual profissional (card cinza claro com ícones de User e FileText), com um botão de lápis (Pencil icon) no canto superior direito do card para alternar para modo edição
- **Se dados não existirem**: mostrar campos de input diretamente
- **Modo edição**: ao clicar no lápis, os dados viram inputs editáveis com os valores pré-preenchidos
- **Botão "Gerar Boleto"**: sempre verde profissional (`bg-emerald-600 hover:bg-emerald-700`) com sombra verde, sem usar `themeColor`

**Estrutura visual (modo read-only):**

```
Gerar Boleto
R$ 80,00

┌─────────────────────────────┐
│  👤 Nome         ✏️ (lápis) │
│  João Silva                  │
│  📄 CPF                      │
│  123.456.789-01              │
└─────────────────────────────┘

[ 🟢 Gerar Boleto ]
```

**Detalhes técnicos:**

- Adicionar import `Pencil` do lucide-react (linha 7)
- Substituir estado `confirmedData` por `editingData` (boolean, default false)
- Quando `hasExistingData && !editingData`: mostrar card read-only + botão lápis
- Quando `editingData || !hasExistingData`: mostrar inputs
- Botão verde: `className="w-full h-12 rounded-xl font-bold text-white border-0 bg-emerald-600 hover:bg-emerald-700"` com `boxShadow: "0 4px 20px rgba(16,185,129,0.3)"`