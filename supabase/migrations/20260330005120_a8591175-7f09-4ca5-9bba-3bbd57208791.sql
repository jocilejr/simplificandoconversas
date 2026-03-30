
CREATE TABLE public.platform_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  platform text NOT NULL,
  credentials jsonb NOT NULL DEFAULT '{}',
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, platform)
);

ALTER TABLE public.platform_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own platform connections"
  ON public.platform_connections
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER update_platform_connections_updated_at
  BEFORE UPDATE ON public.platform_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
