-- RLS policies for ops_events to restrict writes by role and context

ALTER TABLE IF EXISTS public.ops_events ENABLE ROW LEVEL SECURITY;

-- Allow admin to select all ops_events; participants can select events tied to their trip or user
CREATE POLICY IF NOT EXISTS "ops_events_select_admin_or_participant"
ON public.ops_events
FOR SELECT
USING (
  public.is_admin()
  OR EXISTS (SELECT 1 FROM public.trips t WHERE t.id = ops_events.ref_id AND (t.passenger_id = auth.uid() OR t.driver_id = auth.uid()))
  OR ops_events.ref_id = auth.uid()
);

-- Restrict inserts based on event_type and context
CREATE POLICY IF NOT EXISTS "ops_events_insert_restricted_by_role"
ON public.ops_events
FOR INSERT
WITH CHECK (
  -- chat: driver or passenger of the trip
  (event_type = 'chat' AND EXISTS (SELECT 1 FROM public.trips t WHERE t.id = ops_events.ref_id AND (t.passenger_id = auth.uid() OR t.driver_id = auth.uid())))
  OR
  -- driver location/arrived/payment_confirmed: driver of the trip
  (event_type IN ('driver_location','driver_arrived','payment_confirmed') AND EXISTS (SELECT 1 FROM public.trips t WHERE t.id = ops_events.ref_id AND t.driver_id = auth.uid()))
  OR
  -- passenger picked up: passenger of the trip
  (event_type = 'passenger_picked_up' AND EXISTS (SELECT 1 FROM public.trips t WHERE t.id = ops_events.ref_id AND t.passenger_id = auth.uid()))
  OR
  -- fuel log: driver user-level event
  (event_type = 'fuel_log' AND ops_events.ref_id = auth.uid())
  OR
  -- dispatch settings and auto reassign/candidate pool: admin only
  (event_type IN ('dispatch_settings_update','auto_reassign','candidate_pool','assign_driver','scheduled_dispatch','scheduled_cancel','scheduled_accept') AND public.is_admin())
  OR
  -- scheduled accept: driver can accept if scheduled_rides has no driver or matches auth
  (event_type = 'scheduled_accept' AND EXISTS (SELECT 1 FROM public.scheduled_rides s WHERE s.id = ops_events.ref_id AND (s.driver_id IS NULL OR s.driver_id = auth.uid())))
);

-- Only admin can update ops_events
CREATE POLICY IF NOT EXISTS "ops_events_update_admin_only"
ON public.ops_events
FOR UPDATE
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Only admin can delete ops_events
CREATE POLICY IF NOT EXISTS "ops_events_delete_admin_only"
ON public.ops_events
FOR DELETE
USING (public.is_admin());
