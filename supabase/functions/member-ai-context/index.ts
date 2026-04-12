import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const categories = [
  { id: "salmo", instruction: "Compartilhe um salmo ou versículo bíblico que combina com o momento dessa pessoa. Cite o livro, capítulo e versículo. Conecte o versículo com algo pessoal dela." },
  { id: "progresso", instruction: "Comente especificamente sobre o progresso dela nos materiais, citando nomes exatos e porcentagens. Se não houver progresso, incentive a começar um material específico pelo nome." },
  { id: "reflexao", instruction: "Compartilhe uma reflexão pessoal sua, algo que você pensou hoje de manhã ou que Deus colocou no seu coração. Seja genuína e específica." },
  { id: "curiosidade", instruction: "Conte uma curiosidade bíblica interessante, uma história pouco conhecida da Bíblia, ou um fato surpreendente sobre um personagem bíblico. Seja específica e educativa." },
  { id: "oracao", instruction: "Faça uma oração curta, pessoal e carinhosa dedicada a essa pessoa pelo nome. A oração deve ser como se você estivesse orando ali na hora, de coração." },
  { id: "incentivo", instruction: "Dê palavras de encorajamento baseadas na situação atual dela. Pode ser sobre persistência, fé, ou algo que você percebeu sobre ela." },
  { id: "pergunta", instruction: "Faça uma pergunta carinhosa e genuína sobre como ela está, como está o dia dela, ou algo sobre a vida dela que demonstre interesse real." },
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { firstName, products, ownedProductNames, progress, profile } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: settings, error: settingsError } = await supabase
      .from("openai_settings")
      .select("api_key")
      .limit(1)
      .maybeSingle();

    if (settingsError || !settings?.api_key) {
      throw new Error("OpenAI API key not configured. Add it in Configurações > OpenAI.");
    }

    const OPENAI_API_KEY = settings.api_key;

    const { data: memberSettings } = await supabase
      .from("member_area_settings")
      .select("ai_persona_prompt, greeting_prompt")
      .limit(1)
      .maybeSingle();

    const personaPrompt = memberSettings?.ai_persona_prompt || "";
    const greetingPrompt = memberSettings?.greeting_prompt || "";

    const chosen = categories[Math.floor(Math.random() * categories.length)];

    const productList = (products || [])
      .map((p: { name: string; materials: string[] }) =>
        `"${p.name}" (materiais: ${p.materials?.length ? p.materials.join(", ") : "sem materiais cadastrados"})`)
      .join("\n- ");

    const ownedNames = (ownedProductNames || []).join(", ") || "nenhum produto identificado";

    const progressItems = (progress || []) as Array<{
      materialName: string; type: string; currentPage: number; totalPages: number; videoSeconds: number; videoDuration: number;
    }>;

    let progressContext = "Nenhum progresso registrado ainda.";
    if (progressItems.length > 0) {
      progressContext = progressItems.map(p => {
        if (p.type === "pdf" && p.totalPages > 0) { const pct = Math.round((p.currentPage / p.totalPages) * 100); return `"${p.materialName}": leu ${p.currentPage} de ${p.totalPages} páginas (${pct}%)`; }
        if (p.type === "video" && p.videoDuration > 0) { const pct = Math.round((p.videoSeconds / p.videoDuration) * 100); const mins = Math.floor(p.videoSeconds / 60); return `"${p.materialName}": assistiu ${mins} minutos (${pct}%)`; }
        return `"${p.materialName}": acessado`;
      }).join("\n- ");
    }

    const prof = profile || {};
    let memberSinceStr = "desconhecido";
    let memberDays = 0;
    if (prof.memberSince) {
      const sinceDate = new Date(prof.memberSince);
      memberDays = Math.floor((Date.now() - sinceDate.getTime()) / (1000 * 60 * 60 * 24));
      memberSinceStr = `${memberDays} dias atrás`;
    }
    const totalProducts = prof.totalProducts || 0;
    const daysSinceLastAccess = prof.daysSinceLastAccess;

    let profileCategory = "regular";
    if (memberDays <= 7) profileCategory = "novo";
    else if (daysSinceLastAccess !== null && daysSinceLastAccess > 7) profileCategory = "inativo";
    else if ((prof.totalPaid || 0) > 200 || totalProducts >= 3) profileCategory = "fiel";

    const profileContext = `PERFIL DO MEMBRO:
- Membro há: ${memberSinceStr}${memberDays <= 7 ? " (MEMBRO RECENTE)" : ""}
- Produtos que possui: ${totalProducts}
- Dias sem acessar materiais: ${daysSinceLastAccess !== null ? daysSinceLastAccess : "nunca acessou"}${daysSinceLastAccess !== null && daysSinceLastAccess > 3 ? " (ESTÁ AUSENTE)" : ""}
- Categoria: ${profileCategory === "novo" ? "RECENTE" : profileCategory === "inativo" ? "AUSENTE" : profileCategory === "fiel" ? "FIEL" : "REGULAR"}`;

    let systemPrompt: string;

    if (greetingPrompt) {
      // Usar o prompt customizado do usuário
      systemPrompt = greetingPrompt
        .replace(/\{persona\}/g, personaPrompt || "")
        .replace(/\{firstName\}/g, firstName || "")
        .replace(/\{ownedNames\}/g, ownedNames)
        .replace(/\{memberDays\}/g, String(memberDays))
        .replace(/\{profileCategory\}/g, profileCategory);

      // Adicionar categoria e instrução
      systemPrompt += `\n\nCATEGORIA OBRIGATÓRIA: ${chosen.id.toUpperCase()}\n${chosen.instruction}`;

      // Adicionar contexto do perfil
      systemPrompt += `\n\n${profileContext}`;
    } else {
      const personaBlock = personaPrompt
        ? `\nSUA PERSONALIDADE:\n${personaPrompt}\n`
        : `\nVocê é uma mulher cristã de 57 anos, líder de uma comunidade de orações. Fala com carinho, como uma amiga próxima. Nunca usa termos de marketing.\n`;

      systemPrompt = `Você é uma amiga mandando UMA ÚNICA mensagem curta no WhatsApp.
${personaBlock}
CATEGORIA OBRIGATÓRIA: ${chosen.id.toUpperCase()}
${chosen.instruction}

ADAPTE O TOM ao perfil:
${profileCategory === "novo" ? `MEMBRO RECENTE: Boas-vindas calorosas. Mostre que fez a escolha certa.` : ""}
${profileCategory === "inativo" ? `MEMBRO AUSENTE: Mostre que sentiu falta. NÃO critique a ausência.` : ""}
${profileCategory === "fiel" ? `MEMBRO FIEL: Reconheça a dedicação e fidelidade.` : ""}
${profileCategory === "regular" ? `MEMBRO REGULAR: Tom amigável e encorajador.` : ""}

REGRAS ABSOLUTAS:
- NUNCA use termos que definam gênero como "bem-vindo/bem-vinda", "querido/querida". Use sempre termos neutros como "boas-vindas". Cumprimente pelo nome diretamente.
- Gere APENAS 1 mensagem. UMA. Não duas.
- PROIBIDO usar travessão (—) ou travessão curto (–) em qualquer lugar
- A mensagem DEVE incluir o nome da pessoa de forma natural
- NUNCA use termos genéricos como "este material", "este conteúdo"
- SEMPRE cite nomes EXATOS dos produtos e materiais quando mencionar
- Tom: amiga próxima mandando mensagem no WhatsApp, informal e carinhosa
- NUNCA use termos de marketing como "insights", "mindset", "jornada transformadora", "exclusivo"
- NUNCA mencione valores ou preços
- Máximo 3 frases curtas no total
- Use 1 emoji no máximo
- Seja CRIATIVA e ORIGINAL. Nunca repita padrões. Cada interação deve ser única.
- A mensagem deve ser uma coisa só, fluida, que começa cumprimentando e naturalmente entra na categoria sorteada.`;
    }

    const userPrompt = `Nome: ${firstName || ""}

${profileContext}

Produtos com acesso:
- ${productList || "Nenhum produto específico"}

Nomes dos produtos: ${ownedNames}

PROGRESSO:
- ${progressContext}

CATEGORIA OBRIGATÓRIA para a mensagem: ${chosen.id.toUpperCase()} - ${chosen.instruction}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 1.1,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "generate_member_message",
            description: "Generate 1 single personalized WhatsApp-style message for the member area. NEVER use gendered terms like querido/querida, bem-vindo/bem-vinda. Use the person's name directly.",
            parameters: {
              type: "object",
              properties: {
                message: { type: "string", description: `Uma única mensagem curta e pessoal seguindo a categoria "${chosen.id}". Máx 3 frases. Sem travessões. Sem termos de gênero.` }
              },
              required: ["message"]
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "generate_member_message" } },
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("OpenAI API error:", response.status, t);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) throw new Error("No tool call response from OpenAI");

    const result = JSON.parse(toolCall.function.arguments);
    const cleanDashes = (text: string) => text.replace(/[—–]/g, ",");
    const finalResult = { greeting: cleanDashes(result.message || ""), tip: "" };

    return new Response(JSON.stringify(finalResult), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("member-ai-context error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
