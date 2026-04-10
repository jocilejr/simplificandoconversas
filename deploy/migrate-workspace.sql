BEGIN;

-- ============================================================
-- WORKSPACE MIGRATION (idempotent)
-- ============================================================

-- Enum
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'workspace_role') THEN
    CREATE TYPE public.workspace_role AS ENUM ('admin', 'operator', 'viewer');
  END IF;
END $$;

-- Workspaces table
CREATE TABLE IF NOT EXISTS public.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  logo_url text,
  openai_api_key text,
  app_public_url text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.workspaces TO anon, authenticated, service_role;

-- Workspace members table
CREATE TABLE IF NOT EXISTS public.workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role workspace_role NOT NULL DEFAULT 'viewer',
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  invited_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);
ALTER TABLE public.workspace_members ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.workspace_members TO anon, authenticated, service_role;

-- Helper functions
CREATE OR REPLACE FUNCTION public.is_workspace_member(_user_id uuid, _workspace_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.workspace_members WHERE user_id = _user_id AND workspace_id = _workspace_id) $$;

CREATE OR REPLACE FUNCTION public.get_workspace_role(_user_id uuid, _workspace_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT role::text FROM public.workspace_members WHERE user_id = _user_id AND workspace_id = _workspace_id LIMIT 1 $$;

CREATE OR REPLACE FUNCTION public.has_workspace_role(_user_id uuid, _workspace_id uuid, _role workspace_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.workspace_members WHERE user_id = _user_id AND workspace_id = _workspace_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION public.can_write_workspace(_user_id uuid, _workspace_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.workspace_members WHERE user_id = _user_id AND workspace_id = _workspace_id AND role IN ('admin', 'operator')) $$;

CREATE OR REPLACE FUNCTION public.get_user_workspace_ids(_user_id uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT workspace_id FROM public.workspace_members WHERE user_id = _user_id $$;

-- Auto-add workspace creator as admin
CREATE OR REPLACE FUNCTION public.auto_add_workspace_creator()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'admin')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_workspace_created') THEN
    CREATE TRIGGER on_workspace_created AFTER INSERT ON public.workspaces
    FOR EACH ROW EXECUTE FUNCTION public.auto_add_workspace_creator();
  END IF;
END $$;

-- Add workspace_id column to all data tables
DO $$
DECLARE _t text;
  _tables text[] := ARRAY[
    'ai_auto_reply_contacts','ai_config','ai_listen_contacts','api_request_logs',
    'boleto_recovery_templates','chatbot_flow_history','chatbot_flows',
    'contact_photos','contact_tags',
    'conversation_labels','conversations','email_campaigns','email_contacts',
    'email_events','email_follow_up_sends','email_follow_ups','email_link_clicks',
    'email_queue','email_sends','email_suppressions','email_templates',
    'flow_executions','flow_timeouts','followup_settings','labels','messages',
    'message_queue_config','meta_pixels',
    'platform_connections','quick_replies','recovery_queue','recovery_settings',
    'reminders','smtp_config',
    'tracked_links','transactions','whatsapp_instances',
    'group_selected','group_campaigns','group_scheduled_messages',
    'group_message_queue','group_participant_events','group_queue_config',
    'delivery_products','delivery_settings','delivery_accesses','delivery_link_generations',
    'delivery_pixels','global_delivery_pixels','member_products','member_area_settings',
    'member_area_offers','member_product_categories','member_product_materials','member_sessions',
    'workspace_domains'
  ];
BEGIN
  FOREACH _t IN ARRAY _tables LOOP
    IF to_regclass(format('public.%I', _t)) IS NULL THEN
      RAISE NOTICE 'Pulando tabela ausente: %', _t;
      CONTINUE;
    END IF;
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS workspace_id uuid', _t);
  END LOOP;
END $$;

-- Migrate existing data: create default workspace per user
DO $$
DECLARE _rec RECORD; _ws_id uuid;
  _tables text[] := ARRAY[
    'ai_auto_reply_contacts','ai_config','ai_listen_contacts','api_request_logs',
    'boleto_recovery_templates','chatbot_flow_history','chatbot_flows',
    'contact_photos','contact_tags',
    'conversation_labels','conversations','email_campaigns','email_contacts',
    'email_events','email_follow_up_sends','email_follow_ups','email_link_clicks',
    'email_queue','email_sends','email_suppressions','email_templates',
    'flow_executions','flow_timeouts','followup_settings','labels','messages',
    'message_queue_config','meta_pixels',
    'platform_connections','quick_replies','recovery_queue','recovery_settings',
    'reminders','smtp_config',
    'tracked_links','transactions','whatsapp_instances',
    'group_selected','group_campaigns','group_scheduled_messages',
    'group_message_queue','group_participant_events','group_queue_config',
    'delivery_products','delivery_settings','delivery_accesses','delivery_link_generations',
    'delivery_pixels','global_delivery_pixels','member_products','member_area_settings',
    'member_area_offers','member_product_categories','member_product_materials','member_sessions'
  ]; _t text;
BEGIN
  FOR _rec IN
    SELECT id AS user_id FROM auth.users
    WHERE NOT EXISTS (SELECT 1 FROM public.workspace_members wm WHERE wm.user_id = auth.users.id)
  LOOP
    INSERT INTO public.profiles (user_id) VALUES (_rec.user_id) ON CONFLICT DO NOTHING;

    _ws_id := gen_random_uuid();
    INSERT INTO public.workspaces (id, name, slug, created_by, openai_api_key, app_public_url)
    VALUES (
      _ws_id, 'Workspace Principal',
      'ws-' || substr(replace(_ws_id::text, '-', ''), 1, 12),
      _rec.user_id,
      (SELECT openai_api_key FROM public.profiles WHERE user_id = _rec.user_id LIMIT 1),
      (SELECT app_public_url FROM public.profiles WHERE user_id = _rec.user_id LIMIT 1)
    );

    FOREACH _t IN ARRAY _tables LOOP
      IF to_regclass(format('public.%I', _t)) IS NULL THEN
        RAISE NOTICE 'Pulando backfill em tabela ausente: %', _t;
        CONTINUE;
      END IF;
      EXECUTE format('UPDATE public.%I SET workspace_id = $1 WHERE user_id = $2 AND workspace_id IS NULL', _t)
      USING _ws_id, _rec.user_id;
    END LOOP;
  END LOOP;
END $$;

-- SAFETY CHECK: do not delete orphaned rows
DO $$
DECLARE _t text; _cnt bigint; _total bigint := 0;
  _tables text[] := ARRAY[
    'ai_auto_reply_contacts','ai_config','ai_listen_contacts','api_request_logs',
    'boleto_recovery_templates','chatbot_flow_history','chatbot_flows',
    'contact_photos','contact_tags',
    'conversation_labels','conversations','email_campaigns','email_contacts',
    'email_events','email_follow_up_sends','email_follow_ups','email_link_clicks',
    'email_queue','email_sends','email_suppressions','email_templates',
    'flow_executions','flow_timeouts','followup_settings','labels','messages',
    'message_queue_config','meta_pixels',
    'platform_connections','quick_replies','recovery_queue','recovery_settings',
    'reminders','smtp_config',
    'tracked_links','transactions','whatsapp_instances',
    'group_selected','group_campaigns','group_scheduled_messages',
    'group_message_queue','group_participant_events','group_queue_config',
    'delivery_products','delivery_settings','delivery_accesses','delivery_link_generations',
    'delivery_pixels','global_delivery_pixels','member_products','member_area_settings',
    'member_area_offers','member_product_categories','member_product_materials','member_sessions'
  ];
BEGIN
  FOREACH _t IN ARRAY _tables LOOP
    IF to_regclass(format('public.%I', _t)) IS NULL THEN
      CONTINUE;
    END IF;
    EXECUTE format('SELECT count(*) FROM public.%I WHERE workspace_id IS NULL', _t) INTO _cnt;
    IF _cnt > 0 THEN
      RAISE WARNING '⚠ Tabela % tem % registros sem workspace_id (NÃO deletados)', _t, _cnt;
      _total := _total + _cnt;
    END IF;
  END LOOP;
  IF _total > 0 THEN
    RAISE WARNING '⚠ Total de % registros órfãos encontrados. Revise manualmente.', _total;
  ELSE
    RAISE NOTICE '✓ Nenhum registro órfão encontrado.';
  END IF;
END $$;

-- Set NOT NULL + FK + index only where safe
DO $$
DECLARE _t text; _cnt bigint;
  _tables text[] := ARRAY[
    'ai_auto_reply_contacts','ai_config','ai_listen_contacts','api_request_logs',
    'boleto_recovery_templates','chatbot_flow_history','chatbot_flows',
    'contact_photos','contact_tags',
    'conversation_labels','conversations','email_campaigns','email_contacts',
    'email_events','email_follow_up_sends','email_follow_ups','email_link_clicks',
    'email_queue','email_sends','email_suppressions','email_templates',
    'flow_executions','flow_timeouts','followup_settings','labels','messages',
    'message_queue_config','meta_pixels',
    'platform_connections','quick_replies','recovery_queue','recovery_settings',
    'reminders','smtp_config',
    'tracked_links','transactions','whatsapp_instances',
    'group_selected','group_campaigns','group_scheduled_messages',
    'group_message_queue','group_participant_events','group_queue_config',
    'delivery_products','delivery_settings','delivery_accesses','delivery_link_generations',
    'delivery_pixels','global_delivery_pixels','member_products','member_area_settings',
    'member_area_offers','member_product_categories','member_product_materials','member_sessions'
  ];
BEGIN
  FOREACH _t IN ARRAY _tables LOOP
    IF to_regclass(format('public.%I', _t)) IS NULL THEN
      CONTINUE;
    END IF;
    EXECUTE format('SELECT count(*) FROM public.%I WHERE workspace_id IS NULL', _t) INTO _cnt;
    IF _cnt > 0 THEN
      RAISE WARNING 'Pulando NOT NULL para % (% registros sem workspace)', _t, _cnt;
      CONTINUE;
    END IF;
    BEGIN
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN workspace_id SET NOT NULL', _t);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT fk_%s_workspace FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE', _t, _t);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_workspace ON public.%I (workspace_id)', _t, _t);
  END LOOP;
END $$;

-- Drop old user-based RLS policies and create workspace-based ones
DO $$
DECLARE _pol RECORD;
BEGIN
  FOR _pol IN SELECT schemaname, tablename, policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename NOT IN ('workspaces','workspace_members','user_roles','profiles')
    AND policyname NOT LIKE 'ws_%' AND policyname NOT LIKE 'wm_%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', _pol.policyname, _pol.schemaname, _pol.tablename);
  END LOOP;
END $$;

DO $$
DECLARE _t text;
  _tables text[] := ARRAY[
    'ai_auto_reply_contacts','ai_config','ai_listen_contacts',
    'boleto_recovery_templates','chatbot_flow_history','chatbot_flows',
    'contact_photos','contact_tags',
    'conversation_labels','conversations','email_campaigns','email_contacts',
    'email_events','email_follow_up_sends','email_follow_ups',
    'email_queue','email_sends','email_suppressions','email_templates',
    'flow_executions','flow_timeouts','followup_settings','labels','messages',
    'message_queue_config','meta_pixels',
    'platform_connections','quick_replies','recovery_queue','recovery_settings',
    'reminders','smtp_config',
    'tracked_links','transactions','whatsapp_instances',
    'group_selected','group_campaigns','group_scheduled_messages',
    'group_message_queue','group_participant_events','group_queue_config',
    'delivery_products','delivery_settings','delivery_accesses','delivery_link_generations',
    'delivery_pixels','global_delivery_pixels','member_products','member_area_settings',
    'member_area_offers','member_product_categories','member_product_materials','member_sessions'
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

-- Read-only workspace-scoped tables
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='api_request_logs' AND policyname='ws_select') THEN
    CREATE POLICY "ws_select" ON public.api_request_logs FOR SELECT TO authenticated USING (public.is_workspace_member(auth.uid(), workspace_id));
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.email_link_clicks') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='email_link_clicks' AND policyname='ws_select') THEN
    CREATE POLICY "ws_select" ON public.email_link_clicks FOR SELECT TO authenticated USING (public.is_workspace_member(auth.uid(), workspace_id));
  END IF;
END $$;

-- Workspace RLS policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='workspaces' AND policyname='ws_select') THEN
    CREATE POLICY "ws_select" ON public.workspaces FOR SELECT TO authenticated USING (id IN (SELECT public.get_user_workspace_ids(auth.uid())));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='workspaces' AND policyname='ws_insert') THEN
    CREATE POLICY "ws_insert" ON public.workspaces FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='workspaces' AND policyname='ws_update') THEN
    CREATE POLICY "ws_update" ON public.workspaces FOR UPDATE TO authenticated USING (public.has_workspace_role(auth.uid(), id, 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='workspaces' AND policyname='ws_delete') THEN
    CREATE POLICY "ws_delete" ON public.workspaces FOR DELETE TO authenticated USING (public.has_workspace_role(auth.uid(), id, 'admin'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='workspace_members' AND policyname='wm_select') THEN
    CREATE POLICY "wm_select" ON public.workspace_members FOR SELECT TO authenticated USING (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())));
  END IF;
  DROP POLICY IF EXISTS "wm_insert" ON public.workspace_members;
  CREATE POLICY "wm_insert" ON public.workspace_members FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid() OR public.has_workspace_role(auth.uid(), workspace_id, 'admin'));
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='workspace_members' AND policyname='wm_update') THEN
    CREATE POLICY "wm_update" ON public.workspace_members FOR UPDATE TO authenticated USING (public.has_workspace_role(auth.uid(), workspace_id, 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='workspace_members' AND policyname='wm_delete') THEN
    CREATE POLICY "wm_delete" ON public.workspace_members FOR DELETE TO authenticated USING (public.has_workspace_role(auth.uid(), workspace_id, 'admin'));
  END IF;
END $$;

-- Update handle_new_user to auto-create workspace
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE _ws_id uuid;
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT DO NOTHING;
  _ws_id := gen_random_uuid();
  INSERT INTO public.workspaces (id, name, slug, created_by)
  VALUES (_ws_id, 'Meu Workspace', 'ws-' || substr(replace(_ws_id::text, '-', ''), 1, 12), NEW.id);
  RETURN NEW;
END;
$$;

-- Performance index for RLS membership lookups
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_workspace
  ON public.workspace_members(user_id, workspace_id);

-- Fix: allow any authenticated user to create a workspace (they must be the creator)
DROP POLICY IF EXISTS "ws_insert" ON public.workspaces;
CREATE POLICY "ws_insert" ON public.workspaces
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

NOTIFY pgrst, 'reload schema';

COMMIT;