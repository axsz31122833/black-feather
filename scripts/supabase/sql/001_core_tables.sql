-- Supabase core tables for Black Feather Taxi
-- Apply this file in Supabase SQL Editor (Project > SQL) or include in your migrations.
-- Safe to re-run: uses IF EXISTS/IF NOT EXISTS patterns.

-- 0) Enable PostGIS (if available)
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto; -- for gen_random_uuid()

-- 1) scheduled_rides: 預約叫車單
CREATE TABLE IF NOT EXISTS public.scheduled_rides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  passenger_id integer NOT NULL,
  scheduled_time timestamptz NOT NULL,
  pickup_lat double precision,
  pickup_lng double precision,
  dropoff_lat double precision,
  dropoff_lng double precision,
  status text NOT NULL DEFAULT 'scheduled',
  processed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS scheduled_rides_time_idx ON public.scheduled_rides(scheduled_time);
CREATE INDEX IF NOT EXISTS scheduled_rides_status_idx ON public.scheduled_rides(status);

-- 2) driver_locations: 司機即時定位（最新一筆，或歷史記錄視設計）
-- 此表設計為「每司機一列」，搭配 upsert（on conflict）維護最新定位
CREATE TABLE IF NOT EXISTS public.driver_locations (
  driver_id integer PRIMARY KEY,
  location geography(Point, 4326),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS driver_locations_location_gist ON public.driver_locations USING GIST(location);

-- 3) ride_locations: 行程軌跡（多筆記錄）
CREATE TABLE IF NOT EXISTS public.ride_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id integer NOT NULL,
  location geography(Point, 4326) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ride_locations_ride_id_idx ON public.ride_locations(ride_id);
CREATE INDEX IF NOT EXISTS ride_locations_location_gist ON public.ride_locations USING GIST(location);

-- 4) pricing_rules: 計價規則
CREATE TABLE IF NOT EXISTS public.pricing_rules (
  id serial PRIMARY KEY,
  base_fare_cents integer NOT NULL DEFAULT 1000,
  per_km_cents integer NOT NULL DEFAULT 200,
  per_minute_cents integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5) penalties: 取消／違規等罰則記錄
CREATE TABLE IF NOT EXISTS public.penalties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id integer,
  passenger_id integer,
  driver_id integer,
  type text,
  amount_cents integer NOT NULL DEFAULT 0,
  reason text,
  applied boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 6) rides 欄位補齊（與 Edge Functions 對齊）
-- 注意：若 rides 表不存在，請先建立；此處僅補欄位
ALTER TABLE IF EXISTS public.rides
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS final_price_cents integer,
  ADD COLUMN IF NOT EXISTS distance_km double precision,
  ADD COLUMN IF NOT EXISTS duration_minutes integer;

-- 7) drivers 欄位對齊：添加 current_lat/current_lng 以支援部分 Functions 程式碼
ALTER TABLE IF EXISTS public.drivers
  ADD COLUMN IF NOT EXISTS current_lat double precision,
  ADD COLUMN IF NOT EXISTS current_lng double precision;

-- （可選）同步索引建議
CREATE INDEX IF NOT EXISTS drivers_status_idx ON public.drivers(status);
CREATE INDEX IF NOT EXISTS drivers_coords_idx ON public.drivers((COALESCE(current_lng, lng)), (COALESCE(current_lat, lat)));