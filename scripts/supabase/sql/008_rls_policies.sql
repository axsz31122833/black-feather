-- Helper: is_admin() based on users table
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.user_type = 'admin'
  );
$$;

-- Enable RLS
ALTER TABLE IF EXISTS public.driver_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.trips ENABLE ROW LEVEL SECURITY;

-- Trips policies (additional admin controls)
CREATE POLICY IF NOT EXISTS "管理員查看所有行程"
ON public.trips
FOR SELECT
USING (public.is_admin());

CREATE POLICY IF NOT EXISTS "管理員更新所有行程"
ON public.trips
FOR UPDATE
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY IF NOT EXISTS "管理員刪除所有行程"
ON public.trips
FOR DELETE
USING (public.is_admin());

-- Driver profiles policies
CREATE POLICY IF NOT EXISTS "司機查看自己的檔案"
ON public.driver_profiles
FOR SELECT
USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY IF NOT EXISTS "司機建立自己的檔案"
ON public.driver_profiles
FOR INSERT
WITH CHECK (user_id = auth.uid() OR public.is_admin());

CREATE POLICY IF NOT EXISTS "司機更新自己的檔案"
ON public.driver_profiles
FOR UPDATE
USING (user_id = auth.uid() OR public.is_admin())
WITH CHECK (user_id = auth.uid() OR public.is_admin());

-- Payments policies
CREATE POLICY IF NOT EXISTS "乘客/司機/管理員查看付款"
ON public.payments
FOR SELECT
USING (
  public.is_admin() OR EXISTS (
    SELECT 1 FROM public.trips t
    WHERE t.id = payments.trip_id
      AND (t.passenger_id = auth.uid() OR t.driver_id = auth.uid())
  )
);

CREATE POLICY IF NOT EXISTS "乘客建立自己的付款或管理員建立"
ON public.payments
FOR INSERT
WITH CHECK (
  public.is_admin() OR EXISTS (
    SELECT 1 FROM public.trips t
    WHERE t.id = payments.trip_id
      AND t.passenger_id = auth.uid()
  )
);

CREATE POLICY IF NOT EXISTS "管理員更新付款"
ON public.payments
FOR UPDATE
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY IF NOT EXISTS "管理員刪除付款"
ON public.payments
FOR DELETE
USING (public.is_admin());

