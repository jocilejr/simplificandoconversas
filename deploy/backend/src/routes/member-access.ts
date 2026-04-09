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
    const { data: accessRows, error: accessError } = await sb
      .from("member_products")
      .select("workspace_id, product_id, phone, is_active, delivery_products(id, name, member_cover_image, member_description, page_logo, slug)")
      .eq("is_active", true)
      .in("phone", phoneCandidates);

    if (accessError) throw accessError;
    if (!accessRows?.length) {
      return res.status(404).json({ error: "Nenhum acesso ativo encontrado para este telefone" });
    }

    const workspaceId = accessRows[0].workspace_id as string;
    const rows = accessRows.filter((row: any) => row.workspace_id === workspaceId);
    const productIds = Array.from(new Set(rows.map((row: any) => row.product_id).filter(Boolean)));

    const [settingsRes, categoriesRes, materialsRes] = await Promise.all([
      sb
        .from("member_area_settings")
        .select("title, logo_url, welcome_message")
        .eq("workspace_id", workspaceId)
        .maybeSingle(),
      sb
        .from("member_product_categories")
        .select("id, product_id, name, icon, description, sort_order")
        .eq("workspace_id", workspaceId)
        .in("product_id", productIds)
        .order("sort_order", { ascending: true }),
      sb
        .from("member_product_materials")
        .select("id, product_id, category_id, title, description, content_type, content_url, content_text, button_label, sort_order, is_preview")
        .eq("workspace_id", workspaceId)
        .in("product_id", productIds)
        .order("sort_order", { ascending: true }),
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
      const product = row.delivery_products;
      if (!product || productMap.has(product.id)) continue;

      productMap.set(product.id, {
        id: product.id,
        name: product.name,
        slug: product.slug,
        member_cover_image: product.member_cover_image,
        member_description: product.member_description,
        page_logo: product.page_logo,
        categories: categoriesByProduct.get(product.id) || [],
        materials: materialsByProduct.get(product.id) || [],
      });
    }

    return res.json({
      phone: normalized,
      settings: settingsRes.data || null,
      products: Array.from(productMap.values()),
    });
  } catch (err: any) {
    console.error("[member-access] error:", err.message);
    return res.status(500).json({ error: err.message || "Erro ao carregar acesso do membro" });
  }
});

export default router;