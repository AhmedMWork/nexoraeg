-- ============================================================
-- NEXORA V5 — Production hardening and commerce foundations
-- Safe additive migration for V4.9 databases.
-- ============================================================

do $$ begin create extension if not exists pgcrypto; exception when others then raise notice 'pgcrypto unavailable: %', sqlerrm; end $$;

-- Variant-ready inventory model. The V4 storefront remains compatible
-- with products.stock_by_size/sizes/colors while V5 admin and future work
-- can manage exact size+color SKUs here.
create table if not exists public.product_variants (
  id uuid primary key default public.nexora_uuid_v5_5_5(),
  product_id uuid not null references public.products(id) on delete cascade,
  size text not null,
  color text,
  color_hex text,
  sku text unique,
  stock integer not null default 0 check (stock >= 0),
  low_stock_threshold integer not null default 3 check (low_stock_threshold >= 0),
  image_url text,
  status text not null default 'active' check (status in ('active','hidden','sold_out','archived')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(product_id, size, color)
);

create trigger set_product_variants_updated_at
before update on public.product_variants
for each row execute function public.set_updated_at();

alter table public.product_variants enable row level security;
drop policy if exists "Public can read active product variants" on public.product_variants;
create policy "Public can read active product variants" on public.product_variants
for select using (status in ('active','sold_out'));

create index if not exists idx_product_variants_product on public.product_variants(product_id, status);
create index if not exists idx_product_variants_sku on public.product_variants(sku);

-- Order tracking and integrity helpers.
create unique index if not exists idx_orders_order_number_unique on public.orders(order_number);
create index if not exists idx_orders_phone_number on public.orders(customer_phone);
create index if not exists idx_order_items_order_id on public.order_items(order_id);

alter table if exists public.order_items add column if not exists color_hex text;
alter table if exists public.order_items add column if not exists color_pattern text;
alter table if exists public.order_items add column if not exists variant_id uuid references public.product_variants(id) on delete set null;

-- Coupon data must not be publicly readable. Validation is only through Edge Functions.
drop policy if exists "Public read active coupons" on public.coupons;
drop policy if exists "Public can read active coupons" on public.coupons;
drop policy if exists "Allow public read active coupons" on public.coupons;

-- Settings needed by V5 deployment/SEO controls.
alter table if exists public.site_settings add column if not exists store_status text default 'open' check (store_status in ('open','maintenance','launching'));
alter table if exists public.site_settings add column if not exists production_domain text;
alter table if exists public.site_settings add column if not exists splash_enabled boolean default true;

-- Coupon usage RPC remains server-side, not browser-side.
create or replace function public.increment_coupon_usage(code_value text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.coupons
  set used_count = coalesce(used_count, 0) + 1,
      updated_at = now()
  where code = upper(code_value)
    and status = 'active';
end;
$$;

-- Optional audit helper for Edge Functions.
create or replace function public.log_audit_event(
  action_value text,
  entity_type_value text,
  entity_id_value text default null,
  metadata_value jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_logs(admin_email, action, entity_type, entity_id, after)
  values ('studio@nexora.local', action_value, entity_type_value, entity_id_value, metadata_value);
end;
$$;
