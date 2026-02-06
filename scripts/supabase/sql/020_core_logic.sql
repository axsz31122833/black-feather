-- Rides core columns
ALTER TABLE public.rides ADD COLUMN IF NOT EXISTS distance_km numeric;
ALTER TABLE public.rides ADD COLUMN IF NOT EXISTS duration_min integer;
ALTER TABLE public.rides ADD COLUMN IF NOT EXISTS fare_final integer;
ALTER TABLE public.rides ADD COLUMN IF NOT EXISTS cancel_fee integer DEFAULT 100;
ALTER TABLE public.rides ADD COLUMN IF NOT EXISTS sop_status text DEFAULT 'searching';
ALTER TABLE public.rides ADD COLUMN IF NOT EXISTS arrived_at timestamptz;
ALTER TABLE public.rides ADD COLUMN IF NOT EXISTS started_at timestamptz;
ALTER TABLE public.rides ADD COLUMN IF NOT EXISTS ended_at timestamptz;
ALTER TABLE public.rides ADD COLUMN IF NOT EXISTS settlement_required boolean DEFAULT false;
ALTER TABLE public.rides ADD COLUMN IF NOT EXISTS settlement_done boolean DEFAULT false;
ALTER TABLE public.rides ADD COLUMN IF NOT EXISTS settlement_amount integer;
ALTER TABLE public.rides ADD COLUMN IF NOT EXISTS rebate_amount integer;
ALTER TABLE public.rides ADD COLUMN IF NOT EXISTS pickup_text text;
ALTER TABLE public.rides ADD COLUMN IF NOT EXISTS dropoff_text text;
ALTER TABLE public.rides ADD COLUMN IF NOT EXISTS driver_name text;
ALTER TABLE public.rides ADD COLUMN IF NOT EXISTS is_reservation boolean DEFAULT false;
ALTER TABLE public.rides ADD COLUMN IF NOT EXISTS scheduled_time timestamptz;
ALTER TABLE public.rides ADD COLUMN IF NOT EXISTS pre_dispatch boolean DEFAULT false;
ALTER TABLE public.rides ADD COLUMN IF NOT EXISTS pre_dispatch_expires_at timestamptz;

-- Drivers live table (if not exists)
CREATE TABLE IF NOT EXISTS public.drivers (
  user_id uuid PRIMARY KEY,
  lat numeric,
  lng numeric,
  status text,
  last_seen timestamptz
);
