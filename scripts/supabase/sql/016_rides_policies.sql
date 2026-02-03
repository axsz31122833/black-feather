-- TEMP policy to allow anon inserts for testing flow
ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rides_select_all ON public.rides;
DROP POLICY IF EXISTS rides_insert_anon ON public.rides;
CREATE POLICY rides_select_all ON public.rides FOR SELECT USING (true);
CREATE POLICY rides_insert_anon ON public.rides FOR INSERT WITH CHECK (true);
