
CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  external_id text,
  source text NOT NULL DEFAULT 'manual',
  type text NOT NULL DEFAULT 'pix',
  status text NOT NULL DEFAULT 'pendente',
  amount numeric(12,2) NOT NULL DEFAULT 0,
  description text,
  customer_name text,
  customer_email text,
  customer_phone text,
  customer_document text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  paid_at timestamp with time zone,
  metadata jsonb
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own transactions"
  ON public.transactions
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_transactions_user_created ON public.transactions (user_id, created_at DESC);
CREATE INDEX idx_transactions_external ON public.transactions (source, external_id);
