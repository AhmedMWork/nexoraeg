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
-- NEXORA V5.5.3 — Clean Light Admin Reset + Supabase Cleanup
-- Safe, additive migration. No destructive changes.
-- ============================================================

-- Keep pgcrypto explicitly enabled for older projects even though checkout no longer relies on gen_random_bytes.
do $$ begin create extension if not exists pgcrypto with schema extensions; exception when others then raise notice 'pgcrypto unavailable: %', sqlerrm; end $$;

-- Lightweight migration ledger for owner/support diagnostics.
create table if not exists public.nexora_system_migrations (
  version text primary key,
  title text not null,
  notes text,
  applied_at timestamptz not null default now()
);

insert into public.nexora_system_migrations (version, title, notes)
values (
  '5.5.3',
  'Clean Light Admin Reset + Checkout Confidence',
  'Owner-facing admin navigation reduced; technical diagnostics kept under Setup & Recovery; checkout cart storage bumped to avoid stale reset carts.'
)
on conflict (version) do update
set title = excluded.title,
    notes = excluded.notes,
    applied_at = now();

-- Make free shipping messaging opt-in and explicit forever.
alter table if exists public.shipping_settings
  add column if not exists show_free_shipping_progress boolean not null default false,
  add column if not exists free_shipping_progress_message text not null default 'Add {amount} more for free shipping.';

update public.shipping_settings
set show_free_shipping_progress = false
where show_free_shipping_progress is null;

-- Indexes for admin daily dashboard and checkout diagnostics.
create index if not exists idx_orders_status_created_at on public.orders (status, created_at desc);
create index if not exists idx_orders_shipping_status_created_at on public.orders (shipping_status, created_at desc);
create index if not exists idx_product_variants_product_status_stock on public.product_variants (product_id, status, stock);
create index if not exists idx_visitor_events_created_event on public.visitor_events (created_at desc, event_name);
create index if not exists idx_leads_status_created_at on public.leads (status, created_at desc);

comment on table public.nexora_system_migrations is 'NEXORA additive release ledger used by Setup & Recovery to explain deployed release state.';
comment on column public.shipping_settings.show_free_shipping_progress is 'Owner-controlled toggle. Checkout must not show free shipping progress unless this is true.';
