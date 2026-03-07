
-- Rename evolution_instances to whatsapp_instances
ALTER TABLE public.evolution_instances RENAME TO whatsapp_instances;

-- Drop legacy evolution columns from profiles
ALTER TABLE public.profiles DROP COLUMN IF EXISTS evolution_api_url;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS evolution_api_key;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS evolution_instance_name;
