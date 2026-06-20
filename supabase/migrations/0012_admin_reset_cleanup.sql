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
-- NEXORA — Clean Light Admin Reset + Supabase Cleanup
-- Safe, additive migration. No destructive changes.
-- ============================================================

do $nexora_pgcrypto$
begin
  create extension if not exists pgcrypto with schema extensions;
exception
  when others then
    raise notice 'pgcrypto unavailable: %', sqlerrm;
end
$nexora_pgcrypto$;

create table if not exists public.nexora_system_migrations (
  version text primary key,
  title text not null,
  notes text,
  applied_at timestamptz not null default now()
);

insert into public.nexora_system_migrations (version, title, notes)
values (
  'admin-reset-cleanup',
  'Clean Light Admin Reset + Checkout Confidence',
  'Owner-facing admin navigation reduced; technical diagnostics kept under Setup & Recovery; checkout cart storage bumped to avoid stale reset carts.'
)
on conflict (version) do update
set title = excluded.title,
    notes = excluded.notes,
    applied_at = now();

alter table if exists public.shipping_settings
  add column if not exists show_free_shipping_progress boolean not null default false,
  add column if not exists free_shipping_progress_message text not null default 'Add {amount} more for free shipping.';

update public.shipping_settings
set show_free_shipping_progress = false
where show_free_shipping_progress is null;

do $idx_orders_status$
begin
  if to_regclass('public.orders') is not null
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='orders' and column_name='order_status')
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='orders' and column_name='created_at') then
    create index if not exists idx_orders_order_status_created_at on public.orders (order_status, created_at desc);
  end if;
end
$idx_orders_status$;

do $idx_orders_shipping$
begin
  if to_regclass('public.orders') is not null
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='orders' and column_name='shipping_status')
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='orders' and column_name='created_at') then
    create index if not exists idx_orders_shipping_status_created_at on public.orders (shipping_status, created_at desc);
  end if;
end
$idx_orders_shipping$;

do $idx_variants$
begin
  if to_regclass('public.product_variants') is not null
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='product_variants' and column_name='product_id')
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='product_variants' and column_name='status')
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='product_variants' and column_name='stock') then
    create index if not exists idx_product_variants_product_status_stock on public.product_variants (product_id, status, stock);
  end if;
end
$idx_variants$;

do $idx_visitor_events$
begin
  if to_regclass('public.visitor_events') is not null
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='visitor_events' and column_name='created_at')
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='visitor_events' and column_name='event_name') then
    create index if not exists idx_visitor_events_created_event on public.visitor_events (created_at desc, event_name);
  end if;
end
$idx_visitor_events$;

do $idx_leads$
begin
  if to_regclass('public.leads') is not null
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='leads' and column_name='status')
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='leads' and column_name='created_at') then
    create index if not exists idx_leads_status_created_at on public.leads (status, created_at desc);
  end if;
end
$idx_leads$;

do $comment_ledger$
begin
  if to_regclass('public.nexora_system_migrations') is not null then
    comment on table public.nexora_system_migrations is 'NEXORA additive release ledger used by Setup & Recovery to explain deployed release state.';
  end if;
end
$comment_ledger$;

do $comment_shipping$
begin
  if to_regclass('public.shipping_settings') is not null
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='shipping_settings' and column_name='show_free_shipping_progress') then
    comment on column public.shipping_settings.show_free_shipping_progress is 'Owner-controlled toggle. Checkout must not show free shipping progress unless this is true.';
  end if;
end
$comment_shipping$;
