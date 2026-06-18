-- ============================================================
-- NEXORA V5.4 — Operations Intelligence, Shipping Control,
-- ShipBlu-ready integration, richer product analytics.
-- Safe additive migration intended to run after V5.3.
-- ============================================================

create extension if not exists pgcrypto;

-- Shipping control center -----------------------------------------------------
create table if not exists public.shipping_settings (
  id text primary key default 'main',
  shipping_enabled boolean not null default true,
  default_shipping_fee numeric not null default 80 check (default_shipping_fee >= 0),
  cod_fee numeric not null default 0 check (cod_fee >= 0),
  free_shipping_enabled boolean not null default false,
  free_shipping_threshold numeric not null default 0 check (free_shipping_threshold >= 0),
  fallback_delivery_estimate text not null default '2-5 business days',
  provider text not null default 'shipblu',
  provider_enabled boolean not null default false,
  provider_environment text not null default 'production' check (provider_environment in ('production','staging')),
  auto_create_shipments boolean not null default false,
  default_package_size integer not null default 1,
  default_pickup_zone_id integer,
  notes text,
  updated_at timestamptz not null default now()
);

insert into public.shipping_settings (id, default_shipping_fee, free_shipping_enabled, free_shipping_threshold)
select 'main', coalesce(s.shipping_fee, 80), false, coalesce(s.free_shipping_threshold, 0)
from public.site_settings s where s.id = 'main'
on conflict (id) do nothing;

create table if not exists public.shipping_zones (
  id uuid primary key default gen_random_uuid(),
  governorate text not null,
  city text,
  shipping_fee numeric not null default 80 check (shipping_fee >= 0),
  cod_fee numeric not null default 0 check (cod_fee >= 0),
  delivery_estimate text not null default '2-5 business days',
  enabled boolean not null default true,
  remote_area boolean not null default false,
  shipblu_governorate_id integer,
  shipblu_city_id integer,
  shipblu_zone_id integer,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_shipping_zones_unique_area on public.shipping_zones(lower(governorate), lower(coalesce(city, '*')));
create index if not exists idx_shipping_zones_lookup on public.shipping_zones(lower(governorate), lower(coalesce(city, '*')), enabled);

insert into public.shipping_zones (governorate, city, shipping_fee, cod_fee, delivery_estimate, enabled, notes)
values
  ('Cairo', '*', 80, 0, '1-3 business days', true, 'Default Cairo rate'),
  ('Giza', '*', 90, 0, '2-4 business days', true, 'Default Giza rate'),
  ('Alexandria', '*', 100, 0, '2-5 business days', true, 'Default Alexandria rate'),
  ('Default', '*', 120, 0, '3-6 business days', true, 'Fallback rate for all other areas')
on conflict do nothing;

create table if not exists public.shipping_shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  provider text not null default 'shipblu',
  provider_order_id text,
  tracking_number text,
  status text not null default 'not_created',
  label_url text,
  shipping_fee numeric,
  cod_amount numeric,
  delivery_estimate text,
  raw_response jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(order_id, provider)
);

create index if not exists idx_shipping_shipments_order on public.shipping_shipments(order_id);
create index if not exists idx_shipping_shipments_tracking on public.shipping_shipments(tracking_number);

create table if not exists public.shipping_events (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid references public.shipping_shipments(id) on delete cascade,
  order_id uuid references public.orders(id) on delete cascade,
  provider text not null default 'shipblu',
  status text not null,
  message text,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_shipping_events_shipment_created on public.shipping_events(shipment_id, created_at desc);

alter table if exists public.orders add column if not exists cod_fee numeric not null default 0;
alter table if exists public.orders add column if not exists delivery_estimate text;
alter table if exists public.orders add column if not exists shipping_provider text;
alter table if exists public.orders add column if not exists shipping_status text not null default 'not_created';
alter table if exists public.orders add column if not exists tracking_number text;
alter table if exists public.orders add column if not exists shipment_id uuid;
alter table if exists public.orders add column if not exists shipping_quote jsonb not null default '{}'::jsonb;

alter table public.shipping_settings enable row level security;
alter table public.shipping_zones enable row level security;
alter table public.shipping_shipments enable row level security;
alter table public.shipping_events enable row level security;

drop policy if exists "service role manages shipping settings" on public.shipping_settings;
create policy "service role manages shipping settings" on public.shipping_settings for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
drop policy if exists "service role manages shipping zones" on public.shipping_zones;
create policy "service role manages shipping zones" on public.shipping_zones for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
drop policy if exists "service role manages shipping shipments" on public.shipping_shipments;
create policy "service role manages shipping shipments" on public.shipping_shipments for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
drop policy if exists "service role manages shipping events" on public.shipping_events;
create policy "service role manages shipping events" on public.shipping_events for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- Public-safe calculation exposed only through Edge Function with service role.
create or replace function public.nexora_calculate_shipping_v5_4(
  governorate_value text,
  city_value text,
  subtotal_value numeric default 0,
  coupon_free_shipping boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  settings_row public.shipping_settings%rowtype;
  zone_row public.shipping_zones%rowtype;
  default_zone public.shipping_zones%rowtype;
  shipping_fee_value numeric;
  cod_fee_value numeric;
  free_applied boolean := false;
begin
  select * into settings_row from public.shipping_settings where id = 'main';
  if settings_row.id is null then
    insert into public.shipping_settings (id) values ('main') on conflict do nothing;
    select * into settings_row from public.shipping_settings where id = 'main';
  end if;

  if not coalesce(settings_row.shipping_enabled, true) then
    return jsonb_build_object('available', false, 'reason', 'Shipping is currently disabled.', 'shippingFee', 0, 'codFee', 0, 'totalDeliveryFee', 0);
  end if;

  select * into zone_row
  from public.shipping_zones
  where enabled = true
    and lower(governorate) = lower(coalesce(governorate_value, ''))
    and (city is null or city = '*' or lower(city) = lower(coalesce(city_value, '')))
  order by case when lower(coalesce(city, '*')) = lower(coalesce(city_value, '')) then 0 else 1 end
  limit 1;

  if zone_row.id is null then
    select * into default_zone from public.shipping_zones where enabled = true and lower(governorate) = 'default' order by created_at asc limit 1;
    if default_zone.id is not null then zone_row := default_zone; end if;
  end if;

  if zone_row.id is null then
    shipping_fee_value := coalesce(settings_row.default_shipping_fee, 0);
    cod_fee_value := coalesce(settings_row.cod_fee, 0);
  else
    shipping_fee_value := coalesce(zone_row.shipping_fee, settings_row.default_shipping_fee, 0);
    cod_fee_value := coalesce(zone_row.cod_fee, settings_row.cod_fee, 0);
  end if;

  if coupon_free_shipping or (coalesce(settings_row.free_shipping_enabled, false) and coalesce(settings_row.free_shipping_threshold, 0) > 0 and subtotal_value >= settings_row.free_shipping_threshold) then
    shipping_fee_value := 0;
    free_applied := true;
  end if;

  return jsonb_build_object(
    'available', true,
    'shippingFee', shipping_fee_value,
    'codFee', cod_fee_value,
    'totalDeliveryFee', shipping_fee_value + cod_fee_value,
    'freeShippingApplied', free_applied,
    'freeShippingEnabled', coalesce(settings_row.free_shipping_enabled, false),
    'freeShippingThreshold', coalesce(settings_row.free_shipping_threshold, 0),
    'deliveryEstimate', coalesce(zone_row.delivery_estimate, settings_row.fallback_delivery_estimate, '2-5 business days'),
    'zoneId', zone_row.id,
    'shipbluZoneId', zone_row.shipblu_zone_id,
    'remoteArea', coalesce(zone_row.remote_area, false),
    'provider', settings_row.provider,
    'providerEnabled', coalesce(settings_row.provider_enabled, false)
  );
end;
$$;

-- V5.4 atomic order creation: same correctness as V5.3 plus server-side shipping pricing.
create or replace function public.nexora_create_order_atomic_v5_4(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
  shipping_quote jsonb;
  order_id_value uuid;
  customer_value jsonb := coalesce(payload->'customer', '{}'::jsonb);
  coupon_free boolean := false;
  coupon_code_value text := nullif(upper(trim(coalesce(payload->>'couponCode', ''))), '');
  coupon_row record;
  subtotal_estimate numeric := 0;
  item_value jsonb;
  product_row record;
begin
  -- Estimate subtotal before delegating to V5.3 so shipping pricing cannot be forged by the client.
  for item_value in select * from jsonb_array_elements(coalesce(payload->'items', '[]'::jsonb)) loop
    select price into product_row from public.products where id = nullif(item_value->>'productId','')::uuid;
    subtotal_estimate := subtotal_estimate + coalesce(product_row.price, 0) * greatest(1, coalesce((item_value->>'quantity')::integer, 1));
  end loop;

  if coupon_code_value is not null then
    select * into coupon_row from public.coupons where code = coupon_code_value and status = 'active';
    coupon_free := (coupon_row.type = 'free_shipping');
  end if;

  shipping_quote := public.nexora_calculate_shipping_v5_4(customer_value->>'governorate', customer_value->>'city', subtotal_estimate, coupon_free);
  if coalesce((shipping_quote->>'available')::boolean, false) is false then
    raise exception '%', coalesce(shipping_quote->>'reason', 'Shipping is not available.');
  end if;

  -- Reuse V5.3 transaction then correct shipping totals inside the same wrapper transaction.
  result := public.nexora_create_order_atomic_v5_3(payload || jsonb_build_object('shippingQuote', shipping_quote));
  order_id_value := (result->>'orderId')::uuid;

  update public.orders
  set shipping_fee = coalesce((shipping_quote->>'shippingFee')::numeric, shipping_fee),
      cod_fee = coalesce((shipping_quote->>'codFee')::numeric, 0),
      total = greatest(0, subtotal - discount_total + coalesce((shipping_quote->>'shippingFee')::numeric, shipping_fee) + coalesce((shipping_quote->>'codFee')::numeric, 0)),
      delivery_estimate = shipping_quote->>'deliveryEstimate',
      shipping_provider = shipping_quote->>'provider',
      shipping_quote = shipping_quote,
      updated_at = now()
  where id = order_id_value;

  select jsonb_build_object('orderId', id, 'orderNumber', order_number, 'total', total, 'shippingFee', shipping_fee, 'codFee', cod_fee, 'deliveryEstimate', delivery_estimate, 'idempotent', coalesce((result->>'idempotent')::boolean, false))
  into result
  from public.orders where id = order_id_value;

  return result;
end;
$$;
