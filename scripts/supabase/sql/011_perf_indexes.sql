-- Performance indexes for common queries

-- ops_events queries by ref_id, event_type, created_at
CREATE INDEX IF NOT EXISTS ops_events_ref_created_idx ON public.ops_events(ref_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ops_events_type_created_idx ON public.ops_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS ops_events_created_idx ON public.ops_events(created_at DESC);

-- trips pending and recent queries
CREATE INDEX IF NOT EXISTS trips_status_created_idx ON public.trips(status, created_at DESC);
CREATE INDEX IF NOT EXISTS trips_driver_created_idx ON public.trips(driver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS trips_passenger_created_idx ON public.trips(passenger_id, created_at DESC);

-- drivers recent online sorting
ALTER TABLE IF EXISTS public.drivers
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;
CREATE INDEX IF NOT EXISTS drivers_last_seen_idx ON public.drivers(last_seen_at DESC);

-- driver_locations spatial index (if not already present)
CREATE INDEX IF NOT EXISTS driver_locations_location_gist ON public.driver_locations USING gist(location);

