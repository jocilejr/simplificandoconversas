-- Fix: add UNIQUE constraint required by upsert ON CONFLICT (product_id, phone)
ALTER TABLE public.member_products
  ADD CONSTRAINT member_products_product_id_phone_key UNIQUE (product_id, phone);
