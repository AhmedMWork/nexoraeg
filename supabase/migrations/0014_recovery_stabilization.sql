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
-- NEXORA — Recovery stabilization hotfix
-- ============================================================

create table if not exists public.nexora_system_migrations (
  version text primary key,
  title text,
  notes text,
  applied_at timestamptz default now()
);

alter table if exists public.nexora_system_migrations
  add column if not exists title text,
  add column if not exists notes text,
  add column if not exists applied_at timestamptz default now();

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

alter table if exists public.customer_profiles
  add column if not exists phone text,
  add column if not exists email text,
  add column if not exists full_name text,
  add column if not exists governorate text,
  add column if not exists city text,
  add column if not exists address text,
  add column if not exists total_orders integer default 0,
  add column if not exists total_revenue numeric default 0,
  add column if not exists last_order_at timestamptz,
  add column if not exists first_source text,
  add column if not exists last_source text,
  add column if not exists first_campaign text,
  add column if not exists last_campaign text,
  add column if not exists tags jsonb default '[]'::jsonb,
  add column if not exists status text default 'active',
  add column if not exists notes text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

alter table if exists public.customer_notes
  add column if not exists customer_id uuid,
  add column if not exists note text,
  add column if not exists created_by text default 'studio',
  add column if not exists created_at timestamptz default now();

alter table if exists public.lead_tasks
  add column if not exists lead_id uuid,
  add column if not exists title text,
  add column if not exists status text default 'open',
  add column if not exists due_at timestamptz,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

alter table if exists public.system_setup_events
  add column if not exists check_key text,
  add column if not exists status text default 'ok',
  add column if not exists message text,
  add column if not exists metadata jsonb default '{}'::jsonb,
  add column if not exists created_at timestamptz default now();

create index if not exists idx_customer_profiles_phone_recovery on public.customer_profiles(phone);
create index if not exists idx_customer_profiles_last_order_recovery on public.customer_profiles(last_order_at desc);
create index if not exists idx_customer_notes_customer_recovery on public.customer_notes(customer_id, created_at desc);

create or replace function public.nexora_refresh_customer_profiles_v5_5()
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
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

do $nexora_validate_customer_profiles$
declare
  test_customer_id uuid;
begin
  insert into public.customer_profiles(phone, full_name, notes)
  values ('__nexora_recovery_test__', 'NEXORA Migration Test', 'Temporary migration test row')
  on conflict (phone) do update set updated_at = now()
  returning id into test_customer_id;
  delete from public.customer_profiles where phone = '__nexora_recovery_test__';
  if test_customer_id is null then
    raise exception 'NEXORA recovery test could not create a customer profile.';
  end if;
end
$nexora_validate_customer_profiles$;

do $nexora_record_recovery_release$
begin
  if to_regclass('public.nexora_system_migrations') is not null then
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'nexora_system_migrations' and column_name = 'summary') then
      insert into public.nexora_system_migrations(version, summary)
      values ('recovery-stabilization', 'Recovery stabilization: safe UUID defaults, Studio Customers resilience, no pgcrypto runtime dependency.')
      on conflict (version) do update set summary = excluded.summary, applied_at = now();
    elsif exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'nexora_system_migrations' and column_name = 'notes') then
      insert into public.nexora_system_migrations(version, title, notes)
      values ('recovery-stabilization', 'Recovery Stabilization', 'Safe UUID defaults, Studio Customers resilience, no pgcrypto runtime dependency.')
      on conflict (version) do update set title = excluded.title, notes = excluded.notes, applied_at = now();
    else
      insert into public.nexora_system_migrations(version)
      values ('recovery-stabilization')
      on conflict (version) do nothing;
    end if;
  end if;
end
$nexora_record_recovery_release$;
