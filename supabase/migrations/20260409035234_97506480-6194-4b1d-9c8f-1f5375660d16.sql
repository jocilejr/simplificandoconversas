
-- 1. delivery_products
CREATE TABLE public.delivery_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  page_logo TEXT,
  value NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  member_cover_image TEXT,
  member_description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, slug)
);
ALTER TABLE public.delivery_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ws_select" ON public.delivery_products FOR SELECT TO authenticated USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "ws_insert" ON public.delivery_products FOR INSERT TO authenticated WITH CHECK (can_write_workspace(auth.uid(), workspace_id));
CREATE POLICY "ws_update" ON public.delivery_products FOR UPDATE TO authenticated USING (can_write_workspace(auth.uid(), workspace_id));
CREATE POLICY "ws_delete" ON public.delivery_products FOR DELETE TO authenticated USING (has_workspace_role(auth.uid(), workspace_id, 'admin'::workspace_role));
CREATE TRIGGER update_delivery_products_updated_at BEFORE UPDATE ON public.delivery_products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. member_products
CREATE TABLE public.member_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  normalized_phone TEXT NOT NULL,
  product_id UUID NOT NULL REFERENCES public.delivery_products(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.member_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ws_select" ON public.member_products FOR SELECT TO authenticated USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "ws_insert" ON public.member_products FOR INSERT TO authenticated WITH CHECK (can_write_workspace(auth.uid(), workspace_id));
CREATE POLICY "ws_update" ON public.member_products FOR UPDATE TO authenticated USING (can_write_workspace(auth.uid(), workspace_id));
CREATE POLICY "ws_delete" ON public.member_products FOR DELETE TO authenticated USING (has_workspace_role(auth.uid(), workspace_id, 'admin'::workspace_role));
CREATE INDEX idx_member_products_phone ON public.member_products(workspace_id, normalized_phone);

-- 3. member_area_settings
CREATE TABLE public.member_area_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE UNIQUE,
  title TEXT NOT NULL DEFAULT 'Área de Membros',
  logo_url TEXT,
  welcome_message TEXT DEFAULT 'Bem-vindo à sua área exclusiva!',
  theme_color TEXT DEFAULT '#3b82f6',
  ai_persona_prompt TEXT,
  greeting_prompt TEXT,
  offer_prompt TEXT,
  layout_order JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.member_area_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ws_select" ON public.member_area_settings FOR SELECT TO authenticated USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "ws_insert" ON public.member_area_settings FOR INSERT TO authenticated WITH CHECK (can_write_workspace(auth.uid(), workspace_id));
CREATE POLICY "ws_update" ON public.member_area_settings FOR UPDATE TO authenticated USING (can_write_workspace(auth.uid(), workspace_id));
CREATE POLICY "ws_delete" ON public.member_area_settings FOR DELETE TO authenticated USING (has_workspace_role(auth.uid(), workspace_id, 'admin'::workspace_role));
CREATE TRIGGER update_member_area_settings_updated_at BEFORE UPDATE ON public.member_area_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. member_area_offers
CREATE TABLE public.member_area_offers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  product_id UUID REFERENCES public.delivery_products(id) ON DELETE SET NULL,
  description TEXT,
  image_url TEXT,
  purchase_url TEXT,
  price NUMERIC DEFAULT 0,
  display_type TEXT NOT NULL DEFAULT 'card',
  pix_key TEXT,
  pix_key_type TEXT,
  card_payment_url TEXT,
  category_tag TEXT,
  total_impressions INTEGER NOT NULL DEFAULT 0,
  total_clicks INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.member_area_offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ws_select" ON public.member_area_offers FOR SELECT TO authenticated USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "ws_insert" ON public.member_area_offers FOR INSERT TO authenticated WITH CHECK (can_write_workspace(auth.uid(), workspace_id));
CREATE POLICY "ws_update" ON public.member_area_offers FOR UPDATE TO authenticated USING (can_write_workspace(auth.uid(), workspace_id));
CREATE POLICY "ws_delete" ON public.member_area_offers FOR DELETE TO authenticated USING (has_workspace_role(auth.uid(), workspace_id, 'admin'::workspace_role));
CREATE TRIGGER update_member_area_offers_updated_at BEFORE UPDATE ON public.member_area_offers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. member_product_categories
CREATE TABLE public.member_product_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.delivery_products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.member_product_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ws_select" ON public.member_product_categories FOR SELECT TO authenticated USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "ws_insert" ON public.member_product_categories FOR INSERT TO authenticated WITH CHECK (can_write_workspace(auth.uid(), workspace_id));
CREATE POLICY "ws_update" ON public.member_product_categories FOR UPDATE TO authenticated USING (can_write_workspace(auth.uid(), workspace_id));
CREATE POLICY "ws_delete" ON public.member_product_categories FOR DELETE TO authenticated USING (has_workspace_role(auth.uid(), workspace_id, 'admin'::workspace_role));
CREATE TRIGGER update_member_product_categories_updated_at BEFORE UPDATE ON public.member_product_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. member_product_materials
CREATE TABLE public.member_product_materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.delivery_products(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.member_product_categories(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  content_type TEXT NOT NULL DEFAULT 'text',
  content_url TEXT,
  content_text TEXT,
  button_label TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_preview BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.member_product_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ws_select" ON public.member_product_materials FOR SELECT TO authenticated USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "ws_insert" ON public.member_product_materials FOR INSERT TO authenticated WITH CHECK (can_write_workspace(auth.uid(), workspace_id));
CREATE POLICY "ws_update" ON public.member_product_materials FOR UPDATE TO authenticated USING (can_write_workspace(auth.uid(), workspace_id));
CREATE POLICY "ws_delete" ON public.member_product_materials FOR DELETE TO authenticated USING (has_workspace_role(auth.uid(), workspace_id, 'admin'::workspace_role));
CREATE TRIGGER update_member_product_materials_updated_at BEFORE UPDATE ON public.member_product_materials FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. member_sessions
CREATE TABLE public.member_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  normalized_phone TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  current_activity TEXT,
  current_product_name TEXT,
  current_material_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.member_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ws_select" ON public.member_sessions FOR SELECT TO authenticated USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "anon_insert" ON public.member_sessions FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update" ON public.member_sessions FOR UPDATE TO anon USING (true);
CREATE POLICY "ws_insert" ON public.member_sessions FOR INSERT TO authenticated WITH CHECK (can_write_workspace(auth.uid(), workspace_id));
CREATE POLICY "ws_delete" ON public.member_sessions FOR DELETE TO authenticated USING (has_workspace_role(auth.uid(), workspace_id, 'admin'::workspace_role));
CREATE INDEX idx_member_sessions_workspace ON public.member_sessions(workspace_id, last_heartbeat_at DESC);

-- Enable realtime for member_sessions
ALTER PUBLICATION supabase_realtime ADD TABLE public.member_sessions;

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('member-files', 'member-files', true);
CREATE POLICY "Public read member-files" ON storage.objects FOR SELECT USING (bucket_id = 'member-files');
CREATE POLICY "Authenticated upload member-files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'member-files');
CREATE POLICY "Authenticated update member-files" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'member-files');
CREATE POLICY "Authenticated delete member-files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'member-files');
