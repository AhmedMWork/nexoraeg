-- ============================================================
-- NEXORA UUID BOOTSTRAP
-- Safe on fresh and already-live Supabase databases.
-- No dependency on pgcrypto, uuid-ossp, gen_random_uuid, or gen_random_bytes.
-- Compatibility aliases are kept so older partially-applied databases do not fail.
-- ============================================================

create or replace function public.nexora_uuid()
returns uuid
language plpgsql
volatile
set search_path = public, pg_catalog
as $$
declare
  value text;
begin
  value := md5(concat(clock_timestamp()::text, random()::text, txid_current()::text, coalesce(inet_client_addr()::text, ''), coalesce(inet_client_port()::text, '')));
  return (
    substr(value, 1, 8) || '-' ||
    substr(value, 9, 4) || '-4' ||
    substr(value, 14, 3) || '-' ||
    substr('89ab', floor(random() * 4)::int + 1, 1) || substr(value, 18, 3) || '-' ||
    substr(value, 21, 12)
  )::uuid;
end;
$$;

create or replace function public.nexora_uuid_v5_5_5()
returns uuid
language sql
volatile
set search_path = public, pg_catalog
as $$
  select public.nexora_uuid();
$$;

create or replace function public.nexora_uuid_v5_5_4()
returns uuid
language sql
volatile
set search_path = public, pg_catalog
as $$
  select public.nexora_uuid();
$$;

-- ============================================================
-- NEXORA V5.5.6 — migration bootstrap hotfix
-- Must exist before 0009 creates CRM tables on already-live databases.
-- No dependency on pgcrypto/uuid-ossp/gen_random_bytes.
-- ============================================================



-- ============================================================
-- NEXORA V5.5 — Admin OS, CRM Intelligence, Diagnostics
-- ============================================================

create table if not exists public.rate_limit_buckets (
  bucket_key text primary key,
  count integer not null default 0,
  reset_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_profiles (
  id uuid primary key default public.nexora_uuid(),
  phone text unique,
  email text,
  full_name text,
  governorate text,
  city text,
  address text,
  total_orders integer not null default 0,
  total_revenue numeric not null default 0,
  first_source text,
  first_campaign text,
  last_source text,
  last_campaign text,
  tags text[] not null default '{}',
  status text not null default 'active',
  notes text,
  last_order_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_notes (
  id uuid primary key default public.nexora_uuid(),
  customer_id uuid references public.customer_profiles(id) on delete cascade,
  note text not null,
  created_by text not null default 'studio',
  created_at timestamptz not null default now()
);

create table if not exists public.lead_tasks (
  id uuid primary key default public.nexora_uuid(),
  lead_id uuid references public.lead_profiles(id) on delete cascade,
  title text not null,
  status text not null default 'open' check (status in ('open','done','cancelled')),
  due_at timestamptz,
  completed_at timestamptz,
  created_by text not null default 'studio',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_action_notes (
  id uuid primary key default public.nexora_uuid(),
  entity_type text not null,
  entity_id text not null,
  title text not null,
  note text,
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  status text not null default 'open' check (status in ('open','done','dismissed')),
  due_at timestamptz,
  created_by text not null default 'studio',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.system_setup_events (
  id uuid primary key default public.nexora_uuid(),
  check_key text not null,
  status text not null default 'unknown',
  message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.rate_limit_buckets enable row level security;
alter table public.customer_profiles enable row level security;
alter table public.customer_notes enable row level security;
alter table public.lead_tasks enable row level security;
alter table public.admin_action_notes enable row level security;
alter table public.system_setup_events enable row level security;

drop policy if exists "service manages rate limits" on public.rate_limit_buckets;
create policy "service manages rate limits" on public.rate_limit_buckets for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists "service manages customer profiles" on public.customer_profiles;
create policy "service manages customer profiles" on public.customer_profiles for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists "service manages customer notes" on public.customer_notes;
create policy "service manages customer notes" on public.customer_notes for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists "service manages lead tasks" on public.lead_tasks;
create policy "service manages lead tasks" on public.lead_tasks for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists "service manages admin action notes" on public.admin_action_notes;
create policy "service manages admin action notes" on public.admin_action_notes for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists "service manages setup events" on public.system_setup_events;
create policy "service manages setup events" on public.system_setup_events for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create or replace function public.nexora_rate_limit_v5_5(
  bucket_key_value text,
  limit_value integer,
  window_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_row public.rate_limit_buckets%rowtype;
  now_value timestamptz := now();
  reset_value timestamptz := now() + make_interval(secs => greatest(1, window_seconds));
begin
  select * into current_row from public.rate_limit_buckets where bucket_key = bucket_key_value for update;

  if current_row.bucket_key is null or current_row.reset_at <= now_value then
    insert into public.rate_limit_buckets(bucket_key, count, reset_at, updated_at)
    values (bucket_key_value, 1, reset_value, now_value)
    on conflict (bucket_key) do update set count = 1, reset_at = excluded.reset_at, updated_at = now_value;
    return jsonb_build_object('allowed', true, 'count', 1, 'remaining', greatest(limit_value - 1, 0), 'resetAt', reset_value);
  end if;

  update public.rate_limit_buckets
  set count = count + 1, updated_at = now_value
  where bucket_key = bucket_key_value
  returning * into current_row;

  return jsonb_build_object('allowed', current_row.count <= limit_value, 'count', current_row.count, 'remaining', greatest(limit_value - current_row.count, 0), 'resetAt', current_row.reset_at);
end;
$$;

create or replace function public.nexora_refresh_customer_profiles_v5_5()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.customer_profiles(phone, email, full_name, governorate, city, address, total_orders, total_revenue, last_order_at, first_source, last_source, first_campaign, last_campaign, updated_at)
  select
    nullif(customer_phone, ''),
    max(nullif(customer_email, '')),
    max(nullif(customer_name, '')),
    max(nullif(governorate, '')),
    max(nullif(city, '')),
    max(nullif(address, '')),
    count(*),
    coalesce(sum(case when coalesce(order_status, status) not in ('cancelled','returned','failed') then total else 0 end), 0),
    max(created_at),
    min(source_platform),
    max(source_platform),
    min(campaign),
    max(campaign),
    now()
  from public.orders
  where nullif(customer_phone, '') is not null
  group by customer_phone
  on conflict (phone) do update set
    email = coalesce(excluded.email, public.customer_profiles.email),
    full_name = coalesce(excluded.full_name, public.customer_profiles.full_name),
    governorate = coalesce(excluded.governorate, public.customer_profiles.governorate),
    city = coalesce(excluded.city, public.customer_profiles.city),
    address = coalesce(excluded.address, public.customer_profiles.address),
    total_orders = excluded.total_orders,
    total_revenue = excluded.total_revenue,
    last_order_at = excluded.last_order_at,
    first_source = coalesce(public.customer_profiles.first_source, excluded.first_source),
    first_campaign = coalesce(public.customer_profiles.first_campaign, excluded.first_campaign),
    last_source = excluded.last_source,
    last_campaign = excluded.last_campaign,
    updated_at = now();
end;
$$;

create or replace view public.nexora_product_variant_performance_v5_5 as
select
  oi.product_id,
  oi.product_name,
  oi.size,
  oi.color,
  count(distinct oi.order_id) as orders,
  sum(coalesce(oi.quantity, 0)) as units_sold,
  sum(coalesce(oi.total, 0)) as revenue,
  max(o.created_at) as last_sold_at
from public.order_items oi
left join public.orders o on o.id = oi.order_id
group by oi.product_id, oi.product_name, oi.size, oi.color;

select public.nexora_refresh_customer_profiles_v5_5();
