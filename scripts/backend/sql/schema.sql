-- Enable PostGIS if available (skip gracefully if extension is not installed)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'postgis') THEN
    CREATE EXTENSION IF NOT EXISTS postgis;
  ELSE
    RAISE NOTICE 'PostGIS extension not available on this server; skipping.';
  END IF;
END$$;

-- Riders
CREATE TABLE IF NOT EXISTS riders (
  id SERIAL PRIMARY KEY,
  name TEXT,
  phone TEXT UNIQUE,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION
);

-- Drivers
CREATE TABLE IF NOT EXISTS drivers (
  id SERIAL PRIMARY KEY,
  name TEXT,
  phone TEXT UNIQUE,
  status TEXT DEFAULT 'idle',
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  invite_code TEXT
);

-- Rides
CREATE TABLE IF NOT EXISTS rides (
  id SERIAL PRIMARY KEY,
  rider_id INTEGER REFERENCES riders(id),
  driver_id INTEGER REFERENCES drivers(id),
  status TEXT DEFAULT 'dispatched',
  start_lat DOUBLE PRECISION,
  start_lng DOUBLE PRECISION,
  end_lat DOUBLE PRECISION,
  end_lng DOUBLE PRECISION,
  created_at TIMESTAMP DEFAULT NOW(),
  driver_arrived_at TIMESTAMP NULL
);

-- Index recommendations
CREATE INDEX IF NOT EXISTS idx_drivers_status ON drivers(status);
CREATE INDEX IF NOT EXISTS idx_drivers_coords ON drivers(lng, lat);
CREATE INDEX IF NOT EXISTS idx_riders_coords ON riders(lng, lat);