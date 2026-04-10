import { Router } from "express";
import { getServiceClient } from "../lib/supabase";
import { normalizePhone } from "../lib/normalize-phone";

const router = Router();

router.get("/:phone", async (req, res) => {
  try {
    const normalized = normalizePhone(req.params.phone);
    if (!normalized) {
      return res.status(400).json({ error: "Telefone inválido" });
    }

    const phoneCandidates = Array.from(
      new Set([
        normalized,
        normalized.startsWith("55") ? normalized.slice(2) : normalized,
      ].filter(Boolean))
    );

    const sb = getServiceClient();

    // Step 1: fetch member_products
    const { data: accessRows, error: accessError } = await sb
      .from("member_products")
      .select("workspace_id, product_id, phone, is_active, granted_at")
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
        .select("title, logo_url, welcome_message, theme_color, ai_persona_prompt, greeting_prompt, offer_prompt")
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
        .select("name, first_seen_at, total_paid, total_transactions")
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
      settings,
      products: Array.from(productMap.values()),
      offers: offersRes.data || [],
      customer: customerRes.data
        ? {
            name: (customerRes.data as any).name || null,
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

export default router;
