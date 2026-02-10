ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rides_select_all ON public.rides;
DROP POLICY IF EXISTS rides_insert_anon ON public.rides;
DROP POLICY IF EXISTS rides_select_passenger ON public.rides;
DROP POLICY IF EXISTS rides_update_passenger ON public.rides;
DROP POLICY IF EXISTS rides_select_driver ON public.rides;
DROP POLICY IF EXISTS rides_update_driver ON public.rides;
DROP POLICY IF EXISTS rides_admin_select ON public.rides;
DROP POLICY IF EXISTS rides_admin_update ON public.rides;
DROP POLICY IF EXISTS rides_admin_insert ON public.rides;
DROP POLICY IF EXISTS rides_admin_delete ON public.rides;

CREATE POLICY rides_admin_select ON public.rides
FOR SELECT
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY rides_admin_update ON public.rides
FOR UPDATE
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY rides_admin_insert ON public.rides
FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY rides_admin_delete ON public.rides
FOR DELETE
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY rides_select_passenger ON public.rides
FOR SELECT
USING (passenger_id = auth.uid());

CREATE POLICY rides_update_passenger ON public.rides
FOR UPDATE
USING (passenger_id = auth.uid())
WITH CHECK (passenger_id = auth.uid());

CREATE POLICY rides_select_driver ON public.rides
FOR SELECT
USING (driver_id = auth.uid());

CREATE POLICY rides_update_driver ON public.rides
FOR UPDATE
USING (driver_id = auth.uid())
WITH CHECK (driver_id = auth.uid());
