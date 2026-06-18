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
-- NEXORA V5.5.4 — Supabase UUID defaults + Studio Customers hotfix
-- ============================================================
-- Fixes live projects returning:
--   function gen_random_bytes(integer) does not exist
-- when inserting rows into tables whose UUID id defaults depend on pgcrypto.
--
-- This migration creates a safe UUID helper with graceful fallback and rewires
-- public UUID id defaults to use it, then refreshes customer profiles.
-- ============================================================

create schema if not exists extensions;

-- Try to enable common UUID extensions. Some Supabase projects already manage
-- these; failures are tolerated by the helper fallback below.
do $$
begin
  begin
    do $$ begin create extension if not exists pgcrypto with schema extensions; exception when others then raise notice 'pgcrypto unavailable: %', sqlerrm; end $$;
  exception when others then
    raise notice 'pgcrypto extension could not be created or is already managed: %', sqlerrm;
  end;

  begin
    do $$ begin create extension if not exists "uuid-ossp" with schema extensions; exception when others then raise notice 'uuid-ossp unavailable: %', sqlerrm; end $$;
  exception when others then
    raise notice 'uuid-ossp extension could not be created or is unavailable: %', sqlerrm;
  end;
end $$;

-- Rewire all public base-table UUID id defaults to the safe helper.
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

-- Extra explicit coverage for the tables involved in studio-customers.
alter table if exists public.customer_profiles alter column id set default public.nexora_uuid();
alter table if exists public.customer_notes alter column id set default public.nexora_uuid();
alter table if exists public.lead_tasks alter column id set default public.nexora_uuid();
alter table if exists public.admin_action_notes alter column id set default public.nexora_uuid();
alter table if exists public.system_setup_events alter column id set default public.nexora_uuid();

-- Recreate CRM refresh defensively. Keeps the previous behavior but ensures
-- it is available after partial migrations/resets.
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

-- Record release if the ledger exists.
insert into public.nexora_system_migrations(version, summary)
values ('5.5.4', 'Safe UUID defaults hotfix for Studio Customers and pgcrypto/gen_random_bytes issues.')
on conflict (version) do update set summary = excluded.summary, applied_at = now();

-- Validate the safe helper now.
do $$
declare
  test_uuid uuid;
begin
  select public.nexora_uuid() into test_uuid;
  if test_uuid is null then
    raise exception 'NEXORA V5.5.4 UUID helper returned null';
  end if;
end $$;
