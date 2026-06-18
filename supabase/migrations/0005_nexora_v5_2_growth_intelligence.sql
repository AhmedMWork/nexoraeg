-- ============================================================
-- NEXORA V5.2 — Growth Intelligence, Attribution, Leads, Campaigns
-- Safe/idempotent migration after V5.1.
-- ============================================================

do $$ begin create extension if not exists pgcrypto; exception when others then raise notice 'pgcrypto unavailable: %', sqlerrm; end $$;

alter table if exists public.orders add column if not exists visitor_id text;
alter table if exists public.orders add column if not exists session_id text;
alter table if exists public.orders add column if not exists attribution jsonb default '{}'::jsonb;
alter table if exists public.orders add column if not exists source_platform text;
alter table if exists public.orders add column if not exists campaign text;

alter table if exists public.analytics_events add column if not exists visitor_id text;
alter table if exists public.analytics_events add column if not exists source text;
alter table if exists public.analytics_events add column if not exists medium text;
alter table if exists public.analytics_events add column if not exists campaign text;
alter table if exists public.analytics_events add column if not exists content text;
alter table if exists public.analytics_events add column if not exists page_url text;
alter table if exists public.analytics_events add column if not exists metadata jsonb default '{}'::jsonb;

create table if not exists public.visitor_profiles (
  id uuid primary key default public.nexora_uuid_v5_5_5(),
  anonymous_id text unique not null,
  first_seen_at timestamptz default now(),
  last_seen_at timestamptz default now(),
  first_source text,
  first_medium text,
  first_campaign text,
  first_landing_page text,
  last_source text,
  last_medium text,
  last_campaign text,
  last_page text,
  device_type text,
  browser text,
  os text,
  country text,
  city text,
  is_known boolean default false,
  lead_id uuid,
  customer_id uuid,
  event_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.visitor_events (
  id uuid primary key default public.nexora_uuid_v5_5_5(),
  visitor_id uuid references public.visitor_profiles(id) on delete set null,
  anonymous_id text,
  session_id text,
  event_name text not null,
  page_url text,
  product_id uuid,
  cart_value numeric default 0,
  source text,
  medium text,
  campaign text,
  content text,
  term text,
  fbclid text,
  fbc text,
  fbp text,
  gclid text,
  ttclid text,
  referrer text,
  device_type text,
  browser text,
  os text,
  language text,
  screen_size text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.lead_profiles (
  id uuid primary key default public.nexora_uuid_v5_5_5(),
  visitor_id uuid references public.visitor_profiles(id) on delete set null,
  anonymous_id text,
  session_id text,
  name text,
  phone text,
  email text,
  source text,
  medium text,
  campaign text,
  content text,
  interest_product_id uuid,
  interest_product_name text,
  status text default 'new' check (status in ('new','contacted','interested','ordered','no_response','not_interested','checkout_abandoned')),
  notes text,
  metadata jsonb default '{}'::jsonb,
  last_contacted_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.lead_notes (
  id uuid primary key default public.nexora_uuid_v5_5_5(),
  lead_id uuid references public.lead_profiles(id) on delete cascade,
  note text not null,
  status text,
  created_by text default 'studio',
  created_at timestamptz default now()
);

create table if not exists public.campaign_links (
  id uuid primary key default public.nexora_uuid_v5_5_5(),
  name text not null,
  platform text,
  source text not null,
  medium text not null,
  campaign text not null,
  content text,
  landing_page text not null default '/',
  final_url text not null,
  created_at timestamptz default now()
);

create table if not exists public.whatsapp_clicks (
  id uuid primary key default public.nexora_uuid_v5_5_5(),
  visitor_id uuid references public.visitor_profiles(id) on delete set null,
  anonymous_id text,
  session_id text,
  phone text,
  page_url text,
  product_id uuid,
  product_name text,
  cart_value numeric default 0,
  source text,
  medium text,
  campaign text,
  message text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.notify_me_requests (
  id uuid primary key default public.nexora_uuid_v5_5_5(),
  visitor_id uuid references public.visitor_profiles(id) on delete set null,
  anonymous_id text,
  product_id uuid,
  product_name text,
  size text,
  color text,
  phone text,
  email text,
  source text,
  campaign text,
  status text default 'new',
  created_at timestamptz default now()
);

create index if not exists idx_visitor_profiles_anonymous on public.visitor_profiles(anonymous_id);
create index if not exists idx_visitor_profiles_last_seen on public.visitor_profiles(last_seen_at desc);
create index if not exists idx_visitor_events_created on public.visitor_events(created_at desc);
create index if not exists idx_visitor_events_visitor on public.visitor_events(visitor_id, created_at desc);
create index if not exists idx_visitor_events_source_campaign on public.visitor_events(source, campaign, created_at desc);
create index if not exists idx_lead_profiles_created on public.lead_profiles(created_at desc);
create index if not exists idx_lead_profiles_phone on public.lead_profiles(phone) where phone is not null;
create index if not exists idx_campaign_links_campaign on public.campaign_links(source, campaign);
create index if not exists idx_whatsapp_clicks_created on public.whatsapp_clicks(created_at desc);
create index if not exists idx_orders_attribution_source on public.orders(source_platform, campaign, created_at desc);

alter table public.visitor_profiles enable row level security;
alter table public.visitor_events enable row level security;
alter table public.lead_profiles enable row level security;
alter table public.lead_notes enable row level security;
alter table public.campaign_links enable row level security;
alter table public.whatsapp_clicks enable row level security;
alter table public.notify_me_requests enable row level security;

drop policy if exists "Service role visitor profiles" on public.visitor_profiles;
create policy "Service role visitor profiles" on public.visitor_profiles for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
drop policy if exists "Service role visitor events" on public.visitor_events;
create policy "Service role visitor events" on public.visitor_events for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
drop policy if exists "Service role lead profiles" on public.lead_profiles;
create policy "Service role lead profiles" on public.lead_profiles for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
drop policy if exists "Service role lead notes" on public.lead_notes;
create policy "Service role lead notes" on public.lead_notes for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
drop policy if exists "Service role campaign links" on public.campaign_links;
create policy "Service role campaign links" on public.campaign_links for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
drop policy if exists "Service role whatsapp clicks" on public.whatsapp_clicks;
create policy "Service role whatsapp clicks" on public.whatsapp_clicks for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
drop policy if exists "Service role notify me" on public.notify_me_requests;
create policy "Service role notify me" on public.notify_me_requests for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists visitor_profiles_touch_updated_at on public.visitor_profiles;
create trigger visitor_profiles_touch_updated_at before update on public.visitor_profiles for each row execute function public.touch_updated_at();
drop trigger if exists lead_profiles_touch_updated_at on public.lead_profiles;
create trigger lead_profiles_touch_updated_at before update on public.lead_profiles for each row execute function public.touch_updated_at();
