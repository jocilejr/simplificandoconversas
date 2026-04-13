
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS document text;

UPDATE conversations c
SET
  email = COALESCE(c.email, sub.customer_email),
  document = sub.customer_document
FROM (
  SELECT DISTINCT ON (t.customer_phone)
    t.customer_phone, t.customer_email, t.customer_document
  FROM transactions t
  WHERE t.customer_document IS NOT NULL
  ORDER BY t.customer_phone, t.created_at DESC
) sub
WHERE c.document IS NULL
  AND replace(c.remote_jid, '@s.whatsapp.net', '') LIKE '%' || right(replace(sub.customer_phone, '+', ''), 8);
