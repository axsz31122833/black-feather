-- Fixes and hardening for UUID-based schema/RPC
-- Apply in Supabase SQL Editor after 003/004/005

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Ensure drivers has required columns for RPCs
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS is_online boolean DEFAULT false;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS current_lat double precision;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS current_lng double precision;

-- Optional: index for quick lookup
CREATE INDEX IF NOT EXISTS drivers_is_online_idx ON public.drivers(is_online);

-- Ensure driver_locations supports upsert-by-driver_id if needed
CREATE UNIQUE INDEX IF NOT EXISTS driver_locations_driver_id_unique ON public.driver_locations(driver_id);

-- Harden find_nearest_online_driver to ignore null coords
CREATE OR REPLACE FUNCTION public.find_nearest_online_driver(p_lat double precision, p_lng double precision)
RETURNS TABLE(driver_id uuid, distance_m double precision)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT d.id,
         ST_DistanceSphere(ST_MakePoint(p_lng, p_lat), ST_MakePoint(d.current_lng, d.current_lat)) AS distance_m
  FROM public.drivers d
  WHERE d.is_online = true
    AND d.current_lat IS NOT NULL
    AND d.current_lng IS NOT NULL
  ORDER BY distance_m ASC
  LIMIT 1;
END;
$$;