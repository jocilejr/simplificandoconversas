-- Delete messages for outbound-only conversations
DELETE FROM messages WHERE conversation_id IN (
  SELECT c.id FROM conversations c
  WHERE c.instance_name = 'Meire Rosana - Entregas'
  AND c.id NOT IN (
    SELECT DISTINCT conversation_id FROM messages WHERE direction = 'inbound'
  )
);

-- Delete the ghost conversations themselves
DELETE FROM conversations WHERE instance_name = 'Meire Rosana - Entregas'
AND id NOT IN (
  SELECT DISTINCT conversation_id FROM messages WHERE direction = 'inbound'
);