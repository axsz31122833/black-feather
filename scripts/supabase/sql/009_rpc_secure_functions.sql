-- Secure RPCs for sensitive updates (payments confirmation, rating submission)
-- Uses SECURITY DEFINER and explicit role checks via public.users to validate actor

SET search_path = public;

CREATE OR REPLACE FUNCTION public.secure_confirm_payment(p_trip_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  actor uuid := auth.uid();
  is_admin boolean := false;
  trip_rec RECORD;
  payment_rec RECORD;
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  SELECT (u.user_type = 'admin') INTO is_admin
  FROM public.users u
  WHERE u.id = actor;

  SELECT id, driver_id, passenger_id INTO trip_rec
  FROM public.trips
  WHERE id = p_trip_id;

  IF trip_rec.id IS NULL THEN
    RAISE EXCEPTION 'trip_not_found';
  END IF;

  -- Allow driver of the trip or admin to confirm payment
  IF NOT (is_admin OR actor = trip_rec.driver_id) THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  -- Update latest payment to completed or insert one if missing
  SELECT id, status INTO payment_rec
  FROM public.payments
  WHERE trip_id = p_trip_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF payment_rec.id IS NOT NULL THEN
    UPDATE public.payments
    SET status = 'completed', processed_at = now()
    WHERE id = payment_rec.id;
  ELSE
    INSERT INTO public.payments (trip_id, amount, currency, payment_method, status, processed_at)
    VALUES (p_trip_id, 0, 'TWD', 'cash', 'completed', now());
  END IF;

  RETURN jsonb_build_object('ok', true, 'trip_id', p_trip_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.secure_submit_rating(p_trip_id uuid, p_score integer, p_notes text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  actor uuid := auth.uid();
  trip_rec RECORD;
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  SELECT id, passenger_id INTO trip_rec
  FROM public.trips
  WHERE id = p_trip_id;

  IF trip_rec.id IS NULL THEN
    RAISE EXCEPTION 'trip_not_found';
  END IF;

  -- Only passenger of the trip can rate
  IF actor <> trip_rec.passenger_id THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  -- Clamp score between 1 and 5
  IF p_score < 1 THEN
    p_score := 1;
  ELSIF p_score > 5 THEN
    p_score := 5;
  END IF;

  UPDATE public.trips
  SET rating = p_score
  WHERE id = p_trip_id;

  INSERT INTO public.ops_events (event_type, ref_id, message, payload)
  VALUES ('rating', p_trip_id, 'Passenger rating submitted', jsonb_build_object('score', p_score, 'notes', COALESCE(p_notes, '')));

  RETURN jsonb_build_object('ok', true, 'trip_id', p_trip_id, 'rating', p_score);
END;
$$;

