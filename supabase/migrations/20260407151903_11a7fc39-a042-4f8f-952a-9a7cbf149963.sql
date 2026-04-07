
ALTER TABLE public.message_queue_config
  ADD COLUMN pause_after_sends integer DEFAULT NULL,
  ADD COLUMN pause_minutes integer DEFAULT NULL;
