
-- Drop old unique constraint on conversations
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_user_id_remote_jid_key;

-- Add new unique constraint including instance_name
ALTER TABLE conversations ADD CONSTRAINT conversations_user_id_remote_jid_instance_key UNIQUE (user_id, remote_jid, instance_name);

-- Add DELETE policy on messages table
CREATE POLICY "Users can delete own messages" ON messages FOR DELETE USING (auth.uid() = user_id);
