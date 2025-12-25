CREATE TABLE IF NOT EXISTS public.dispatch_settings (
  id text PRIMARY KEY,
  weights jsonb NOT NULL,
  updated_by uuid,
  updated_at timestamptz DEFAULT now()
);

CREATE POLICY IF NOT EXISTS "dispatch_settings_read"
ON public.dispatch_settings
FOR SELECT
USING (true);

CREATE POLICY IF NOT EXISTS "dispatch_settings_write_admin"
ON public.dispatch_settings
FOR INSERT
WITH CHECK (public.is_admin());

CREATE POLICY IF NOT EXISTS "dispatch_settings_update_admin"
ON public.dispatch_settings
FOR UPDATE
USING (public.is_admin())
WITH CHECK (public.is_admin());

