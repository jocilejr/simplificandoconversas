DELETE FROM profiles
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY updated_at DESC) as rn
    FROM profiles
  ) t WHERE rn > 1
);

ALTER TABLE profiles ADD CONSTRAINT profiles_user_id_unique UNIQUE (user_id);