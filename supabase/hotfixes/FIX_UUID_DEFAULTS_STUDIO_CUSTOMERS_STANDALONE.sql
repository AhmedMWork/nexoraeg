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
-- NEXORA V5.5.5 — Recovery stabilization hotfix
-- ============================================================
-- Purpose:
-- 1) Remove all runtime dependency on pgcrypto/uuid-ossp UUID helpers.
-- 2) Repair live databases where existing tables still have broken UUID defaults.
-- 3) Make Studio Customers refresh safe after partial resets/migrations.
-- 4) Record a clear release ledger item for diagnostics.
-- ============================================================



-- Compatibility alias for older V5.5.4 defaults if any were already applied.

-- Create release ledger early and with safe UUID defaults.
create table if not exists public.nexora_system_migrations (
  id uuid primary key default public.nexora_uuid(),
  version text unique not null,
  summary text,
  applied_at timestamptz default now()
);

-- Rewire EVERY public UUID id default away from gen_random_uuid and old helpers.
do $$
declare
  r record;
begin
  for r in
    select c.table_schema, c.table_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema
     and t.table_name = c.table_name
    where c.table_schema = 'public'
      and t.table_type = 'BASE TABLE'
      and c.column_name = 'id'
      and c.udt_name = 'uuid'
  loop
    execute format('alter table %I.%I alter column id set default public.nexora_uuid()', r.table_schema, r.table_name);
  end loop;
end $$;

-- Ensure CRM tables exist even after partial database restores.
create table if not exists public.customer_profiles (
  id uuid primary key default public.nexora_uuid(),
  phone text unique,
  email text,
  full_name text,
  governorate text,
  city text,
  address text,
  total_orders integer default 0,
  total_revenue numeric default 0,
  last_order_at timestamptz,
  first_source text,
  last_source text,
  first_campaign text,
  last_campaign text,
  tags jsonb default '[]'::jsonb,
  status text default 'active',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.customer_notes (
  id uuid primary key default public.nexora_uuid(),
  customer_id uuid references public.customer_profiles(id) on delete cascade,
  note text not null,
  created_by text default 'studio',
  created_at timestamptz default now()
);

create table if not exists public.lead_tasks (
  id uuid primary key default public.nexora_uuid(),
  lead_id uuid,
  title text not null,
  status text default 'open',
  due_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.system_setup_events (
  id uuid primary key default public.nexora_uuid(),
  check_key text not null,
  status text default 'ok',
  message text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- Reapply safe defaults explicitly for the most error-prone tables.
alter table if exists public.customer_profiles alter column id set default public.nexora_uuid();
alter table if exists public.customer_notes alter column id set default public.nexora_uuid();
alter table if exists public.lead_tasks alter column id set default public.nexora_uuid();
alter table if exists public.system_setup_events alter column id set default public.nexora_uuid();
alter table if exists public.nexora_system_migrations alter column id set default public.nexora_uuid();

create index if not exists idx_customer_profiles_phone_v555 on public.customer_profiles(phone);
create index if not exists idx_customer_profiles_last_order_v555 on public.customer_profiles(last_order_at desc);
create index if not exists idx_customer_notes_customer_v555 on public.customer_notes(customer_id, created_at desc);

-- Defensive customer refresh. Does not depend on pgcrypto or old defaults.
create or replace function public.nexora_refresh_customer_profiles_v5_5()
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if to_regclass('public.orders') is null then
    return;
  end if;

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

-- Validate inserts into the tables that were failing in production.
do $$
declare
  test_customer_id uuid;
begin
  insert into public.customer_profiles(phone, full_name, notes)
  values ('__nexora_v555_test__', 'NEXORA Migration Test', 'Temporary migration test row')
  on conflict (phone) do update set updated_at = now()
  returning id into test_customer_id;

  delete from public.customer_profiles where phone = '__nexora_v555_test__';

  if test_customer_id is null then
    raise exception 'NEXORA V5.5.5 recovery test could not create a customer profile.';
  end if;
end $$;

insert into public.nexora_system_migrations(version, summary)
values ('5.5.5', 'Recovery stabilization: safe UUID defaults, Studio Customers resilience, no pgcrypto runtime dependency.')
on conflict (version) do update set summary = excluded.summary, applied_at = now();
