CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.push_subscriptions
  ADD CONSTRAINT push_subscriptions_user_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS push_subs_user_idx ON public.push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS push_subs_endpoint_idx ON public.push_subscriptions(endpoint);

CREATE POLICY IF NOT EXISTS "push_subs_select_admin_or_self"
ON public.push_subscriptions
FOR SELECT
USING (public.is_admin() OR user_id = auth.uid());

CREATE POLICY IF NOT EXISTS "push_subs_insert_self"
ON public.push_subscriptions
FOR INSERT
WITH CHECK (user_id = auth.uid());

