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
-- NEXORA V5.3 — Commerce Correctness, Atomic Orders, Variant Inventory
-- Safe additive migration intended to run after V5.2.1.
-- ============================================================

do $$ begin create extension if not exists pgcrypto; exception when others then raise notice 'pgcrypto unavailable: %', sqlerrm; end $$;

alter table if exists public.order_items add column if not exists variant_id uuid references public.product_variants(id) on delete set null;
alter table if exists public.order_items add column if not exists color_hex text;
alter table if exists public.order_items add column if not exists color_pattern text;
alter table if exists public.inventory_logs add column if not exists variant_id uuid references public.product_variants(id) on delete set null;

create index if not exists idx_order_items_variant_id on public.order_items(variant_id);
create index if not exists idx_product_variants_lookup on public.product_variants(product_id, upper(size), lower(coalesce(color,'')), status);
create index if not exists idx_inventory_logs_variant_created on public.inventory_logs(variant_id, created_at desc);

-- Sync a product legacy stock fields from variants so old storefront/admin screens remain compatible.
create or replace function public.nexora_sync_product_stock_from_variants(product_id_value uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  stock_by_size_value jsonb;
  total_value integer;
begin
  select coalesce(jsonb_object_agg(size_key, size_stock), '{}'::jsonb), coalesce(sum(size_stock), 0)::integer
  into stock_by_size_value, total_value
  from (
    select upper(size) as size_key, sum(greatest(stock - coalesce(reserved_stock, 0), 0))::integer as size_stock
    from public.product_variants
    where product_id = product_id_value
      and status in ('active','sold_out')
    group by upper(size)
  ) grouped;

  if stock_by_size_value is not null and stock_by_size_value <> '{}'::jsonb then
    update public.products
    set stock_by_size = stock_by_size_value,
        stock_total = total_value,
        status = case when total_value <= 0 then 'sold_out' when status = 'sold_out' then 'active' else status end,
        updated_at = now()
    where id = product_id_value;
  end if;
end;
$$;

-- Atomic order creation. This function runs in a single DB transaction:
-- 1) locks products/variants/coupon rows,
-- 2) validates stock,
-- 3) inserts the order + items,
-- 4) decrements stock,
-- 5) increments coupon usage,
-- 6) writes inventory/order logs.
create or replace function public.nexora_create_order_atomic_v5_3(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  idempotency_key_value text := nullif(trim(coalesce(payload->>'idempotencyKey', '')), '');
  existing_order record;
  customer_value jsonb := coalesce(payload->'customer', '{}'::jsonb);
  items_value jsonb := coalesce(payload->'items', '[]'::jsonb);
  item_value jsonb;
  product_row record;
  variant_row record;
  created_order record;
  settings_row record;
  coupon_row record;
  coupon_code_value text := nullif(upper(trim(coalesce(payload->>'couponCode', ''))), '');
  phone_value text;
  order_number_value text;
  item_count integer;
  qty_value integer;
  size_value text;
  color_value text;
  product_id_value uuid;
  variant_id_value uuid;
  before_stock integer;
  after_stock integer;
  stock_by_size_value jsonb;
  stock_total_value integer;
  unit_price numeric;
  subtotal_value numeric := 0;
  discount_value numeric := 0;
  shipping_fee_value numeric := 0;
  total_value numeric := 0;
  free_shipping_by_coupon boolean := false;
  loop_index integer;
begin
  if idempotency_key_value is not null then
    select id, order_number, total
    into existing_order
    from public.orders
    where idempotency_key = idempotency_key_value
    limit 1;

    if existing_order.id is not null then
      return jsonb_build_object('orderId', existing_order.id, 'orderNumber', existing_order.order_number, 'total', existing_order.total, 'idempotent', true);
    end if;
  end if;

  item_count := jsonb_array_length(items_value);
  if item_count <= 0 then
    raise exception 'Cart is empty.';
  end if;

  phone_value := regexp_replace(coalesce(customer_value->>'phone', ''), '\D', '', 'g');
  if left(phone_value, 2) = '20' then
    phone_value := '0' || substr(phone_value, 3);
  end if;
  if phone_value !~ '^01[0-9]{9}$' then
    raise exception 'Enter a valid Egyptian phone number.';
  end if;

  if nullif(trim(coalesce(customer_value->>'fullName', customer_value->>'name', '')), '') is null
    or nullif(trim(coalesce(customer_value->>'governorate', '')), '') is null
    or nullif(trim(coalesce(customer_value->>'city', '')), '') is null
    or nullif(trim(coalesce(customer_value->>'address', '')), '') is null then
    raise exception 'Customer name, phone, governorate, city, and address are required.';
  end if;

  -- Validate, lock, and price every item. This loop does not update stock yet;
  -- stock is updated after the order row exists so logs can reference order_id.
  for item_value in select * from jsonb_array_elements(items_value)
  loop
    product_id_value := nullif(item_value->>'productId', '')::uuid;
    variant_id_value := nullif(item_value->>'variantId', '')::uuid;
    qty_value := greatest(1, coalesce((item_value->>'quantity')::integer, 1));
    size_value := upper(trim(coalesce(item_value->>'size', '')));
    color_value := trim(coalesce(item_value->>'color', ''));

    if product_id_value is null or size_value = '' then
      raise exception 'Every item must include a product and size.';
    end if;

    select * into product_row from public.products where id = product_id_value and status = 'active' for update;
    if product_row.id is null then
      raise exception 'Some items are unavailable.';
    end if;

    variant_row := null;
    if variant_id_value is not null then
      select * into variant_row
      from public.product_variants
      where id = variant_id_value and product_id = product_id_value
      for update;
    else
      select * into variant_row
      from public.product_variants
      where product_id = product_id_value
        and upper(size) = size_value
        and (color_value = '' or lower(coalesce(color,'')) = lower(color_value))
        and status in ('active','sold_out')
      order by case when lower(coalesce(color,'')) = lower(color_value) then 0 else 1 end, sort_order asc nulls last, created_at asc
      limit 1
      for update;
    end if;

    if variant_row.id is not null then
      variant_id_value := variant_row.id;
      before_stock := greatest(coalesce(variant_row.stock, 0) - coalesce(variant_row.reserved_stock, 0), 0);
      if variant_row.status <> 'active' or before_stock < qty_value then
        raise exception '% is not available in the selected size/color quantity.', coalesce(product_row.name_en, 'This item');
      end if;
    else
      stock_by_size_value := coalesce(product_row.stock_by_size, '{}'::jsonb);
      before_stock := coalesce((stock_by_size_value ->> size_value)::integer, 0);
      if before_stock < qty_value then
        raise exception '% is not available in the selected quantity.', coalesce(product_row.name_en, 'This item');
      end if;
    end if;

    unit_price := coalesce(product_row.price, 0);
    subtotal_value := subtotal_value + (unit_price * qty_value);
  end loop;

  if coupon_code_value is not null then
    select * into coupon_row from public.coupons where code = coupon_code_value and status = 'active' for update;
    if coupon_row.id is null then
      raise exception 'Coupon is not valid.';
    end if;
    if coalesce(coupon_row.start_date, now()) > now() or coalesce(coupon_row.end_date, now()) < now() then
      raise exception 'Coupon is not active.';
    end if;
    if subtotal_value < coalesce(coupon_row.min_order_amount, 0) then
      raise exception 'Minimum order amount has not been reached.';
    end if;
    if coalesce(coupon_row.usage_limit, 0) > 0 and coalesce(coupon_row.used_count, 0) >= coalesce(coupon_row.usage_limit, 0) then
      raise exception 'Coupon usage limit reached.';
    end if;

    if coupon_row.type = 'percentage' then
      discount_value := subtotal_value * (coalesce(coupon_row.value, 0) / 100);
    elsif coupon_row.type = 'fixed' then
      discount_value := coalesce(coupon_row.value, 0);
    elsif coupon_row.type = 'free_shipping' then
      free_shipping_by_coupon := true;
    end if;
    if coupon_row.max_discount_amount is not null then
      discount_value := least(discount_value, coupon_row.max_discount_amount);
    end if;
    discount_value := greatest(0, least(discount_value, subtotal_value));
  end if;

  select * into settings_row from public.site_settings where id = 'main';
  shipping_fee_value := case
    when free_shipping_by_coupon then 0
    when coalesce(settings_row.free_shipping_threshold, 0) > 0 and subtotal_value >= coalesce(settings_row.free_shipping_threshold, 0) then 0
    else coalesce(settings_row.shipping_fee, 0)
  end;
  total_value := greatest(0, subtotal_value - discount_value + shipping_fee_value);

  for loop_index in 1..12 loop
    order_number_value := 'NXR-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(md5(clock_timestamp()::text || random()::text || coalesce(idempotency_key_value, '')), 1, 6));
    exit when not exists (select 1 from public.orders where order_number = order_number_value);
  end loop;

  insert into public.orders (
    order_number, customer_name, customer_phone, customer_email, governorate, city, address, notes,
    subtotal, discount_total, shipping_fee, total, payment_method, payment_status, order_status, coupon_code,
    idempotency_key, source, visitor_id, session_id, attribution, source_platform, campaign, status_history
  ) values (
    order_number_value,
    trim(coalesce(customer_value->>'fullName', customer_value->>'name', '')),
    phone_value,
    nullif(trim(coalesce(customer_value->>'email', '')), ''),
    trim(coalesce(customer_value->>'governorate', '')),
    trim(coalesce(customer_value->>'city', '')),
    trim(coalesce(customer_value->>'address', '')),
    nullif(trim(coalesce(customer_value->>'notes', payload->>'notes', '')), ''),
    subtotal_value,
    discount_value,
    shipping_fee_value,
    total_value,
    'cod',
    'pending',
    'pending',
    coupon_code_value,
    idempotency_key_value,
    coalesce(payload #>> '{attribution,source}', 'web'),
    nullif(coalesce(payload->>'visitorId', payload #>> '{attribution,visitorId}', ''), ''),
    nullif(coalesce(payload->>'sessionId', payload #>> '{attribution,sessionId}', ''), ''),
    coalesce(payload->'attribution', '{}'::jsonb),
    nullif(coalesce(payload #>> '{attribution,source}', ''), ''),
    nullif(coalesce(payload #>> '{attribution,campaign}', ''), ''),
    jsonb_build_array(jsonb_build_object('status','pending','message','Order received.','timestamp',now(),'updatedBy','system'))
  ) returning * into created_order;

  -- Insert items and decrement stock while rows are still locked by this transaction.
  for item_value in select * from jsonb_array_elements(items_value)
  loop
    product_id_value := nullif(item_value->>'productId', '')::uuid;
    variant_id_value := nullif(item_value->>'variantId', '')::uuid;
    qty_value := greatest(1, coalesce((item_value->>'quantity')::integer, 1));
    size_value := upper(trim(coalesce(item_value->>'size', '')));
    color_value := trim(coalesce(item_value->>'color', ''));

    select * into product_row from public.products where id = product_id_value for update;

    variant_row := null;
    if variant_id_value is not null then
      select * into variant_row from public.product_variants where id = variant_id_value and product_id = product_id_value for update;
    else
      select * into variant_row
      from public.product_variants
      where product_id = product_id_value
        and upper(size) = size_value
        and (color_value = '' or lower(coalesce(color,'')) = lower(color_value))
        and status in ('active','sold_out')
      order by case when lower(coalesce(color,'')) = lower(color_value) then 0 else 1 end, sort_order asc nulls last, created_at asc
      limit 1
      for update;
    end if;

    unit_price := coalesce(product_row.price, 0);
    if variant_row.id is not null then
      before_stock := greatest(coalesce(variant_row.stock, 0) - coalesce(variant_row.reserved_stock, 0), 0);
      after_stock := before_stock - qty_value;
      update public.product_variants
      set stock = greatest(coalesce(stock, 0) - qty_value, 0),
          status = case when greatest(coalesce(stock, 0) - qty_value, 0) <= 0 then 'sold_out' else status end,
          updated_at = now()
      where id = variant_row.id;
      perform public.nexora_sync_product_stock_from_variants(product_id_value);
      variant_id_value := variant_row.id;
    else
      stock_by_size_value := coalesce(product_row.stock_by_size, '{}'::jsonb);
      before_stock := coalesce((stock_by_size_value ->> size_value)::integer, 0);
      after_stock := before_stock - qty_value;
      stock_by_size_value := jsonb_set(stock_by_size_value, array[size_value], to_jsonb(after_stock), true);
      stock_total_value := coalesce((select sum(value::integer) from jsonb_each_text(stock_by_size_value)), 0);
      update public.products
      set stock_by_size = stock_by_size_value,
          stock_total = stock_total_value,
          status = case when stock_total_value <= 0 then 'sold_out' when status = 'sold_out' then 'active' else status end,
          updated_at = now()
      where id = product_id_value;
    end if;

    insert into public.order_items (
      order_id, product_id, variant_id, product_name, slug, size, color, color_hex, color_pattern,
      quantity, unit_price, total, image
    ) values (
      created_order.id,
      product_id_value,
      variant_id_value,
      coalesce(product_row.name_en, item_value->>'name', 'NEXORA Product'),
      coalesce(product_row.slug, item_value->>'slug', ''),
      size_value,
      nullif(color_value, ''),
      nullif(item_value->>'colorHex', ''),
      nullif(item_value->>'colorPattern', ''),
      qty_value,
      unit_price,
      unit_price * qty_value,
      coalesce(item_value->>'image', product_row.images->0->>'public_url', product_row.images->0->>'url', product_row.images->>0, '')
    );

    insert into public.inventory_logs (
      product_id, variant_id, sku, size, change, reason, previous_stock, new_stock, order_id
    ) values (
      product_id_value,
      variant_id_value,
      coalesce(variant_row.sku, product_row.sku),
      size_value,
      -qty_value,
      'order_created',
      before_stock,
      greatest(after_stock, 0),
      created_order.id
    );
  end loop;

  if coupon_code_value is not null then
    update public.coupons
    set used_count = coalesce(used_count, 0) + 1,
        updated_at = now()
    where code = coupon_code_value;
  end if;

  insert into public.order_status_history(order_id, old_status, new_status, note, changed_by)
  values (created_order.id, null, 'pending', 'Order received.', 'system')
  on conflict do nothing;

  update public.lead_profiles
  set status = 'ordered', updated_at = now()
  where id = (
    select id from public.lead_profiles
    where phone = phone_value
    order by created_at desc
    limit 1
  );

  return jsonb_build_object('orderId', created_order.id, 'orderNumber', created_order.order_number, 'total', created_order.total, 'idempotent', false);
end;
$$;
