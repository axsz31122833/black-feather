-- Supabase RPC functions required by Edge Functions
-- Apply in Supabase SQL Editor (Project > SQL). Safe to re-run.

CREATE EXTENSION IF NOT EXISTS postgis;

-- 1) find_nearest_online_driver: 以地理距離尋找最近在線司機
-- 參數：p_lat, p_lng（乘客座標）
-- 回傳：driver_id, name, car_plate, distance_km
CREATE OR REPLACE FUNCTION public.find_nearest_online_driver(p_lat double precision, p_lng double precision)
RETURNS TABLE (driver_id integer, name text, car_plate text, distance_km double precision)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT d.id AS driver_id,
         d.name,
         d.car_plate,
         ST_DistanceSphere(
           ST_MakePoint(COALESCE(d.current_lng, d.lng), COALESCE(d.current_lat, d.lat)),
           ST_MakePoint(p_lng, p_lat)
         ) / 1000.0 AS distance_km
  FROM public.drivers d
  WHERE d.status = 'online'
    AND COALESCE(d.current_lat, d.lat) IS NOT NULL
    AND COALESCE(d.current_lng, d.lng) IS NOT NULL
  ORDER BY distance_km ASC
  LIMIT 1;
END;
$$;

-- 2) upsert_driver_location: 更新或插入司機目前定位（driver_locations）
-- 若要保留最新一筆，表設計為 driver_id PRIMARY KEY，on conflict 更新位置與時間
CREATE OR REPLACE FUNCTION public.upsert_driver_location(p_driver integer, p_lat double precision, p_lng double precision)
RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.driver_locations (driver_id, location, updated_at)
  VALUES (p_driver, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography, now())
  ON CONFLICT (driver_id)
  DO UPDATE SET location = EXCLUDED.location, updated_at = now();

  -- 可選：同步 drivers 表的座標（若需要）
  UPDATE public.drivers
  SET current_lat = p_lat,
      current_lng = p_lng
  WHERE id = p_driver;
END;
$$;

-- 3) insert_ride_location: 將定位紀錄到行程軌跡（ride_locations）
CREATE OR REPLACE FUNCTION public.insert_ride_location(p_ride integer, p_lat double precision, p_lng double precision)
RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.ride_locations (ride_id, location, created_at)
  VALUES (p_ride, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography, now());
END;
$$;

-- 4) compute_ride_distance_km: 計算行程總距離（依 ride_locations 建立 LineString）
CREATE OR REPLACE FUNCTION public.compute_ride_distance_km(p_ride integer)
RETURNS double precision
LANGUAGE plpgsql AS $$
DECLARE
  dist_m double precision := 0;
BEGIN
  -- 將點串成 LineString（依 created_at 排序），並計算長度（公尺）
  WITH points AS (
    SELECT ST_AsText(ST_Transform(location::geometry, 4326)) AS wkt,
           created_at
    FROM public.ride_locations
    WHERE ride_id = p_ride
    ORDER BY created_at ASC
  ),
  geom AS (
    SELECT ST_Collect(ARRAY(SELECT ST_GeomFromText(wkt, 4326) FROM points)) AS g
  )
  SELECT COALESCE(ST_Length(ST_Transform(ST_MakeLine((SELECT ARRAY(SELECT ST_GeomFromText(wkt, 4326) FROM points))), 3857)), 0)
  INTO dist_m;

  RETURN dist_m / 1000.0; -- 公里
END;
$$;