-- Enable pg_cron for scheduled tasks
CREATE EXTENSION IF NOT EXISTS pg_cron;
SET search_path = public;

-- Secure function: list available rides for drivers, excluding pre-dispatch and only searching
CREATE OR REPLACE FUNCTION public.secure_list_available_rides()
RETURNS TABLE(id uuid, pickup_text text, dropoff_text text, distance_km numeric, scheduled_time timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  actor uuid := auth.uid();
  role text := NULL;
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;
  SELECT p.role INTO role FROM public.profiles p WHERE p.id = actor;
  IF role IS NULL THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;
  IF role <> 'driver' AND role <> 'admin' THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;
  RETURN QUERY
    SELECT r.id, r.pickup_text, r.dropoff_text, r.distance_km, r.scheduled_time
    FROM public.rides r
    WHERE COALESCE(r.pre_dispatch, false) = false
      AND r.status = 'searching'
      AND (r.driver_id IS NULL);
END;
$$;

-- Maintenance function: release expired pre-dispatch and rescue near-time reservations
CREATE OR REPLACE FUNCTION public.perform_dispatch_maintenance()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Task A: release expired pre-dispatch
  UPDATE public.rides
  SET pre_dispatch = false
  WHERE COALESCE(pre_dispatch, false) = true
    AND pre_dispatch_expires_at IS NOT NULL
    AND now() > pre_dispatch_expires_at;

  -- Task B: rescue reservations into searching within 15 minutes window
  UPDATE public.rides
  SET status = 'searching'
  WHERE COALESCE(is_reservation, false) = true
    AND driver_id IS NULL
    AND scheduled_time IS NOT NULL
    AND scheduled_time - now() <= interval '15 minutes';
END;
$$;

-- Schedule every minute
SELECT cron.schedule('bf_dispatch_maintenance', '* * * * *', $$CALL public.perform_dispatch_maintenance();$$);
