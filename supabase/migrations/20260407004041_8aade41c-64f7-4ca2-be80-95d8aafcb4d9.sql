
-- ====================================================
-- Multi-tenant workspaces migration
-- ====================================================

-- 1. Create workspace_role enum
CREATE TYPE public.workspace_role AS ENUM ('admin', 'operator', 'viewer');

-- 2. Create workspaces table
CREATE TABLE public.workspaces (
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

-- 3. Create workspace_members table
CREATE TABLE public.workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role workspace_role NOT NULL DEFAULT 'viewer',
  invited_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- 4. Security definer helper functions
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

-- 5. Trigger to auto-add workspace creator as admin
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

CREATE TRIGGER on_workspace_created
AFTER INSERT ON public.workspaces
FOR EACH ROW EXECUTE FUNCTION public.auto_add_workspace_creator();

-- 6. RLS for workspaces table
CREATE POLICY "ws_select" ON public.workspaces FOR SELECT TO authenticated
USING (id IN (SELECT public.get_user_workspace_ids(auth.uid())));
CREATE POLICY "ws_insert" ON public.workspaces FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid());
CREATE POLICY "ws_update" ON public.workspaces FOR UPDATE TO authenticated
USING (public.has_workspace_role(auth.uid(), id, 'admin'));
CREATE POLICY "ws_delete" ON public.workspaces FOR DELETE TO authenticated
USING (public.has_workspace_role(auth.uid(), id, 'admin'));

-- 7. RLS for workspace_members table
CREATE POLICY "wm_select" ON public.workspace_members FOR SELECT TO authenticated
USING (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())));
CREATE POLICY "wm_insert" ON public.workspace_members FOR INSERT TO authenticated
WITH CHECK (public.has_workspace_role(auth.uid(), workspace_id, 'admin'));
CREATE POLICY "wm_update" ON public.workspace_members FOR UPDATE TO authenticated
USING (public.has_workspace_role(auth.uid(), workspace_id, 'admin'));
CREATE POLICY "wm_delete" ON public.workspace_members FOR DELETE TO authenticated
USING (public.has_workspace_role(auth.uid(), workspace_id, 'admin'));

-- 8. Add workspace_id column to all data tables (nullable first)
DO $$
DECLARE
  _table text;
  _tables text[] := ARRAY[
    'ai_auto_reply_contacts','ai_config','ai_listen_contacts','api_request_logs',
    'chatbot_flow_history','chatbot_flows','contact_photos','contact_tags',
    'conversation_labels','conversations','email_campaigns','email_contacts',
    'email_events','email_follow_up_sends','email_follow_ups','email_link_clicks',
    'email_queue','email_sends','email_suppressions','email_templates',
    'flow_executions','flow_timeouts','labels','messages','meta_pixels',
    'platform_connections','quick_replies','reminders','smtp_config',
    'tracked_links','transactions','whatsapp_instances'
  ];
BEGIN
  FOREACH _table IN ARRAY _tables LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS workspace_id uuid', _table);
  END LOOP;
END $$;

-- 9. Migrate existing data: create default workspace per user and populate workspace_id
DO $$
DECLARE
  _user_rec RECORD;
  _ws_id uuid;
  _table text;
  _tables text[] := ARRAY[
    'ai_auto_reply_contacts','ai_config','ai_listen_contacts','api_request_logs',
    'chatbot_flow_history','chatbot_flows','contact_photos','contact_tags',
    'conversation_labels','conversations','email_campaigns','email_contacts',
    'email_events','email_follow_up_sends','email_follow_ups','email_link_clicks',
    'email_queue','email_sends','email_suppressions','email_templates',
    'flow_executions','flow_timeouts','labels','messages','meta_pixels',
    'platform_connections','quick_replies','reminders','smtp_config',
    'tracked_links','transactions','whatsapp_instances'
  ];
BEGIN
  FOR _user_rec IN SELECT DISTINCT user_id FROM public.profiles LOOP
    _ws_id := gen_random_uuid();
    INSERT INTO public.workspaces (id, name, slug, created_by, openai_api_key, app_public_url)
    VALUES (
      _ws_id,
      'Workspace Principal',
      'ws-' || substr(replace(_ws_id::text, '-', ''), 1, 12),
      _user_rec.user_id,
      (SELECT openai_api_key FROM public.profiles WHERE user_id = _user_rec.user_id LIMIT 1),
      (SELECT app_public_url FROM public.profiles WHERE user_id = _user_rec.user_id LIMIT 1)
    );
    -- Trigger auto_add_workspace_creator adds the user as admin automatically

    FOREACH _table IN ARRAY _tables LOOP
      EXECUTE format('UPDATE public.%I SET workspace_id = $1 WHERE user_id = $2 AND workspace_id IS NULL', _table)
      USING _ws_id, _user_rec.user_id;
    END LOOP;
  END LOOP;
END $$;

-- 10. Clean up orphaned rows (data without matching profile)
DO $$
DECLARE
  _table text;
  _tables text[] := ARRAY[
    'ai_auto_reply_contacts','ai_config','ai_listen_contacts','api_request_logs',
    'chatbot_flow_history','chatbot_flows','contact_photos','contact_tags',
    'conversation_labels','conversations','email_campaigns','email_contacts',
    'email_events','email_follow_up_sends','email_follow_ups','email_link_clicks',
    'email_queue','email_sends','email_suppressions','email_templates',
    'flow_executions','flow_timeouts','labels','messages','meta_pixels',
    'platform_connections','quick_replies','reminders','smtp_config',
    'tracked_links','transactions','whatsapp_instances'
  ];
BEGIN
  FOREACH _table IN ARRAY _tables LOOP
    EXECUTE format('DELETE FROM public.%I WHERE workspace_id IS NULL', _table);
  END LOOP;
END $$;

-- 11. Set NOT NULL, add FK and indexes
DO $$
DECLARE
  _table text;
  _tables text[] := ARRAY[
    'ai_auto_reply_contacts','ai_config','ai_listen_contacts','api_request_logs',
    'chatbot_flow_history','chatbot_flows','contact_photos','contact_tags',
    'conversation_labels','conversations','email_campaigns','email_contacts',
    'email_events','email_follow_up_sends','email_follow_ups','email_link_clicks',
    'email_queue','email_sends','email_suppressions','email_templates',
    'flow_executions','flow_timeouts','labels','messages','meta_pixels',
    'platform_connections','quick_replies','reminders','smtp_config',
    'tracked_links','transactions','whatsapp_instances'
  ];
BEGIN
  FOREACH _table IN ARRAY _tables LOOP
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN workspace_id SET NOT NULL', _table);
    EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT fk_%s_workspace FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE', _table, _table);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_workspace ON public.%I (workspace_id)', _table, _table);
  END LOOP;
END $$;

-- 12. Drop ALL old RLS policies on data tables
DO $$
DECLARE
  _pol RECORD;
BEGIN
  FOR _pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename NOT IN ('workspaces', 'workspace_members', 'user_roles', 'profiles')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', _pol.policyname, _pol.schemaname, _pol.tablename);
  END LOOP;
END $$;

-- 13. Create new workspace-based RLS policies for standard data tables
DO $$
DECLARE
  _table text;
  _tables text[] := ARRAY[
    'ai_auto_reply_contacts','ai_config','ai_listen_contacts',
    'chatbot_flow_history','chatbot_flows','contact_photos','contact_tags',
    'conversation_labels','conversations','email_campaigns','email_contacts',
    'email_events','email_follow_up_sends','email_follow_ups',
    'email_queue','email_sends','email_suppressions','email_templates',
    'flow_executions','flow_timeouts','labels','messages','meta_pixels',
    'platform_connections','quick_replies','reminders','smtp_config',
    'tracked_links','transactions','whatsapp_instances'
  ];
BEGIN
  FOREACH _table IN ARRAY _tables LOOP
    EXECUTE format('CREATE POLICY "ws_select" ON public.%I FOR SELECT TO authenticated USING (public.is_workspace_member(auth.uid(), workspace_id))', _table);
    EXECUTE format('CREATE POLICY "ws_insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.can_write_workspace(auth.uid(), workspace_id))', _table);
    EXECUTE format('CREATE POLICY "ws_update" ON public.%I FOR UPDATE TO authenticated USING (public.can_write_workspace(auth.uid(), workspace_id))', _table);
    EXECUTE format('CREATE POLICY "ws_delete" ON public.%I FOR DELETE TO authenticated USING (public.has_workspace_role(auth.uid(), workspace_id, ''admin''))', _table);
  END LOOP;
END $$;

-- 14. Read-only tables: only SELECT for members
DO $$
DECLARE
  _table text;
  _tables text[] := ARRAY['api_request_logs', 'email_link_clicks'];
BEGIN
  FOREACH _table IN ARRAY _tables LOOP
    EXECUTE format('CREATE POLICY "ws_select" ON public.%I FOR SELECT TO authenticated USING (public.is_workspace_member(auth.uid(), workspace_id))', _table);
  END LOOP;
END $$;

-- 15. Update handle_new_user trigger to create default workspace
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _ws_id uuid;
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT DO NOTHING;

  _ws_id := gen_random_uuid();
  INSERT INTO public.workspaces (id, name, slug, created_by)
  VALUES (_ws_id, 'Meu Workspace', 'ws-' || substr(replace(_ws_id::text, '-', ''), 1, 12), NEW.id);
  -- Trigger on_workspace_created auto-adds creator as admin

  RETURN NEW;
END;
$$;
