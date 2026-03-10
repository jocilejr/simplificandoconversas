ALTER TABLE conversations ADD COLUMN phone_number text;

UPDATE conversations 
SET phone_number = split_part(remote_jid, '@', 1)
WHERE remote_jid LIKE '%@s.whatsapp.net';