-- Operational fields and audit table
-- Adds assignment tracking columns to rides, heartbeat to drivers, and creates ops_events audit log

ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS assignment_attempts integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_assignment_at timestamptz;

ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

CREATE TABLE IF NOT EXISTS public.ops_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  ref_id uuid,
  message text,
  payload jsonb,
  created_at timestamptz DEFAULT now()
);

-- Basic index for querying recent events
CREATE INDEX IF NOT EXISTS ops_events_created_idx ON public.ops_events(created_at DESC);
