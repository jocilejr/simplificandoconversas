import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { firstName, offerName, offerDescription, offerPrice, ownedProductNames, ownedProductIds, profile, offerMaterials } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const [openaiRes, settingsRes] = await Promise.all([
      supabase.from("openai_settings").select("api_key").limit(1).maybeSingle(),
      supabase.from("member_area_settings").select("ai_persona_prompt, offer_prompt").limit(1).maybeSingle(),
    ]);

    if (openaiRes.error || !openaiRes.data?.api_key) throw new Error("OpenAI API key not configured.");

    const personaPrompt = settingsRes.data?.ai_persona_prompt || "";
    const customOfferPrompt = settingsRes.data?.offer_prompt || "";

    let knowledgeContext = "";
    if (ownedProductIds && ownedProductIds.length > 0) {
      const { data: summaries } = await supabase.from("product_knowledge_summaries").select("summary, key_topics").in("product_id", ownedProductIds);
      if (summaries && summaries.length > 0) {
        knowledgeContext = summaries.map((s: any) => {
          const topics = (s.key_topics || []).join(", ");
          return `${s.summary}${topics ? `\nTópicos: ${topics}` : ""}`;
        }).join("\n\n");
      }
    }

    let productImageUrl: string | null = null;
    const { data: offerData } = await supabase.from("member_area_offers").select("product_id").eq("name", offerName).limit(1).maybeSingle();
    if (offerData?.product_id) {
      const { data: productData } = await supabase.from("delivery_products").select("member_cover_image, page_logo").eq("id", offerData.product_id).single();
      if (productData) productImageUrl = productData.member_cover_image || productData.page_logo || null;
    }

    const prof = profile || {};
    let memberDays = 0;
    if (prof.memberSince) memberDays = Math.floor((Date.now() - new Date(prof.memberSince).getTime()) / (1000 * 60 * 60 * 24));

    let profileCategory = "regular";
    if (memberDays <= 7) profileCategory = "novo";
    else if (prof.daysSinceLastAccess !== null && prof.daysSinceLastAccess > 7) profileCategory = "inativo";
    else if (prof.totalPaid > 200 || prof.totalProducts >= 3) profileCategory = "fiel";

    const ownedNames = (ownedProductNames || []).join(", ") || "nenhum";

    let systemPrompt: string;

    if (customOfferPrompt) {
      systemPrompt = customOfferPrompt
        .replace(/\{firstName\}/g, firstName || "Querido(a)")
        .replace(/\{ownedNames\}/g, ownedNames)
        .replace(/\{offerName\}/g, offerName || "")
        .replace(/\{offerDescription\}/g, offerDescription || "Material especial preparado com muito carinho.")
        .replace(/\{offerPrice\}/g, offerPrice ? `R$ ${Number(offerPrice).toFixed(2).replace('.', ',')}` : "")
        .replace(/\{memberDays\}/g, String(memberDays))
        .replace(/\{profileCategory\}/g, profileCategory);
      if (personaPrompt && !customOfferPrompt.includes("PERSONALIDADE")) systemPrompt = `SUA PERSONALIDADE:\n${personaPrompt}\n\n${systemPrompt}`;
      if (knowledgeContext) systemPrompt += `\n\nCONHECIMENTO QUE A PESSOA JÁ ADQUIRIU:\n${knowledgeContext}`;
      if (offerMaterials && offerMaterials.length > 0) systemPrompt += `\n\nCONTEÚDO QUE A PESSOA VAI RECEBER:\n${offerMaterials.join("\n")}`;
    } else {
      const personaBlock = personaPrompt
        ? `SUA PERSONALIDADE:\n${personaPrompt}`
        : `SUA PERSONALIDADE:\nVocê é uma mulher cristã de 57 anos, líder de uma comunidade de orações. Você age de forma cristã e nunca tenta vender algo — você oferece com carinho algo que pode fazer sentido para a pessoa, e pede uma contribuição caso a pessoa possa contribuir.`;

      const knowledgeBlock = knowledgeContext
        ? `\nCONHECIMENTO QUE A PESSOA JÁ ADQUIRIU (dos materiais que ela já possui):\n${knowledgeContext}\n\n→ No SEGUNDO balão, faça referência ao que a pessoa já aprendeu/estudou (use os tópicos acima de forma natural).`
        : "";

      systemPrompt = `Você vai gerar mensagens de chat simulando uma conversa pessoal sobre um material que a pessoa demonstrou interesse.

${personaBlock}

REGRAS ABSOLUTAS:
- NUNCA use termos de marketing como "insights", "mindset", "jornada transformadora", "desbloqueie", "exclusivo"
- Fale de forma natural, como uma amiga que conhece a pessoa
- Baseie-se APENAS no título e descrição da oferta para explicar o que é
- Use o nome da pessoa
- Gere EXATAMENTE 3 mensagens (balão 1, balão 2 e balão 4 — o balão 3 será uma imagem enviada automaticamente)
- Cada mensagem deve ter no máximo 2-3 frases curtas

ESTRUTURA DOS 3 BALÕES DE TEXTO:

**Balão 1 (primeiro):** Cumprimente a pessoa pelo nome e informe que ela já adquiriu os seguintes materiais: ${ownedNames}. Diga que ela ainda não contribuiu para receber "${offerName}", de forma carinhosa e sem pressão.

**Balão 2 (segundo):** ${knowledgeContext ? `Faça um breve resumo do que ela já aprendeu com os materiais que possui. Depois, explique como o novo material '${offerName}' complementa e expande esse conhecimento.` : `Explique brevemente o que é o material '${offerName}' com base na descrição, e como ele pode ajudar a pessoa na sua jornada.`}

**Balão 4 (terceiro texto, após a imagem):** Liste especificamente o que contém dentro do material, mencionando os módulos e conteúdos que ela vai receber. ${offerPrice ? `No final, diga que é apenas uma contribuição simbólica no valor de R$ ${Number(offerPrice).toFixed(2).replace('.', ',')} e convide com gentileza.` : "Convide com gentileza."}

${knowledgeBlock}
PERFIL DA PESSOA:
- Nome: ${firstName}
- Membro há: ${memberDays} dias${memberDays <= 7 ? " (nova)" : ""}
- Produtos que já possui: ${ownedNames}
- Categoria: ${profileCategory}
${profileCategory === "novo" ? "→ É nova, não pressione." : ""}
${profileCategory === "inativo" ? "→ Está voltando. Incentive com carinho." : ""}
${profileCategory === "fiel" ? "→ É fiel e comprometida. Reconheça isso." : ""}

MATERIAL CLICADO:
- Nome: "${offerName}"
- Descrição: "${offerDescription || 'Material especial preparado com muito carinho.'}"
${(offerMaterials && offerMaterials.length > 0) ? `\nCONTEÚDO QUE A PESSOA VAI RECEBER (use no Balão 4):\n${offerMaterials.join("\n")}` : ""}

Gere as mensagens usando a função fornecida.`;
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiRes.data.api_key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Gere as 3 mensagens de chat para ${firstName} sobre "${offerName}".` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "generate_offer_chat",
            description: "Generate exactly 3 chat text messages (balloon 1, 2, and 4). Balloon 3 is an image sent automatically.",
            parameters: {
              type: "object",
              properties: {
                messages: { type: "array", items: { type: "string" }, description: "Array of exactly 3 short chat messages.", minItems: 3, maxItems: 3 }
              },
              required: ["messages"]
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "generate_offer_chat" } },
      }),
    });

    if (!response.ok) { const t = await response.text(); console.error("OpenAI API error:", response.status, t); throw new Error(`OpenAI API error: ${response.status}`); }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) throw new Error("No tool call response from OpenAI");

    const result = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify({ ...result, productImageUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("member-offer-pitch error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
