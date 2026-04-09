
-- Add missing columns to delivery_products
ALTER TABLE public.delivery_products
  ADD COLUMN IF NOT EXISTS whatsapp_number text,
  ADD COLUMN IF NOT EXISTS whatsapp_message text,
  ADD COLUMN IF NOT EXISTS delivery_webhook_url text,
  ADD COLUMN IF NOT EXISTS redirect_url text,
  ADD COLUMN IF NOT EXISTS page_title text NOT NULL DEFAULT 'Preparando sua entrega...',
  ADD COLUMN IF NOT EXISTS page_message text NOT NULL DEFAULT 'Você será redirecionado em instantes',
  ADD COLUMN IF NOT EXISTS redirect_delay integer NOT NULL DEFAULT 3;

-- delivery_pixels
CREATE TABLE public.delivery_pixels (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.delivery_products(id) ON DELETE CASCADE,
  platform text NOT NULL DEFAULT 'meta',
  pixel_id text NOT NULL DEFAULT '',
  access_token text,
  event_name text NOT NULL DEFAULT 'Purchase',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.delivery_pixels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ws_select" ON public.delivery_pixels FOR SELECT TO authenticated USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "ws_insert" ON public.delivery_pixels FOR INSERT TO authenticated WITH CHECK (can_write_workspace(auth.uid(), workspace_id));
CREATE POLICY "ws_update" ON public.delivery_pixels FOR UPDATE TO authenticated USING (can_write_workspace(auth.uid(), workspace_id));
CREATE POLICY "ws_delete" ON public.delivery_pixels FOR DELETE TO authenticated USING (has_workspace_role(auth.uid(), workspace_id, 'admin'::workspace_role));

-- global_delivery_pixels
CREATE TABLE public.global_delivery_pixels (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  platform text NOT NULL DEFAULT 'meta',
  pixel_id text NOT NULL DEFAULT '',
  access_token text,
  event_name text NOT NULL DEFAULT 'Purchase',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.global_delivery_pixels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ws_select" ON public.global_delivery_pixels FOR SELECT TO authenticated USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "ws_insert" ON public.global_delivery_pixels FOR INSERT TO authenticated WITH CHECK (can_write_workspace(auth.uid(), workspace_id));
CREATE POLICY "ws_update" ON public.global_delivery_pixels FOR UPDATE TO authenticated USING (can_write_workspace(auth.uid(), workspace_id));
CREATE POLICY "ws_delete" ON public.global_delivery_pixels FOR DELETE TO authenticated USING (has_workspace_role(auth.uid(), workspace_id, 'admin'::workspace_role));

-- delivery_accesses
CREATE TABLE public.delivery_accesses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.delivery_products(id) ON DELETE CASCADE,
  phone text,
  accessed_at timestamptz NOT NULL DEFAULT now(),
  pixel_fired boolean NOT NULL DEFAULT false,
  webhook_sent boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.delivery_accesses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ws_select" ON public.delivery_accesses FOR SELECT TO authenticated USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "ws_insert" ON public.delivery_accesses FOR INSERT TO authenticated WITH CHECK (can_write_workspace(auth.uid(), workspace_id));
CREATE POLICY "ws_update" ON public.delivery_accesses FOR UPDATE TO authenticated USING (can_write_workspace(auth.uid(), workspace_id));
CREATE POLICY "ws_delete" ON public.delivery_accesses FOR DELETE TO authenticated USING (has_workspace_role(auth.uid(), workspace_id, 'admin'::workspace_role));

-- delivery_settings
CREATE TABLE public.delivery_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE UNIQUE,
  custom_domain text,
  global_redirect_url text,
  link_message_template text NOT NULL DEFAULT 'Olá! Aqui está seu acesso: {link}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.delivery_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ws_select" ON public.delivery_settings FOR SELECT TO authenticated USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "ws_insert" ON public.delivery_settings FOR INSERT TO authenticated WITH CHECK (can_write_workspace(auth.uid(), workspace_id));
CREATE POLICY "ws_update" ON public.delivery_settings FOR UPDATE TO authenticated USING (can_write_workspace(auth.uid(), workspace_id));
CREATE POLICY "ws_delete" ON public.delivery_settings FOR DELETE TO authenticated USING (has_workspace_role(auth.uid(), workspace_id, 'admin'::workspace_role));

-- delivery_link_generations
CREATE TABLE public.delivery_link_generations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.delivery_products(id) ON DELETE CASCADE,
  phone text,
  normalized_phone text,
  payment_method text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.delivery_link_generations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ws_select" ON public.delivery_link_generations FOR SELECT TO authenticated USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "ws_insert" ON public.delivery_link_generations FOR INSERT TO authenticated WITH CHECK (can_write_workspace(auth.uid(), workspace_id));
CREATE POLICY "ws_update" ON public.delivery_link_generations FOR UPDATE TO authenticated USING (can_write_workspace(auth.uid(), workspace_id));
CREATE POLICY "ws_delete" ON public.delivery_link_generations FOR DELETE TO authenticated USING (has_workspace_role(auth.uid(), workspace_id, 'admin'::workspace_role));

-- Indexes
CREATE INDEX idx_delivery_pixels_product ON public.delivery_pixels(product_id);
CREATE INDEX idx_delivery_accesses_product ON public.delivery_accesses(product_id);
CREATE INDEX idx_delivery_accesses_phone ON public.delivery_accesses(phone);
CREATE INDEX idx_delivery_link_gen_phone ON public.delivery_link_generations(normalized_phone);
CREATE INDEX idx_delivery_link_gen_product ON public.delivery_link_generations(product_id);
