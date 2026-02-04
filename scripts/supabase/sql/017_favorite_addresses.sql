CREATE TABLE IF NOT EXISTS public.favorite_addresses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id text,
  label text NOT NULL,
  address text NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.favorite_addresses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fav_select_all ON public.favorite_addresses;
DROP POLICY IF EXISTS fav_insert_all ON public.favorite_addresses;
CREATE POLICY fav_select_all ON public.favorite_addresses FOR SELECT USING (true);
CREATE POLICY fav_insert_all ON public.favorite_addresses FOR INSERT WITH CHECK (true);
