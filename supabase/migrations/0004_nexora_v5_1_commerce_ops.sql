-- ============================================================
-- NEXORA V5.1 — Commerce Operations, SEO, Admin, Analytics
-- Safe/idempotent migration intended to run after V5 hardening.
-- ============================================================

-- Product catalog expansion
alter table if exists public.products add column if not exists short_description text;
alter table if exists public.products add column if not exists cost_price numeric(10,2);
alter table if exists public.products add column if not exists collection text default 'core';
alter table if exists public.products add column if not exists material text;
alter table if exists public.products add column if not exists fit text;
alter table if exists public.products add column if not exists care text;
alter table if exists public.products add column if not exists badges jsonb default '[]'::jsonb;
alter table if exists public.products add column if not exists visibility text default 'public';

-- Variant engine expansion
alter table if exists public.product_variants add column if not exists low_stock_threshold integer default 3;
alter table if exists public.product_variants add column if not exists reserved_stock integer default 0;
alter table if exists public.product_variants add column if not exists barcode text;
alter table if exists public.product_variants add column if not exists image_url text;
alter table if exists public.product_variants add column if not exists sort_order integer default 0;
create unique index if not exists idx_product_variants_sku_unique on public.product_variants(sku) where sku is not null and sku <> '';

alter table if exists public.orders add column if not exists idempotency_key text;
create unique index if not exists idx_orders_idempotency_key on public.orders(idempotency_key) where idempotency_key is not null and idempotency_key <> '';

-- Status history table for admin order timeline
create table if not exists public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  old_status text,
  new_status text not null,
  note text,
  changed_by text default 'studio',
  created_at timestamptz default now()
);
create index if not exists idx_order_status_history_order on public.order_status_history(order_id, created_at desc);
alter table public.order_status_history enable row level security;
drop policy if exists "Studio service role only order status history" on public.order_status_history;
create policy "Studio service role only order status history" on public.order_status_history for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- Operational event log for system/edge failures that should not be mixed with storefront analytics
create table if not exists public.system_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  severity text default 'info' check (severity in ('debug','info','warning','error','critical')),
  source text default 'edge',
  entity_type text,
  entity_id text,
  payload jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
create index if not exists idx_system_events_created on public.system_events(created_at desc);
create index if not exists idx_system_events_name on public.system_events(event_name);
alter table public.system_events enable row level security;
drop policy if exists "Studio service role only system events" on public.system_events;
create policy "Studio service role only system events" on public.system_events for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- Settings center expansion
alter table if exists public.site_settings add column if not exists announcement_text text;
alter table if exists public.site_settings add column if not exists announcement_enabled boolean default false;
alter table if exists public.site_settings add column if not exists track_order_enabled boolean default true;
alter table if exists public.site_settings add column if not exists brand_tagline text default 'Defined by intention. Not for everyone.';
alter table if exists public.site_settings add column if not exists splash_copy jsonb default '{"top":"Tap to enter","bottom":"Not for everyone."}'::jsonb;
alter table if exists public.site_settings add column if not exists default_og_image text;

-- Coupon/promotion guard rails
alter table if exists public.coupons add column if not exists allowed_categories text[] default '{}';
alter table if exists public.coupons add column if not exists excluded_categories text[] default '{}';
alter table if exists public.coupons add column if not exists allowed_product_ids uuid[] default '{}';
alter table if exists public.coupons add column if not exists excluded_product_ids uuid[] default '{}';
alter table if exists public.coupons add column if not exists first_order_only boolean default false;

-- Analytics indexes for dashboard queries
create index if not exists idx_analytics_events_session on public.analytics_events(session_id, created_at desc);
create index if not exists idx_analytics_events_payload_gin on public.analytics_events using gin(payload);

-- Helper function used by Studio/order functions to write a canonical status history row.
create or replace function public.record_order_status_history(
  order_id_value uuid,
  old_status_value text,
  new_status_value text,
  note_value text,
  changed_by_value text default 'studio'
) returns uuid
language plpgsql
security definer
as $$
declare
  created_id uuid;
begin
  insert into public.order_status_history(order_id, old_status, new_status, note, changed_by)
  values (order_id_value, old_status_value, new_status_value, note_value, changed_by_value)
  returning id into created_id;
  return created_id;
end;
$$;
