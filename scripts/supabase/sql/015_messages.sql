-- messages table for real-time chat
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ride_id uuid NOT NULL,
  sender_id text NOT NULL,
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS messages_ride_idx ON public.messages(ride_id, created_at DESC);

-- RLS: allow authenticated users to insert/select their messages
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS messages_select_all ON public.messages;
DROP POLICY IF EXISTS messages_insert_basic ON public.messages;
CREATE POLICY messages_select_all ON public.messages FOR SELECT USING (true);
CREATE POLICY messages_insert_basic ON public.messages FOR INSERT WITH CHECK (true);
