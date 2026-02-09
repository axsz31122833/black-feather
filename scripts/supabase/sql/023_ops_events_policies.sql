ALTER TABLE public.ops_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ops_events_insert_all ON public.ops_events;
DROP POLICY IF EXISTS ops_events_select_admin ON public.ops_events;

-- Allow INSERT for both authenticated and anonymous clients, but only for whitelisted event types
CREATE POLICY ops_events_insert_all ON public.ops_events
FOR INSERT
WITH CHECK (event_type IN ('backend_perf','backend_error','cancel_fallback_error','user_geo'));

-- Only admins can SELECT ops_events
CREATE POLICY ops_events_select_admin ON public.ops_events
FOR SELECT
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
