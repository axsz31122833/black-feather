ALTER TABLE public.rides ADD COLUMN IF NOT EXISTS route_history jsonb DEFAULT '[]';
