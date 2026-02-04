-- Allow anon to insert error/perf logs into ops_events for observability
ALTER TABLE public.ops_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ops_events_select_all ON public.ops_events;
DROP POLICY IF EXISTS ops_events_insert_anon ON public.ops_events;
CREATE POLICY ops_events_select_all ON public.ops_events FOR SELECT USING (true);
CREATE POLICY ops_events_insert_anon ON public.ops_events FOR INSERT WITH CHECK (true);
