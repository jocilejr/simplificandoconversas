ALTER TABLE member_offer_impressions 
  ADD COLUMN IF NOT EXISTS payment_started boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_method text;