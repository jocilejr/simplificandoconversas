-- ============================================================
-- FIX: Create/recreate member tables + Storage RLS (idempotent)
-- Run on VPS: docker exec -i deploy-postgres-1 psql -U postgres -d postgres < fix-member-tables.sql
-- ============================================================

BEGIN;

-- ============================================================
-- 0. Remove auto-admin promotion trigger (security fix)
-- ============================================================
DROP TRIGGER IF EXISTS on_profile_created_assign_admin ON public.profiles;
DROP FUNCTION IF EXISTS public.assign_admin_role();

-- Remove global admin from all users except the real Super Admin (Jocile Júnior)
DELETE FROM user_roles
WHERE role = 'admin'
AND user_id != '46ed58c8-fb6b-4eb5-ad02-bd54a6c098d6';

-- ============================================================
-- 0a. Fix member_area_settings columns
-- ============================================================
ALTER TABLE public.member_area_settings ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.member_area_settings ADD COLUMN IF NOT EXISTS welcome_message text;
ALTER TABLE public.member_area_settings ADD COLUMN IF NOT EXISTS theme_color text DEFAULT '#8B5CF6';
ALTER TABLE public.member_area_settings ADD COLUMN IF NOT EXISTS ai_persona_prompt text;
ALTER TABLE public.member_area_settings ADD COLUMN IF NOT EXISTS greeting_prompt text;
ALTER TABLE public.member_area_settings ADD COLUMN IF NOT EXISTS offer_prompt text;
ALTER TABLE public.member_area_settings ADD COLUMN IF NOT EXISTS ai_model text DEFAULT 'gpt-4o-mini';

-- ============================================================
-- 0b. Fix member_products columns
-- ============================================================
ALTER TABLE public.member_products ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.member_products ADD COLUMN IF NOT EXISTS product_id uuid;
ALTER TABLE public.member_products ADD COLUMN IF NOT EXISTS granted_at timestamptz DEFAULT now();

-- ============================================================
-- 1. Create member_area_offers if not exists + fix columns
-- ============================================================
CREATE TABLE IF NOT EXISTS public.member_area_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'Oferta',
  description text,
  is_active boolean NOT NULL DEFAULT true,
  price numeric,
  purchase_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.member_area_offers ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.member_area_offers TO anon, authenticated, service_role;

ALTER TABLE public.member_area_offers ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.member_area_offers ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.member_area_offers ADD COLUMN IF NOT EXISTS product_id uuid;
ALTER TABLE public.member_area_offers ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.member_area_offers ADD COLUMN IF NOT EXISTS purchase_url text;
ALTER TABLE public.member_area_offers ADD COLUMN IF NOT EXISTS display_type text NOT NULL DEFAULT 'floating_bar';
ALTER TABLE public.member_area_offers ADD COLUMN IF NOT EXISTS pix_key text;
ALTER TABLE public.member_area_offers ADD COLUMN IF NOT EXISTS pix_key_type text;
ALTER TABLE public.member_area_offers ADD COLUMN IF NOT EXISTS card_payment_url text;
ALTER TABLE public.member_area_offers ADD COLUMN IF NOT EXISTS category_tag text;
ALTER TABLE public.member_area_offers ADD COLUMN IF NOT EXISTS total_impressions integer NOT NULL DEFAULT 0;
ALTER TABLE public.member_area_offers ADD COLUMN IF NOT EXISTS total_clicks integer NOT NULL DEFAULT 0;
ALTER TABLE public.member_area_offers ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- Fix title/name compatibility: title may be NOT NULL on old VPS installs
ALTER TABLE public.member_area_offers ALTER COLUMN title DROP NOT NULL;

-- Backfill: ensure name is populated from title (legacy) or default
UPDATE public.member_area_offers
SET name = COALESCE(NULLIF(name, ''), NULLIF(title, ''), 'Oferta')
WHERE name IS NULL OR btrim(name) = '';

UPDATE public.member_area_offers
SET title = COALESCE(NULLIF(title, ''), name, 'Oferta')
WHERE title IS NULL OR btrim(title) = '';

ALTER TABLE public.member_area_offers ALTER COLUMN name SET DEFAULT 'Oferta';
-- Ensure name is NOT NULL going forward
DO $$ BEGIN
  ALTER TABLE public.member_area_offers ALTER COLUMN name SET NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Add FK to delivery_products for PostgREST joins (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'member_area_offers_product_id_fkey'
      AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.member_area_offers
      ADD CONSTRAINT member_area_offers_product_id_fkey
      FOREIGN KEY (product_id) REFERENCES public.delivery_products(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================
-- 2. Ensure member tables exist (idempotent — NO DROP)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.member_product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  product_id uuid NOT NULL,
  name text NOT NULL,
  icon text,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.member_product_categories ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.member_product_categories TO anon, authenticated, service_role;

ALTER TABLE public.member_product_categories ADD COLUMN IF NOT EXISTS icon text;
ALTER TABLE public.member_product_categories ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.member_product_categories ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.member_product_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  product_id uuid NOT NULL,
  category_id uuid,
  title text NOT NULL,
  content_type text NOT NULL DEFAULT 'text',
  content_url text,
  description text,
  content_text text,
  button_label text,
  sort_order integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  is_preview boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.member_product_materials ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.member_product_materials TO anon, authenticated, service_role;

ALTER TABLE public.member_product_materials ADD COLUMN IF NOT EXISTS category_id uuid;
ALTER TABLE public.member_product_materials ADD COLUMN IF NOT EXISTS content_url text;
ALTER TABLE public.member_product_materials ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.member_product_materials ADD COLUMN IF NOT EXISTS content_text text;
ALTER TABLE public.member_product_materials ADD COLUMN IF NOT EXISTS button_label text;
ALTER TABLE public.member_product_materials ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
ALTER TABLE public.member_product_materials ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT true;
ALTER TABLE public.member_product_materials ADD COLUMN IF NOT EXISTS is_preview boolean NOT NULL DEFAULT false;

-- Add FK for category_id -> member_product_categories (enables PostgREST joins)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'member_product_materials_category_id_fkey'
      AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.member_product_materials
      ADD CONSTRAINT member_product_materials_category_id_fkey
      FOREIGN KEY (category_id) REFERENCES public.member_product_categories(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- 3. Ensure member_sessions exists (idempotent — NO DROP)
CREATE TABLE IF NOT EXISTS public.member_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  normalized_phone text NOT NULL,
  current_product_name text,
  current_material_name text,
  current_activity text,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_heartbeat_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.member_sessions ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.member_sessions TO anon, authenticated, service_role;

ALTER TABLE public.member_sessions ADD COLUMN IF NOT EXISTS current_product_name text;
ALTER TABLE public.member_sessions ADD COLUMN IF NOT EXISTS current_material_name text;
ALTER TABLE public.member_sessions ADD COLUMN IF NOT EXISTS current_activity text;
ALTER TABLE public.member_sessions ADD COLUMN IF NOT EXISTS last_heartbeat_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.member_sessions ADD COLUMN IF NOT EXISTS ended_at timestamptz;

-- ============================================================
-- 5. New tables (idempotent)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.member_content_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid,
  normalized_phone text NOT NULL,
  material_id uuid NOT NULL,
  progress_type text NOT NULL DEFAULT 'pdf',
  current_page integer NOT NULL DEFAULT 0,
  total_pages integer NOT NULL DEFAULT 0,
  video_seconds integer NOT NULL DEFAULT 0,
  video_duration integer NOT NULL DEFAULT 0,
  last_accessed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.member_content_progress ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.member_content_progress TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.member_pixel_frames (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  normalized_phone text NOT NULL,
  product_name text,
  product_value numeric DEFAULT 0,
  fired boolean NOT NULL DEFAULT false,
  fired_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.member_pixel_frames ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.member_pixel_frames TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.member_offer_impressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  normalized_phone text NOT NULL,
  offer_id uuid NOT NULL,
  impression_count integer NOT NULL DEFAULT 0,
  clicked boolean NOT NULL DEFAULT false,
  payment_started boolean NOT NULL DEFAULT false,
  payment_method text,
  last_shown_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.member_offer_impressions ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.member_offer_impressions TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.daily_prayers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid,
  day_number integer NOT NULL,
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.daily_prayers ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.daily_prayers TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.openai_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  api_key text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.openai_settings ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.openai_settings TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.product_knowledge_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  product_id uuid NOT NULL,
  summary text NOT NULL DEFAULT '',
  key_topics text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.product_knowledge_summaries ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.product_knowledge_summaries TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.manual_boleto_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  webhook_url text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.manual_boleto_settings ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.manual_boleto_settings TO anon, authenticated, service_role;

-- ============================================================
-- 6. RPC functions (now safe — columns exist)
-- ============================================================
CREATE OR REPLACE FUNCTION public.increment_offer_impression(offer_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$ UPDATE member_area_offers SET total_impressions = total_impressions + 1 WHERE id = offer_id; $$;

CREATE OR REPLACE FUNCTION public.increment_offer_click(offer_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$ UPDATE member_area_offers SET total_clicks = total_clicks + 1 WHERE id = offer_id; $$;

-- ============================================================
-- 7. Storage bucket + RLS policies for member-files
-- ============================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('member-files', 'member-files', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies to avoid duplicates
DO $$ BEGIN
  DROP POLICY IF EXISTS "Public read member-files" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated upload member-files" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated update member-files" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated delete member-files" ON storage.objects;
END $$;

CREATE POLICY "Public read member-files" ON storage.objects
  FOR SELECT USING (bucket_id = 'member-files');

CREATE POLICY "Authenticated upload member-files" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'member-files');

CREATE POLICY "Authenticated update member-files" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'member-files');

CREATE POLICY "Authenticated delete member-files" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'member-files');

-- ============================================================
-- 8. Enable realtime for member_sessions
-- ============================================================
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.member_sessions;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ============================================================
-- 9. Workspace RLS policies for all new tables
-- ============================================================
DO $$
DECLARE _t text;
  _tables text[] := ARRAY[
    'member_product_categories','member_product_materials','member_sessions',
    'member_content_progress','member_pixel_frames','member_offer_impressions',
    'daily_prayers','openai_settings','product_knowledge_summaries','manual_boleto_settings',
    'member_area_offers'
  ];
BEGIN
  FOREACH _t IN ARRAY _tables LOOP
    BEGIN
      EXECUTE format('CREATE POLICY "ws_select" ON public.%I FOR SELECT TO authenticated USING (public.is_workspace_member(auth.uid(), workspace_id))', _t);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
      EXECUTE format('CREATE POLICY "ws_insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.can_write_workspace(auth.uid(), workspace_id))', _t);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
      EXECUTE format('CREATE POLICY "ws_update" ON public.%I FOR UPDATE TO authenticated USING (public.can_write_workspace(auth.uid(), workspace_id))', _t);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
      EXECUTE format('CREATE POLICY "ws_delete" ON public.%I FOR DELETE TO authenticated USING (public.has_workspace_role(auth.uid(), workspace_id, ''admin''))', _t);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;

-- Anon select for daily_prayers (public access)
DO $$ BEGIN
  CREATE POLICY "anon_select" ON public.daily_prayers FOR SELECT TO anon USING (true);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Anon policies for member access (no auth required)
DO $$
DECLARE _t text;
  _tables text[] := ARRAY[
    'member_content_progress','member_pixel_frames','member_offer_impressions','member_sessions'
  ];
BEGIN
  FOREACH _t IN ARRAY _tables LOOP
    BEGIN
      EXECUTE format('CREATE POLICY "anon_select" ON public.%I FOR SELECT TO anon USING (true)', _t);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
      EXECUTE format('CREATE POLICY "anon_insert" ON public.%I FOR INSERT TO anon WITH CHECK (true)', _t);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
      EXECUTE format('CREATE POLICY "anon_update" ON public.%I FOR UPDATE TO anon USING (true)', _t);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;

-- Anon access for member_product_categories and member_product_materials (read only)
DO $$
DECLARE _t text;
  _tables text[] := ARRAY['member_product_categories','member_product_materials'];
BEGIN
  FOREACH _t IN ARRAY _tables LOOP
    BEGIN
      EXECUTE format('CREATE POLICY "anon_select" ON public.%I FOR SELECT TO anon USING (true)', _t);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;

-- ============================================================
-- 10. Fix dangerous CASCADE FKs on workspace_id → RESTRICT
-- Prevents silent data loss when workspaces are deleted/recreated
-- ============================================================

-- member_product_categories: DROP CASCADE, ADD RESTRICT
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_member_product_categories_workspace'
      AND conrelid = 'public.member_product_categories'::regclass
      AND pg_get_constraintdef(oid) ILIKE '%CASCADE%'
  ) THEN
    ALTER TABLE public.member_product_categories
      DROP CONSTRAINT fk_member_product_categories_workspace;
    ALTER TABLE public.member_product_categories
      ADD CONSTRAINT fk_member_product_categories_workspace
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE RESTRICT;
    RAISE NOTICE 'Fixed member_product_categories FK: CASCADE → RESTRICT';
  END IF;
END $$;

-- member_product_materials: DROP CASCADE, ADD RESTRICT
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_member_product_materials_workspace'
      AND conrelid = 'public.member_product_materials'::regclass
      AND pg_get_constraintdef(oid) ILIKE '%CASCADE%'
  ) THEN
    ALTER TABLE public.member_product_materials
      DROP CONSTRAINT fk_member_product_materials_workspace;
    ALTER TABLE public.member_product_materials
      ADD CONSTRAINT fk_member_product_materials_workspace
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE RESTRICT;
    RAISE NOTICE 'Fixed member_product_materials FK: CASCADE → RESTRICT';
  END IF;
END $$;

-- member_area_offers: has TWO workspace FKs — remove both CASCADE, add one RESTRICT
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_member_area_offers_workspace'
      AND conrelid = 'public.member_area_offers'::regclass
      AND pg_get_constraintdef(oid) ILIKE '%CASCADE%'
  ) THEN
    ALTER TABLE public.member_area_offers
      DROP CONSTRAINT fk_member_area_offers_workspace;
    RAISE NOTICE 'Dropped fk_member_area_offers_workspace (CASCADE)';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'member_area_offers_workspace_id_fkey'
      AND conrelid = 'public.member_area_offers'::regclass
      AND pg_get_constraintdef(oid) ILIKE '%CASCADE%'
  ) THEN
    ALTER TABLE public.member_area_offers
      DROP CONSTRAINT member_area_offers_workspace_id_fkey;
    RAISE NOTICE 'Dropped member_area_offers_workspace_id_fkey (CASCADE)';
  END IF;
END $$;

-- Re-add single safe FK for member_area_offers
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.member_area_offers'::regclass
      AND confrelid = 'public.workspaces'::regclass
      AND contype = 'f'
  ) THEN
    ALTER TABLE public.member_area_offers
      ADD CONSTRAINT fk_member_area_offers_workspace
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE RESTRICT;
    RAISE NOTICE 'Added fk_member_area_offers_workspace (RESTRICT)';
  END IF;
END $$;

-- ============================================================
-- 11. Deletion audit table + triggers (idempotent)
-- Tracks any DELETE on critical member tables and workspaces
-- ============================================================
CREATE TABLE IF NOT EXISTS public.deletion_audit (
  id serial PRIMARY KEY,
  table_name text NOT NULL,
  record_id uuid,
  old_data jsonb,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  deleted_by text DEFAULT current_user
);

CREATE OR REPLACE FUNCTION public.audit_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO deletion_audit(table_name, record_id, old_data)
  VALUES (TG_TABLE_NAME, OLD.id, row_to_json(OLD)::jsonb);
  RETURN OLD;
END;
$$;

DO $$ BEGIN
  DROP TRIGGER IF EXISTS audit_del_materials ON public.member_product_materials;
  CREATE TRIGGER audit_del_materials BEFORE DELETE ON public.member_product_materials
    FOR EACH ROW EXECUTE FUNCTION public.audit_delete();

  DROP TRIGGER IF EXISTS audit_del_categories ON public.member_product_categories;
  CREATE TRIGGER audit_del_categories BEFORE DELETE ON public.member_product_categories
    FOR EACH ROW EXECUTE FUNCTION public.audit_delete();

  DROP TRIGGER IF EXISTS audit_del_offers ON public.member_area_offers;
  CREATE TRIGGER audit_del_offers BEFORE DELETE ON public.member_area_offers
    FOR EACH ROW EXECUTE FUNCTION public.audit_delete();

  DROP TRIGGER IF EXISTS audit_del_workspaces ON public.workspaces;
  CREATE TRIGGER audit_del_workspaces BEFORE DELETE ON public.workspaces
    FOR EACH ROW EXECUTE FUNCTION public.audit_delete();
END $$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

COMMIT;
