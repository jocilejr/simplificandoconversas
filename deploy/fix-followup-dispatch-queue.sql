CREATE TABLE IF NOT EXISTS public.followup_dispatch_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  user_id uuid NOT NULL,
  transaction_id uuid NOT NULL,
  rule_id uuid NOT NULL,
  instance_name text NOT NULL,
  phone text,
  normalized_phone text,
  customer_name text,
  amount numeric(10,2) NOT NULL DEFAULT 0,
  barcode text,
  boleto_file text,
  due_date date,
  dispatch_date date NOT NULL,
  message_snapshot text,
  blocks_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  last_error text,
  attempts integer NOT NULL DEFAULT 0,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, transaction_id, rule_id, dispatch_date)
);

ALTER TABLE public.followup_dispatch_queue ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'followup_dispatch_queue'
      AND policyname = 'service_all'
  ) THEN
    CREATE POLICY service_all ON public.followup_dispatch_queue
      FOR ALL TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON public.followup_dispatch_queue TO anon, authenticated, service_role;

CREATE INDEX IF NOT EXISTS idx_followup_dispatch_queue_workspace_status_date
  ON public.followup_dispatch_queue (workspace_id, status, dispatch_date, created_at);

CREATE INDEX IF NOT EXISTS idx_followup_dispatch_queue_instance_status
  ON public.followup_dispatch_queue (instance_name, status, dispatch_date);
