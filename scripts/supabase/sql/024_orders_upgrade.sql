-- Create orders table if not exists and upgrade columns
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  passenger_id uuid not null,
  driver_id uuid,
  status text not null default 'requested',
  pickup_address text,
  dropoff_address text,
  pickup_location jsonb,
  dropoff_location jsonb,
  distance_km numeric,
  duration_min integer,
  price numeric,
  created_at timestamptz default now()
);
alter table public.orders
  add column if not exists is_prebook boolean default false,
  add column if not exists is_manual_assign boolean default false,
  add column if not exists is_direct_price boolean default false,
  add column if not exists pricing_detail jsonb;

comment on column public.orders.pricing_detail is 'Stores fare breakdown and formula inputs';

-- Enable realtime
alter publication supabase_realtime add table public.orders;
