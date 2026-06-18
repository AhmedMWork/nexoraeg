-- ============================================================
-- NEXORA V5.5.1 — Light Admin + Checkout Stability + Supabase Recovery
-- Adds storefront control over free-shipping progress messaging and keeps it OFF by default.
-- Safe additive migration intended to run after V5.5.
-- ============================================================

alter table if exists public.shipping_settings
  add column if not exists show_free_shipping_progress boolean not null default false;

alter table if exists public.shipping_settings
  add column if not exists free_shipping_progress_message text not null default 'Add {amount} more for free shipping.';

update public.shipping_settings
set show_free_shipping_progress = false
where id = 'main' and show_free_shipping_progress is null;

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
    'showFreeShippingProgress', coalesce(settings_row.show_free_shipping_progress, false),
    'freeShippingProgressMessage', coalesce(settings_row.free_shipping_progress_message, 'Add {amount} more for free shipping.'),
    'deliveryEstimate', coalesce(zone_row.delivery_estimate, settings_row.fallback_delivery_estimate, '2-5 business days'),
    'zoneId', zone_row.id,
    'shipbluZoneId', zone_row.shipblu_zone_id,
    'remoteArea', coalesce(zone_row.remote_area, false),
    'provider', settings_row.provider,
    'providerEnabled', coalesce(settings_row.provider_enabled, false)
  );
end;
$$;



comment on column public.shipping_settings.show_free_shipping_progress is 'Controls whether storefront/checkout shows Add amount more for free shipping. Default false for clean premium checkout.';

create or replace function public.nexora_diagnostics_v5_5_1()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  products_count integer := 0;
  active_products_count integer := 0;
  active_variants_with_stock_count integer := 0;
  shipping_zones_count integer := 0;
  shipping_enabled_value boolean := false;
begin
  select count(*) into products_count from public.products;
  select count(*) into active_products_count from public.products where status = 'active';
  select count(*) into active_variants_with_stock_count
  from public.product_variants
  where status = 'active' and coalesce(stock,0) > coalesce(reserved_stock,0);
  select count(*) into shipping_zones_count from public.shipping_zones where enabled = true;
  select coalesce(shipping_enabled, false) into shipping_enabled_value from public.shipping_settings where id = 'main';

  return jsonb_build_object(
    'productsCount', products_count,
    'activeProductsCount', active_products_count,
    'activeVariantsWithStock', active_variants_with_stock_count,
    'shippingZonesCount', shipping_zones_count,
    'shippingEnabled', coalesce(shipping_enabled_value, false),
    'orderRpcReady', to_regprocedure('public.nexora_create_order_atomic_v5_4(jsonb)') is not null,
    'shippingRpcReady', to_regprocedure('public.nexora_calculate_shipping_v5_4(text,text,numeric,boolean)') is not null,
    'rateLimitRpcReady', to_regprocedure('public.nexora_rate_limit_v5_5(text,integer,integer)') is not null
  );
end;
$$;

grant execute on function public.nexora_diagnostics_v5_5_1() to service_role;
