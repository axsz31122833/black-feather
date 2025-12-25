-- UUID-based RPC functions aligned to tables in 003_uuid_core_tables.sql
-- Apply in Supabase SQL Editor

CREATE EXTENSION IF NOT EXISTS postgis;

-- 1) find_nearest_online_driver
-- Returns the nearest online driver's basic info and distance in km
CREATE OR REPLACE FUNCTION public.find_nearest_online_driver(
  p_pickup_lat double precision,
  p_pickup_lng double precision,
  p_max_distance_km double precision DEFAULT 10
)
RETURNS TABLE (
  driver_id uuid,
  name text,
  car_plate text,
  distance_km double precision
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT d.id::uuid AS driver_id,
         d.name::text,
         d.car_plate::text,
         ST_Distance(
           COALESCE(
             d.current_location,
             ST_SetSRID(ST_MakePoint(d.current_lng, d.current_lat), 4326)::geography,
             ST_SetSRID(ST_MakePoint(d.lng, d.lat), 4326)::geography
           ),
           ST_SetSRID(ST_MakePoint(p_pickup_lng, p_pickup_lat), 4326)::geography
         ) / 1000.0 AS distance_km
  FROM public.drivers d
  WHERE (d.status = 'online' OR d.is_online = true)
    AND COALESCE(
          d.current_location,
          ST_SetSRID(ST_MakePoint(d.current_lng, d.current_lat), 4326)::geography,
          ST_SetSRID(ST_MakePoint(d.lng, d.lat), 4326)::geography
        ) IS NOT NULL
    AND ST_DWithin(
          COALESCE(
            d.current_location,
            ST_SetSRID(ST_MakePoint(d.current_lng, d.current_lat), 4326)::geography,
            ST_SetSRID(ST_MakePoint(d.lng, d.lat), 4326)::geography
          ),
          ST_SetSRID(ST_MakePoint(p_pickup_lng, p_pickup_lat), 4326)::geography,
          p_max_distance_km * 1000.0
        )
  ORDER BY distance_km ASC
  LIMIT 1;
END;
$$;

-- 2) upsert_driver_location
-- Upserts the driver's latest location into public.driver_locations (requires unique index on driver_id)
CREATE OR REPLACE FUNCTION public.upsert_driver_location(
  p_driver uuid,
  p_lat double precision,
  p_lng double precision
)
RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.driver_locations (driver_id, location, created_at)
  VALUES (
    p_driver,
    ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
    now()
  )
  ON CONFLICT (driver_id)
  DO UPDATE SET
    location = EXCLUDED.location,
    created_at = EXCLUDED.created_at;
END;
$$;

-- 3) insert_ride_location
-- Inserts one location point into ride_locations for a given ride
CREATE OR REPLACE FUNCTION public.insert_ride_location(
  p_ride_id uuid,
  p_lat double precision,
  p_lng double precision
)
RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.ride_locations (ride_id, location, created_at)
  VALUES (
    p_ride_id,
    ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
    now()
  );
END;
$$;

-- 4) compute_ride_distance_km
-- Computes distance in km using the ordered points in ride_locations for a given ride
CREATE OR REPLACE FUNCTION public.compute_ride_distance_km(
  p_ride_id uuid
)
RETURNS double precision
LANGUAGE plpgsql AS $$
DECLARE
  geom_line geometry;
  dist_m double precision;
BEGIN
  -- Build a line from ordered points
  SELECT ST_MakeLine(
           ARRAY(
             SELECT (location::geometry)
             FROM public.ride_locations
             WHERE ride_id = p_ride_id
             ORDER BY created_at ASC
           )
         )
  INTO geom_line;

  IF geom_line IS NULL THEN
    RETURN NULL;
  END IF;

  dist_m := ST_Length(geom_line::geography);
  RETURN dist_m / 1000.0;
END;
$$;
