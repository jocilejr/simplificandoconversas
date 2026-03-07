
-- Drop tables with foreign key dependencies first
DROP TABLE IF EXISTS chatbot_flow_history CASCADE;
DROP TABLE IF EXISTS flow_timeouts CASCADE;
DROP TABLE IF EXISTS flow_executions CASCADE;
DROP TABLE IF EXISTS conversation_labels CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS tracked_links CASCADE;
DROP TABLE IF EXISTS contact_tags CASCADE;
DROP TABLE IF EXISTS contact_photos CASCADE;
DROP TABLE IF EXISTS quick_replies CASCADE;
DROP TABLE IF EXISTS labels CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS chatbot_flows CASCADE;
DROP TABLE IF EXISTS evolution_instances CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- Drop DB functions
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS public.increment_unread(uuid) CASCADE;
