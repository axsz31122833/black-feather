-- UUID-based core tables per user's specification
-- Apply in Supabase SQL Editor

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.passengers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  phone text NOT NULL,
  name text,
  is_admin boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS passengers_phone_unique ON public.passengers(phone);

CREATE TABLE IF NOT EXISTS public.drivers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  phone text NOT NULL,
  name text,
  is_online boolean DEFAULT false,
  current_lat double precision,
  current_lng double precision,
  status text,
  car_plate text,
  created_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS drivers_phone_unique ON public.drivers(phone);

CREATE TABLE IF NOT EXISTS public.rides (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  passenger_id uuid,
  driver_id uuid,
  pickup_lat double precision,
  pickup_lng double precision,
  dropoff_lat double precision,
  dropoff_lng double precision,
  status text,
  estimated_distance_km double precision,
  estimated_time_min double precision,
  estimated_price_cents integer,
  actual_distance_km double precision,
  price_cents integer,
  started_at timestamptz,
  finished_at timestamptz,
  final_price_cents integer,
  distance_km double precision,
  duration_minutes double precision,
  created_at timestamptz DEFAULT now()
);

-- driver_locations
CREATE TABLE IF NOT EXISTS public.driver_locations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id uuid NOT NULL,
  location geography(Point, 4326),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS driver_locations_location_idx ON public.driver_locations USING gist(location);
-- Ensure upsert by driver_id is possible
CREATE UNIQUE INDEX IF NOT EXISTS driver_locations_driver_id_unique ON public.driver_locations(driver_id);

-- scheduled_rides
CREATE TABLE IF NOT EXISTS public.scheduled_rides (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  passenger_id uuid NOT NULL,
  scheduled_time timestamptz NOT NULL,
  pickup_lat double precision,
  pickup_lng double precision,
  dropoff_lat double precision,
  dropoff_lng double precision,
  status text DEFAULT 'scheduled',
  processed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS scheduled_rides_scheduled_time_idx ON public.scheduled_rides(scheduled_time);

-- pricing_rules
CREATE TABLE IF NOT EXISTS public.pricing_rules (
  id serial PRIMARY KEY,
  base_fare_cents integer NOT NULL DEFAULT 1000,
  per_km_cents integer NOT NULL DEFAULT 200,
  per_minute_cents integer NOT NULL DEFAULT 0,
  active boolean DEFAULT true
);

-- penalties
CREATE TABLE IF NOT EXISTS public.penalties (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ride_id uuid,
  passenger_id uuid,
  driver_id uuid,
  type text,
  amount_cents integer DEFAULT 0,
  reason text,
  applied boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- ride_locations (optional)
CREATE TABLE IF NOT EXISTS public.ride_locations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ride_id uuid NOT NULL,
  location geography(Point, 4326),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ride_locations_location_idx ON public.ride_locations USING gist(location);

-- rides 欄位補齊
ALTER TABLE public.rides ADD COLUMN IF NOT EXISTS started_at timestamptz;
ALTER TABLE public.rides ADD COLUMN IF NOT EXISTS final_price_cents integer;
ALTER TABLE public.rides ADD COLUMN IF NOT EXISTS distance_km double precision;
ALTER TABLE public.rides ADD COLUMN IF NOT EXISTS duration_minutes double precision;
