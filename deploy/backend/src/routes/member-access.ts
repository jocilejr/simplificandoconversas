import { Router } from "express";
import { getServiceClient } from "../lib/supabase";
import { normalizePhone } from "../lib/normalize-phone";

const router = Router();

function generateVariations(phone: string): string[] {
  const s = new Set<string>();
  s.add(phone);
  let base = phone.startsWith("55") && phone.length >= 12 ? phone.slice(2) : phone;
  s.add(base);
  s.add("55" + base);
  const ddd = base.slice(0, 2);
  const rest = base.slice(2);
  if (rest.length === 9 && rest[0] === "9") {
    s.add(ddd + rest.slice(1));
    s.add("55" + ddd + rest.slice(1));
  } else if (rest.length === 8) {
    s.add(ddd + "9" + rest);
    s.add("55" + ddd + "9" + rest);
  }
  return Array.from(s).filter(Boolean);
}

router.get("/:phone", async (req, res) => {
  try {
    const normalized = normalizePhone(req.params.phone);
    if (!normalized) {
      return res.status(400).json({ error: "Telefone inválido" });
    }

    const phoneCandidates = generateVariations(normalized);

    const sb = getServiceClient();

    // Step 1: fetch member_products
    const { data: accessRows, error: accessError } = await sb
      .from("member_products")
      .select("workspace_id, product_id, phone, is_active")
      .eq("is_active", true)
      .in("phone", phoneCandidates);

    if (accessError) throw accessError;
    if (!accessRows?.length) {
      return res.status(404).json({ error: "Nenhum acesso ativo encontrado para este telefone" });
    }

    const workspaceId = accessRows[0].workspace_id as string;
    const rows = accessRows.filter((row: any) => row.workspace_id === workspaceId);
    const productIds = Array.from(new Set(rows.map((row: any) => row.product_id).filter(Boolean)));

    // Step 2: fetch delivery_products separately
    const { data: deliveryProducts, error: dpError } = await sb
      .from("delivery_products")
      .select("id, name, member_cover_image, member_description, page_logo, slug, value")
      .in("id", productIds);
    if (dpError) throw dpError;

    const dpMap = new Map<string, any>();
    for (const dp of deliveryProducts || []) dpMap.set(dp.id, dp);

    // Step 3: fetch settings, categories, materials, offers, and customer in parallel
    const [settingsRes, categoriesRes, materialsRes, offersRes, customerRes, memberSettingsRes] = await Promise.all([
      sb.from("member_area_settings")
        .select("title, logo_url, welcome_message, theme_color, ai_persona_prompt, greeting_prompt, offer_prompt, ai_model")
        .eq("workspace_id", workspaceId)
        .maybeSingle(),
      sb.from("member_product_categories")
        .select("id, product_id, name, icon, description, sort_order")
        .eq("workspace_id", workspaceId)
        .in("product_id", productIds)
        .order("sort_order", { ascending: true }),
      sb.from("member_product_materials")
        .select("id, product_id, category_id, title, description, content_type, content_url, content_text, button_label, sort_order, is_preview")
        .eq("workspace_id", workspaceId)
        .in("product_id", productIds)
        .order("sort_order", { ascending: true }),
      sb.from("member_area_offers")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
      sb.from("customers")
        .select("name, document, first_seen_at, total_paid, total_transactions")
        .eq("workspace_id", workspaceId)
        .in("normalized_phone", phoneCandidates)
        .limit(1)
        .maybeSingle(),
      sb.from("member_area_settings")
        .select("theme_color, ai_persona_prompt")
        .eq("workspace_id", workspaceId)
        .maybeSingle(),
    ]);

    if (settingsRes.error) throw settingsRes.error;
    if (categoriesRes.error) throw categoriesRes.error;
    if (materialsRes.error) throw materialsRes.error;

    const categoriesByProduct = new Map<string, any[]>();
    for (const category of categoriesRes.data || []) {
      const list = categoriesByProduct.get(category.product_id) || [];
      list.push(category);
      categoriesByProduct.set(category.product_id, list);
    }

    const materialsByProduct = new Map<string, any[]>();
    for (const material of materialsRes.data || []) {
      const list = materialsByProduct.get(material.product_id) || [];
      list.push(material);
      materialsByProduct.set(material.product_id, list);
    }

    const productMap = new Map<string, any>();
    for (const row of rows as any[]) {
      const product = dpMap.get(row.product_id);
      if (!product || productMap.has(product.id)) continue;

      productMap.set(product.id, {
        id: product.id,
        name: product.name,
        slug: product.slug,
        member_cover_image: product.member_cover_image,
        member_description: product.member_description,
        page_logo: product.page_logo,
        value: product.value || null,
        categories: categoriesByProduct.get(product.id) || [],
        materials: materialsByProduct.get(product.id) || [],
      });
    }

    // Build settings with theme_color
    const settingsData = settingsRes.data || null;
    const settings = settingsData
      ? {
          title: settingsData.title,
          logo_url: settingsData.logo_url,
          welcome_message: settingsData.welcome_message,
          theme_color: (settingsData as any).theme_color || "#8B5CF6",
          ai_persona_prompt: (settingsData as any).ai_persona_prompt || null,
          greeting_prompt: (settingsData as any).greeting_prompt || null,
          offer_prompt: (settingsData as any).offer_prompt || null,
        }
      : null;

    return res.json({
      phone: normalized,
      workspace_id: workspaceId,
      settings,
      products: Array.from(productMap.values()),
      offers: (offersRes.data || []).map((o: any) => ({ ...o, name: o.name || o.title || "Oferta" })),
      customer: customerRes.data
        ? {
            name: (customerRes.data as any).name || null,
            document: (customerRes.data as any).document || null,
            first_seen_at: (customerRes.data as any).first_seen_at || null,
            total_paid: (customerRes.data as any).total_paid || 0,
            total_transactions: (customerRes.data as any).total_transactions || 0,
          }
        : null,
    });
  } catch (err: any) {
    console.error("[member-access] error:", err.message);
    return res.status(500).json({ error: err.message || "Erro ao carregar acesso do membro" });
  }
});

// ─── AI Context Route ───
router.post("/ai-context", async (req, res) => {
  try {
    const { firstName, products, ownedProductNames, progress, profile, workspaceId, phone: reqPhone } = req.body;
    const sb = getServiceClient();

    if (!workspaceId) return res.status(400).json({ error: "workspaceId is required" });

    // Resolve OpenAI API key from workspace or profile
    const { data: workspaceRow, error: workspaceError } = await sb
      .from("workspaces")
      .select("created_by, openai_api_key")
      .eq("id", workspaceId)
      .maybeSingle();

    if (workspaceError || !workspaceRow) {
      return res.status(404).json({ error: "Workspace not found." });
    }

    let OPENAI_API_KEY = workspaceRow.openai_api_key || "";

    if (!OPENAI_API_KEY && workspaceRow.created_by) {
      const { data: profileRow } = await sb
        .from("profiles")
        .select("openai_api_key")
        .eq("user_id", workspaceRow.created_by)
        .maybeSingle();
      OPENAI_API_KEY = profileRow?.openai_api_key || "";
    }

    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: "OpenAI API key not configured." });
    }

    const settingsRes = await sb.from("member_area_settings").select("ai_persona_prompt, ai_model").eq("workspace_id", workspaceId).maybeSingle();
    const personaPrompt = (settingsRes.data as any)?.ai_persona_prompt || "";
    const aiModel = (settingsRes.data as any)?.ai_model || "gpt-4o-mini";

    const categories = [
      { id: "salmo", instruction: "Compartilhe um salmo ou versículo bíblico que combina com o momento dessa pessoa. Cite o livro, capítulo e versículo. Conecte o versículo com algo pessoal dela." },
      { id: "progresso", instruction: "Comente especificamente sobre o progresso dela nos materiais, citando nomes exatos e porcentagens. Se não houver progresso, incentive a começar um material específico pelo nome." },
      { id: "reflexao", instruction: "Compartilhe uma reflexão pessoal sua, algo que você pensou hoje de manhã ou que Deus colocou no seu coração. Seja genuína e específica." },
      { id: "curiosidade", instruction: "Conte uma curiosidade bíblica interessante, uma história pouco conhecida da Bíblia, ou um fato surpreendente sobre um personagem bíblico. Seja específica e educativa." },
      { id: "oracao", instruction: "Faça uma oração curta, pessoal e carinhosa dedicada a essa pessoa pelo nome. A oração deve ser como se você estivesse orando ali na hora, de coração." },
      { id: "incentivo", instruction: "Dê palavras de encorajamento baseadas na situação atual dela. Pode ser sobre persistência, fé, ou algo que você percebeu sobre ela." },
      { id: "pergunta", instruction: "Faça uma pergunta carinhosa e genuína sobre como ela está, como está o dia dela, ou algo sobre a vida dela que demonstre interesse real." },
    ];

    const chosen = categories[Math.floor(Math.random() * categories.length)];

    const productList = (products || [])
      .map((p: any) => `"${p.name}" (materiais: ${p.materials?.length ? p.materials.join(", ") : "sem materiais cadastrados"})`)
      .join("\n- ");

    const ownedNames = (ownedProductNames || []).join(", ") || "nenhum produto identificado";

    const progressItems = (progress || []) as any[];
    let progressContext = "Nenhum progresso registrado ainda.";
    if (progressItems.length > 0) {
      progressContext = progressItems.map((p: any) => {
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

    const profileContext = `PERFIL DO MEMBRO:\n- Membro há: ${memberSinceStr}${memberDays <= 7 ? " (MEMBRO NOVA!)" : ""}\n- Produtos que possui: ${totalProducts}\n- Dias sem acessar materiais: ${daysSinceLastAccess !== null ? daysSinceLastAccess : "nunca acessou"}${daysSinceLastAccess !== null && daysSinceLastAccess > 3 ? " (ESTÁ SUMIDA!)" : ""}\n- Categoria: ${profileCategory === "novo" ? "NOVA" : profileCategory === "inativo" ? "INATIVA" : profileCategory === "fiel" ? "FIEL" : "REGULAR"}`;

    const personaBlock = personaPrompt
      ? `\nSUA PERSONALIDADE:\n${personaPrompt}\n`
      : `\nVocê é uma mulher cristã de 57 anos, líder de uma comunidade de orações. Fala com carinho, como uma amiga próxima. Nunca usa termos de marketing.\n`;

    const systemPrompt = `Você é uma amiga mandando UMA ÚNICA mensagem curta no WhatsApp.\n${personaBlock}\nCATEGORIA OBRIGATÓRIA: ${chosen.id.toUpperCase()}\n${chosen.instruction}\n\nADAPTE O TOM ao perfil:\n${profileCategory === "novo" ? "MEMBRO NOVA: Boas-vindas calorosas. Mostre que fez a escolha certa." : ""}${profileCategory === "inativo" ? "MEMBRO INATIVA: Mostre que sentiu falta. NÃO critique a ausência." : ""}${profileCategory === "fiel" ? "MEMBRO FIEL: Reconheça a dedicação e fidelidade." : ""}${profileCategory === "regular" ? "MEMBRO REGULAR: Tom amigável e encorajador." : ""}\n\nREGRAS ABSOLUTAS:\n- Gere APENAS 1 mensagem. UMA. Não duas.\n- PROIBIDO usar travessão (—) ou travessão curto (–)\n- A mensagem DEVE incluir o nome da pessoa de forma natural\n- NUNCA use termos genéricos como "este material", "este conteúdo"\n- SEMPRE cite nomes EXATOS dos produtos e materiais\n- Tom: amiga próxima mandando mensagem no WhatsApp\n- NUNCA use termos de marketing\n- NUNCA mencione valores ou preços\n- Máximo 3 frases curtas\n- Use 1 emoji no máximo\n- Seja CRIATIVA e ORIGINAL`;

    // Query lead data if phone provided
    let leadContext = "";
    if (reqPhone) {
      const phoneCandidates = generateVariations(normalizePhone(reqPhone) || reqPhone);
      const { data: leadRow } = await sb
        .from("customers")
        .select("name, first_seen_at, total_paid, total_transactions")
        .eq("workspace_id", workspaceId)
        .in("normalized_phone", phoneCandidates)
        .limit(1)
        .maybeSingle();
      if (leadRow) {
        const lr = leadRow as any;
        leadContext = `\n\nDADOS DO LEAD:\n- Nome completo: ${lr.name || "desconhecido"}\n- Primeiro contato: ${lr.first_seen_at || "desconhecido"}\n- Total pago: R$ ${Number(lr.total_paid || 0).toFixed(2).replace('.', ',')}\n- Total de transações: ${lr.total_transactions || 0}`;
      }
    }

    const userPrompt = `Nome: ${firstName || "Querido(a)"}\n\n${profileContext}\n\nProdutos com acesso:\n- ${productList || "Nenhum produto específico"}\n\nNomes dos produtos: ${ownedNames}\n\nPROGRESSO:\n- ${progressContext}\n\nCATEGORIA OBRIGATÓRIA: ${chosen.id.toUpperCase()} - ${chosen.instruction}${leadContext}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: aiModel,
        temperature: 1.1,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "generate_member_message",
            description: "Generate 1 single personalized WhatsApp-style message.",
            parameters: { type: "object", properties: { message: { type: "string", description: `Uma única mensagem curta e pessoal seguindo a categoria "${chosen.id}". Máx 3 frases. Sem travessões.` } }, required: ["message"] }
          }
        }],
        tool_choice: { type: "function", function: { name: "generate_member_message" } },
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("OpenAI API error:", response.status, t);
      return res.status(500).json({ error: `OpenAI API error: ${response.status}` });
    }

    const data: any = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) return res.status(500).json({ error: "No tool call response from OpenAI" });

    const result = JSON.parse(toolCall.function.arguments);
    const cleanDashes = (text: string) => text.replace(/[—–]/g, ",");
    return res.json({ greeting: cleanDashes(result.message || ""), tip: "" });
  } catch (e: any) {
    console.error("[member-ai-context] error:", e);
    return res.status(500).json({ error: e.message || "Unknown error" });
  }
});

// ─── Offer Pitch Route ───
router.post("/offer-pitch", async (req, res) => {
  try {
    const { firstName, offerName, offerDescription, offerPrice, ownedProductNames, ownedProductIds, profile, offerMaterials, workspaceId } = req.body;
    const sb = getServiceClient();

    if (!workspaceId) return res.status(400).json({ error: "workspaceId is required" });

    // Resolve OpenAI API key from workspace or profile
    const { data: workspaceRow, error: workspaceError } = await sb
      .from("workspaces")
      .select("created_by, openai_api_key")
      .eq("id", workspaceId)
      .maybeSingle();

    if (workspaceError || !workspaceRow) {
      return res.status(404).json({ error: "Workspace not found." });
    }

    let OPENAI_API_KEY = workspaceRow.openai_api_key || "";

    if (!OPENAI_API_KEY && workspaceRow.created_by) {
      const { data: profileRow } = await sb
        .from("profiles")
        .select("openai_api_key")
        .eq("user_id", workspaceRow.created_by)
        .maybeSingle();
      OPENAI_API_KEY = profileRow?.openai_api_key || "";
    }

    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: "OpenAI API key not configured." });
    }

    const settingsRes = await sb.from("member_area_settings").select("ai_persona_prompt, offer_prompt, ai_model").eq("workspace_id", workspaceId).maybeSingle();

    const personaPrompt = (settingsRes.data as any)?.ai_persona_prompt || "";
    const customOfferPrompt = (settingsRes.data as any)?.offer_prompt || "";
    const offerAiModel = (settingsRes.data as any)?.ai_model || "gpt-4o-mini";

    // Knowledge context
    let knowledgeContext = "";
    if (ownedProductIds?.length > 0) {
      const { data: summaries } = await sb.from("product_knowledge_summaries").select("summary, key_topics").in("product_id", ownedProductIds);
      if (summaries?.length) {
        knowledgeContext = summaries.map((s: any) => {
          const topics = (s.key_topics || []).join(", ");
          return `${s.summary}${topics ? `\nTópicos: ${topics}` : ""}`;
        }).join("\n\n");
      }
    }

    // Product image
    let productImageUrl: string | null = null;
    let memberDescription = "";
    const { data: offerData } = await sb.from("member_area_offers").select("product_id").eq("name", offerName).limit(1).maybeSingle();
    if (offerData?.product_id) {
      const { data: productData } = await sb.from("delivery_products").select("member_cover_image, page_logo, member_description").eq("id", offerData.product_id).single();
      if (productData) {
        productImageUrl = productData.member_cover_image || productData.page_logo || null;
        memberDescription = productData.member_description || "";
      }
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
      if (memberDescription) systemPrompt += `\n\nSOBRE O PRODUTO (descrição do criador):\n${memberDescription}`;
      if (knowledgeContext) systemPrompt += `\n\nCONHECIMENTO QUE A PESSOA JÁ ADQUIRIU:\n${knowledgeContext}`;
      if (offerMaterials?.length > 0) systemPrompt += `\n\nCONTEÚDO QUE A PESSOA VAI RECEBER:\n${offerMaterials.join("\n")}`;
    } else {
      const personaBlock = personaPrompt
        ? `SUA PERSONALIDADE:\n${personaPrompt}`
        : `SUA PERSONALIDADE:\nVocê é uma mulher cristã de 57 anos, líder de uma comunidade de orações. Você age de forma cristã e nunca tenta vender algo — você oferece com carinho algo que pode fazer sentido para a pessoa, e pede uma contribuição caso a pessoa possa contribuir.`;

      const knowledgeBlock = knowledgeContext
        ? `\nCONHECIMENTO QUE A PESSOA JÁ ADQUIRIU (dos materiais que ela já possui):\n${knowledgeContext}\n\n→ No SEGUNDO balão, faça referência ao que a pessoa já aprendeu/estudou.`
        : "";

      const descBlock = memberDescription ? `\nSOBRE O PRODUTO (descrição do criador):\n${memberDescription}\n` : "";

      systemPrompt = `Você vai gerar mensagens de chat simulando uma conversa pessoal sobre um material que a pessoa demonstrou interesse.\n\n${personaBlock}\n\nREGRAS ABSOLUTAS:\n- NUNCA use termos de marketing\n- Fale de forma natural, como uma amiga\n- Use o nome da pessoa\n- Gere EXATAMENTE 3 mensagens (balão 1, balão 2 e balão 4 — o balão 3 será uma imagem)\n- Cada mensagem deve ter no máximo 2-3 frases curtas\n\nESTRUTURA DOS 3 BALÕES DE TEXTO:\n\n**Balão 1:** Cumprimente pelo nome e informe que já adquiriu: ${ownedNames}. Diga que ainda não contribuiu para "${offerName}", de forma carinhosa.\n\n**Balão 2:** ${knowledgeContext ? `Breve resumo do que aprendeu. Depois, como '${offerName}' complementa.` : `Explique brevemente '${offerName}' com base na descrição.`}\n\n**Balão 4:** Liste o conteúdo do material. ${offerPrice ? `Diga que é apenas R$ ${Number(offerPrice).toFixed(2).replace('.', ',')} e convide com gentileza.` : "Convide com gentileza."}\n\n${knowledgeBlock}${descBlock}\nPERFIL: Nome: ${firstName}, Membro há: ${memberDays} dias, Produtos: ${ownedNames}, Categoria: ${profileCategory}\n\nMATERIAL: "${offerName}" — "${offerDescription || 'Material especial.'}"${offerMaterials?.length > 0 ? `\nCONTEÚDO: ${offerMaterials.join("\n")}` : ""}`;
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: offerAiModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Gere as 3 mensagens de chat para ${firstName} sobre "${offerName}".` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "generate_offer_chat",
            description: "Generate exactly 3 chat text messages.",
            parameters: { type: "object", properties: { messages: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 3 } }, required: ["messages"] }
          }
        }],
        tool_choice: { type: "function", function: { name: "generate_offer_chat" } },
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("OpenAI API error:", response.status, t);
      return res.status(500).json({ error: `OpenAI API error: ${response.status}` });
    }

    const data: any = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) return res.status(500).json({ error: "No tool call response from OpenAI" });

    const result = JSON.parse(toolCall.function.arguments);
    return res.json({ ...result, productImageUrl });
  } catch (e: any) {
    console.error("[member-offer-pitch] error:", e);
    return res.status(500).json({ error: e.message || "Unknown error" });
  }
});

export default router;
