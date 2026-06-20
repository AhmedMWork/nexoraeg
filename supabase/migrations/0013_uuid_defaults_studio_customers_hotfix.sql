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
as $$ select public.nexora_uuid(); $$;

create or replace function public.nexora_uuid_v5_5_4()
returns uuid
language sql
volatile
set search_path = public, pg_catalog
as $$ select public.nexora_uuid(); $$;

-- ============================================================
-- NEXORA — Supabase UUID defaults + Studio Customers hotfix
-- ============================================================

create schema if not exists extensions;

do $nexora_pgcrypto$
begin
  create extension if not exists pgcrypto with schema extensions;
exception when others then
  raise notice 'pgcrypto extension could not be enabled, continuing with fallback UUID helper: %', sqlerrm;
end
$nexora_pgcrypto$;

do $nexora_uuid_ossp$
begin
  create extension if not exists "uuid-ossp" with schema extensions;
exception when others then
  raise notice 'uuid-ossp extension could not be enabled, continuing with fallback UUID helper: %', sqlerrm;
end
$nexora_uuid_ossp$;

do $nexora_rewire_uuid_defaults$
declare
  r record;
begin
  for r in
    select c.table_schema, c.table_name
    from information_schema.columns c
    join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
    where c.table_schema = 'public' and t.table_type = 'BASE TABLE' and c.column_name = 'id' and c.udt_name = 'uuid'
  loop
    execute format('alter table %I.%I alter column id set default public.nexora_uuid()', r.table_schema, r.table_name);
  end loop;
end
$nexora_rewire_uuid_defaults$;

alter table if exists public.customer_profiles alter column id set default public.nexora_uuid();
alter table if exists public.customer_notes alter column id set default public.nexora_uuid();
alter table if exists public.lead_tasks alter column id set default public.nexora_uuid();
alter table if exists public.admin_action_notes alter column id set default public.nexora_uuid();
alter table if exists public.system_setup_events alter column id set default public.nexora_uuid();

create or replace function public.nexora_refresh_customer_profiles_v5_5()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if to_regclass('public.orders') is null or to_regclass('public.customer_profiles') is null then
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
    coalesce(sum(case when order_status not in ('cancelled','returned','failed') then total else 0 end), 0),
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

do $nexora_record_release$
begin
  if to_regclass('public.nexora_system_migrations') is not null then
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'nexora_system_migrations' and column_name = 'summary') then
      insert into public.nexora_system_migrations(version, summary)
      values ('uuid-studio-customers-hotfix', 'Safe UUID defaults hotfix for Studio Customers and pgcrypto/gen_random_bytes issues.')
      on conflict (version) do update set summary = excluded.summary, applied_at = now();
    elsif exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'nexora_system_migrations' and column_name = 'notes') then
      insert into public.nexora_system_migrations(version, title, notes)
      values ('uuid-studio-customers-hotfix', 'UUID Studio Customers Hotfix', 'Safe UUID defaults hotfix for Studio Customers and pgcrypto/gen_random_bytes issues.')
      on conflict (version) do update set title = excluded.title, notes = excluded.notes, applied_at = now();
    end if;
  end if;
end
$nexora_record_release$;

do $nexora_validate_uuid$
declare
  test_uuid uuid;
begin
  select public.nexora_uuid() into test_uuid;
  if test_uuid is null then
    raise exception 'NEXORA UUID helper returned null';
  end if;
end
$nexora_validate_uuid$;
