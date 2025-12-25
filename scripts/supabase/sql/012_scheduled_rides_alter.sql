ALTER TABLE IF EXISTS public.scheduled_rides
  ADD COLUMN IF NOT EXISTS driver_id uuid;

CREATE INDEX IF NOT EXISTS scheduled_rides_time_idx ON public.scheduled_rides(scheduled_time);
CREATE INDEX IF NOT EXISTS scheduled_rides_driver_idx ON public.scheduled_rides(driver_id);

