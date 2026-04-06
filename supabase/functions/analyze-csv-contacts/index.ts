import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "@supabase/supabase-js/cors";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.98.0");
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { csv_text } = await req.json();
    if (!csv_text || typeof csv_text !== "string") {
      return new Response(JSON.stringify({ error: "csv_text is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Truncate to first 500 lines for AI analysis
    const lines = csv_text.split(/\r?\n/).filter(Boolean);
    const truncated = lines.slice(0, 500).join("\n");
    const totalLines = lines.length;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const systemPrompt = `Você é um analisador de CSV especializado em listas de contatos de e-mail.

Sua tarefa:
1. Analisar o CSV bruto e identificar automaticamente quais colunas contêm: e-mail, nome e tags (independente do nome da coluna ou idioma)
2. Extrair cada contato válido
3. Corrigir erros comuns de digitação em domínios de e-mail (ex: gmial.com → gmail.com, hotmal.com → hotmail.com, outlok.com → outlook.com)
4. Classificar cada contato:
   - "valid": e-mail correto, sem alterações necessárias
   - "corrected": e-mail tinha erro de digitação que foi corrigido
   - "invalid": e-mail inválido ou ausente (informar motivo)
5. Se houver uma coluna que pareça ser tags/categorias/grupos, incluí-la como array de tags
6. Se não encontrar coluna de nome, usar null
7. Ignorar linhas sem e-mail válido

IMPORTANTE:
- Analise TODAS as linhas do CSV fornecido
- Retorne os resultados via tool calling
- Preserve a parte local do e-mail (antes do @) intacta, corrija apenas o domínio`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Analise este CSV e extraia os contatos:\n\n${truncated}` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_contacts",
              description: "Return the analyzed contacts from the CSV",
              parameters: {
                type: "object",
                properties: {
                  contacts: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        email: { type: "string", description: "The corrected/valid email address" },
                        name: { type: "string", description: "Contact name if found, or null" },
                        tags: { type: "array", items: { type: "string" }, description: "Tags/categories found" },
                        status: { type: "string", enum: ["valid", "corrected", "invalid"], description: "Classification" },
                        original_email: { type: "string", description: "Original email before correction (only if corrected)" },
                        reason: { type: "string", description: "Reason for correction or invalidity" },
                      },
                      required: ["email", "status"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["contacts"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_contacts" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Tente novamente em alguns segundos." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "Erro ao analisar CSV com IA" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error("No tool call in AI response:", JSON.stringify(aiResult));
      return new Response(JSON.stringify({ error: "IA não retornou dados estruturados" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const parsed = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ contacts: parsed.contacts, total_csv_lines: totalLines - 1 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-csv-contacts error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
