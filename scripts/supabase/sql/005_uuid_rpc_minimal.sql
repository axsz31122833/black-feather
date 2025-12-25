-- Minimal UUID-based RPC functions as requested
-- Apply in Supabase SQL Editor; these definitions will CREATE OR REPLACE existing functions

CREATE EXTENSION IF NOT EXISTS postgis;

-- find_nearest_online_driver：找最近的線上司機
CREATE OR REPLACE FUNCTION public.find_nearest_online_driver(p_lat double precision, p_lng double precision)
RETURNS TABLE(driver_id uuid, distance_m double precision)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT d.id,
         ST_DistanceSphere(ST_MakePoint(p_lng, p_lat), ST_MakePoint(d.current_lng, d.current_lat)) AS distance_m
  FROM public.drivers d
  WHERE d.is_online = true
  ORDER BY distance_m ASC
  LIMIT 1;
END;
$$;

-- upsert_driver_location：更新司機位置（此版本為單純 INSERT，不進行 UPSERT）
CREATE OR REPLACE FUNCTION public.upsert_driver_location(p_driver_id uuid, p_lat double precision, p_lng double precision)
RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.driver_locations(driver_id, location)
  VALUES (p_driver_id, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography);
END;
$$;

-- insert_ride_location：新增行程軌跡點
CREATE OR REPLACE FUNCTION public.insert_ride_location(p_ride_id uuid, p_lat double precision, p_lng double precision)
RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.ride_locations(ride_id, location)
  VALUES (p_ride_id, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography);
END;
$$;

-- compute_ride_distance_km：計算行程距離（以球面距離，回傳公里）
CREATE OR REPLACE FUNCTION public.compute_ride_distance_km(p_ride_id uuid)
RETURNS double precision
LANGUAGE plpgsql AS $$
DECLARE
  total_m double precision;
BEGIN
  SELECT SUM(
    ST_DistanceSphere(
      ST_PointN(geom, gidx),
      ST_PointN(geom, gidx+1)
    )
  )
  INTO total_m
  FROM (
    SELECT ride_id,
           ST_MakeLine(location::geometry ORDER BY created_at) AS geom,
           generate_series(1, ST_NPoints(ST_MakeLine(location::geometry ORDER BY created_at))-1) AS gidx
    FROM public.ride_locations
    WHERE ride_id = p_ride_id
    GROUP BY ride_id
  ) AS sub;

  RETURN COALESCE(total_m / 1000, 0);
END;
$$;