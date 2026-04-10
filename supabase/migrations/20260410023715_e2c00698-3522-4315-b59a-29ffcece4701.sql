
-- member_content_progress
CREATE TABLE public.member_content_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  normalized_phone text NOT NULL,
  material_id uuid NOT NULL,
  progress_type text NOT NULL DEFAULT 'pdf',
  current_page integer NOT NULL DEFAULT 0,
  total_pages integer NOT NULL DEFAULT 0,
  video_seconds integer NOT NULL DEFAULT 0,
  video_duration integer NOT NULL DEFAULT 0,
  last_accessed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(normalized_phone, material_id)
);
ALTER TABLE public.member_content_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_insert" ON public.member_content_progress FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update" ON public.member_content_progress FOR UPDATE TO anon USING (true);
CREATE POLICY "anon_select" ON public.member_content_progress FOR SELECT TO anon USING (true);
CREATE POLICY "ws_select" ON public.member_content_progress FOR SELECT TO authenticated USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "ws_insert" ON public.member_content_progress FOR INSERT TO authenticated WITH CHECK (can_write_workspace(auth.uid(), workspace_id));
CREATE POLICY "ws_update" ON public.member_content_progress FOR UPDATE TO authenticated USING (can_write_workspace(auth.uid(), workspace_id));
CREATE POLICY "ws_delete" ON public.member_content_progress FOR DELETE TO authenticated USING (has_workspace_role(auth.uid(), workspace_id, 'admin'::workspace_role));

-- member_pixel_frames
CREATE TABLE public.member_pixel_frames (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  normalized_phone text NOT NULL,
  product_name text,
  product_value numeric DEFAULT 0,
  fired boolean NOT NULL DEFAULT false,
  fired_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.member_pixel_frames ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_select" ON public.member_pixel_frames FOR SELECT TO anon USING (true);
CREATE POLICY "anon_update" ON public.member_pixel_frames FOR UPDATE TO anon USING (true);
CREATE POLICY "ws_select" ON public.member_pixel_frames FOR SELECT TO authenticated USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "ws_insert" ON public.member_pixel_frames FOR INSERT TO authenticated WITH CHECK (can_write_workspace(auth.uid(), workspace_id));
CREATE POLICY "ws_delete" ON public.member_pixel_frames FOR DELETE TO authenticated USING (has_workspace_role(auth.uid(), workspace_id, 'admin'::workspace_role));

-- member_offer_impressions
CREATE TABLE public.member_offer_impressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  normalized_phone text NOT NULL,
  offer_id uuid NOT NULL,
  impression_count integer NOT NULL DEFAULT 0,
  clicked boolean NOT NULL DEFAULT false,
  last_shown_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(normalized_phone, offer_id)
);
ALTER TABLE public.member_offer_impressions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_insert" ON public.member_offer_impressions FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update" ON public.member_offer_impressions FOR UPDATE TO anon USING (true);
CREATE POLICY "anon_select" ON public.member_offer_impressions FOR SELECT TO anon USING (true);

-- daily_prayers
CREATE TABLE public.daily_prayers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  day_number integer NOT NULL,
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.daily_prayers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_select" ON public.daily_prayers FOR SELECT TO anon USING (true);
CREATE POLICY "ws_select" ON public.daily_prayers FOR SELECT TO authenticated USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "ws_insert" ON public.daily_prayers FOR INSERT TO authenticated WITH CHECK (can_write_workspace(auth.uid(), workspace_id));
CREATE POLICY "ws_update" ON public.daily_prayers FOR UPDATE TO authenticated USING (can_write_workspace(auth.uid(), workspace_id));
CREATE POLICY "ws_delete" ON public.daily_prayers FOR DELETE TO authenticated USING (has_workspace_role(auth.uid(), workspace_id, 'admin'::workspace_role));

-- openai_settings
CREATE TABLE public.openai_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL UNIQUE,
  api_key text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.openai_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ws_select" ON public.openai_settings FOR SELECT TO authenticated USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "ws_insert" ON public.openai_settings FOR INSERT TO authenticated WITH CHECK (can_write_workspace(auth.uid(), workspace_id));
CREATE POLICY "ws_update" ON public.openai_settings FOR UPDATE TO authenticated USING (can_write_workspace(auth.uid(), workspace_id));
CREATE POLICY "ws_delete" ON public.openai_settings FOR DELETE TO authenticated USING (has_workspace_role(auth.uid(), workspace_id, 'admin'::workspace_role));

-- product_knowledge_summaries
CREATE TABLE public.product_knowledge_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  product_id uuid NOT NULL,
  summary text NOT NULL DEFAULT '',
  key_topics text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.product_knowledge_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ws_select" ON public.product_knowledge_summaries FOR SELECT TO authenticated USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "ws_insert" ON public.product_knowledge_summaries FOR INSERT TO authenticated WITH CHECK (can_write_workspace(auth.uid(), workspace_id));
CREATE POLICY "ws_update" ON public.product_knowledge_summaries FOR UPDATE TO authenticated USING (can_write_workspace(auth.uid(), workspace_id));
CREATE POLICY "ws_delete" ON public.product_knowledge_summaries FOR DELETE TO authenticated USING (has_workspace_role(auth.uid(), workspace_id, 'admin'::workspace_role));

-- manual_boleto_settings
CREATE TABLE public.manual_boleto_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL UNIQUE,
  webhook_url text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.manual_boleto_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_select" ON public.manual_boleto_settings FOR SELECT TO anon USING (true);
CREATE POLICY "ws_select" ON public.manual_boleto_settings FOR SELECT TO authenticated USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "ws_insert" ON public.manual_boleto_settings FOR INSERT TO authenticated WITH CHECK (can_write_workspace(auth.uid(), workspace_id));
CREATE POLICY "ws_update" ON public.manual_boleto_settings FOR UPDATE TO authenticated USING (can_write_workspace(auth.uid(), workspace_id));
CREATE POLICY "ws_delete" ON public.manual_boleto_settings FOR DELETE TO authenticated USING (has_workspace_role(auth.uid(), workspace_id, 'admin'::workspace_role));

-- RPC: increment_offer_impression
CREATE OR REPLACE FUNCTION public.increment_offer_impression(offer_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE member_area_offers SET total_impressions = total_impressions + 1 WHERE id = offer_id;
$$;

-- RPC: increment_offer_click
CREATE OR REPLACE FUNCTION public.increment_offer_click(offer_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE member_area_offers SET total_clicks = total_clicks + 1 WHERE id = offer_id;
$$;
