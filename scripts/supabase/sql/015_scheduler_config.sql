CREATE TABLE IF NOT EXISTS public.scheduler_config (
  id text PRIMARY KEY,
  minutes_before integer NOT NULL DEFAULT 15,
  updated_at timestamptz DEFAULT now()
);

INSERT INTO public.scheduler_config (id, minutes_before) 
  VALUES ('global', 15)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY IF NOT EXISTS "scheduler_config_read"
ON public.scheduler_config
FOR SELECT
USING (true);

CREATE POLICY IF NOT EXISTS "scheduler_config_write_admin"
ON public.scheduler_config
FOR UPDATE
USING (public.is_admin())
WITH CHECK (public.is_admin());

