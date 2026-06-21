-- ============================================================
-- NEXORA — Storefront Tiles + Premium Manual Payments Upgrade
-- Safe additive migration for seasonal storefront control and
-- refined COD / Instapay / Vodafone Cash / ValU payment flow.
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
    substr(value, 1, 8) || '-' || substr(value, 9, 4) || '-4' || substr(value, 14, 3) || '-' ||
    substr('89ab', floor(random() * 4)::int + 1, 1) || substr(value, 18, 3) || '-' || substr(value, 21, 12)
  )::uuid;
end;
$$;

-- Remove older restrictive payment constraints so ValU can be accepted.
do $nexora_drop_payment_checks$
declare
  r record;
begin
  for r in
    select conname
    from pg_constraint
    where conrelid = 'public.orders'::regclass
      and contype = 'c'
      and (
        pg_get_constraintdef(oid) ilike '%payment_method%'
        or pg_get_constraintdef(oid) ilike '%payment_status%'
      )
  loop
    execute format('alter table public.orders drop constraint if exists %I', r.conname);
  end loop;
end
$nexora_drop_payment_checks$;

alter table if exists public.orders
  add column if not exists payment_screenshot_required boolean not null default false,
  add column if not exists payment_confirmation_channel text default 'whatsapp',
  add column if not exists payment_followup_count integer not null default 0;

alter table if exists public.site_settings
  add column if not exists social_links jsonb not null default '{}'::jsonb,
  add column if not exists payment_settings jsonb not null default '{}'::jsonb,
  add column if not exists home_collection_tiles jsonb;

-- Default premium social/payment settings. Owner can edit from Studio.
update public.site_settings
set social_links = coalesce(social_links, '{}'::jsonb) || jsonb_build_object(
      'facebook', 'https://www.facebook.com/share/18k2uTBtYu/?mibextid=wwXIfr',
      'instagram', 'https://www.instagram.com/nexora.eg_wear?igsh=Zm9zN2ZjZ3Q3Zmlw&utm_source=qr',
      'whatsapp', 'https://wa.me/201037141322'
    ),
    payment_settings = coalesce(payment_settings, '{}'::jsonb) || jsonb_build_object(
      'codEnabled', true,
      'instapayEnabled', true,
      'vodafoneCashEnabled', true,
      'valuEnabled', true,
      'confirmationPhone', '01037141322',
      'instapayContact', '01037141322',
      'vodafoneCashNumber', '01037141322',
      'screenshotRequired', true,
      'instructions', 'Manual payments are confirmed on WhatsApp. Customer must send a transfer screenshot for Instapay or Vodafone Cash.',
      'valuInstructions', 'ValU installment requests are confirmed manually on WhatsApp before processing.'
    ),
    home_collection_tiles = coalesce(home_collection_tiles, jsonb_build_array(
      jsonb_build_object('id','oversized-tees','title','Oversized Tees','titleAr','تيشيرتات واسعة','href','/shop/unisex','image','/assets/products/women-sand-tee.jpg','eyebrow','Explore','isVisible',true,'season','all','sortOrder',1),
      jsonb_build_object('id','core-essentials','title','Core Essentials','titleAr','أساسيات يومية','href','/shop','image','/assets/products/men-cream-tee.jpg','eyebrow','Explore','isVisible',true,'season','all','sortOrder',2),
      jsonb_build_object('id','limited-drop','title','Limited Drop','titleAr','الإصدارات المحدودة','href','/limited','image','/assets/nexora-logo-bg.jpg','eyebrow','Explore','isVisible',true,'season','all','sortOrder',3),
      jsonb_build_object('id','last-pieces','title','Last Pieces','titleAr','آخر القطع','href','/shop?availability=last-pieces','image','/assets/products/men-black-tee.jpg','eyebrow','Explore','isVisible',true,'season','all','sortOrder',4)
    ))
where id = 'main';

-- Normalize existing storefront tiles: max 5, visible by default, seasonal metadata.
update public.site_settings
set home_collection_tiles = (
  select coalesce(jsonb_agg(
    tile || jsonb_build_object(
      'isVisible', coalesce((tile->>'isVisible')::boolean, true),
      'season', coalesce(nullif(tile->>'season', ''), 'all'),
      'sortOrder', coalesce(nullif(tile->>'sortOrder', '')::int, ordinality),
      'deletedAt', case when tile ? 'deletedAt' then tile->'deletedAt' else 'null'::jsonb end
    )
    order by coalesce(nullif(tile->>'sortOrder', '')::int, ordinality)
  ), '[]'::jsonb)
  from jsonb_array_elements(coalesce(home_collection_tiles, '[]'::jsonb)) with ordinality as x(tile, ordinality)
  where ordinality <= 5
)
where id = 'main';

-- Recreate payment-aware order wrapper with ValU and screenshot confirmation.
create or replace function public.nexora_create_order_atomic_v5_4(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  result jsonb;
  v_shipping_quote jsonb;
  order_id_value uuid;
  new_order_number text;
  customer_value jsonb := coalesce(payload->'customer', '{}'::jsonb);
  coupon_free boolean := false;
  coupon_code_value text := nullif(upper(trim(coalesce(payload->>'couponCode', ''))), '');
  coupon_row record;
  subtotal_estimate numeric := 0;
  item_value jsonb;
  product_row record;
  payment_method_value text := lower(trim(coalesce(payload->>'paymentMethod', 'cod')));
  payment_status_value text;
  confirmation_phone_value text := coalesce(nullif(payload->>'paymentConfirmationPhone', ''), '01037141322');
  screenshot_required_value boolean := false;
  v_size_label text;
  v_weight_range text;
begin
  if payment_method_value not in ('cod', 'instapay', 'vodafone_cash', 'valu') then
    raise exception 'Unsupported payment method.';
  end if;

  payment_status_value := case
    when payment_method_value = 'cod' then 'pending'
    when payment_method_value = 'valu' then 'pending_confirmation'
    else 'waiting_transfer'
  end;
  screenshot_required_value := payment_method_value in ('instapay', 'vodafone_cash');

  for item_value in select * from jsonb_array_elements(coalesce(payload->'items', '[]'::jsonb)) loop
    select price into product_row from public.products where id = nullif(item_value->>'productId','')::uuid;
    subtotal_estimate := subtotal_estimate + coalesce(product_row.price, 0) * greatest(1, coalesce((item_value->>'quantity')::integer, 1));
  end loop;

  if coupon_code_value is not null then
    select * into coupon_row from public.coupons where code = coupon_code_value and status = 'active';
    coupon_free := coalesce(coupon_row.type = 'free_shipping', false);
  end if;

  v_shipping_quote := public.nexora_calculate_shipping_v5_4(customer_value->>'governorate', customer_value->>'city', subtotal_estimate, coupon_free);
  if coalesce((v_shipping_quote->>'available')::boolean, false) is false then
    raise exception '%', coalesce(v_shipping_quote->>'reason', 'Shipping is not available.');
  end if;

  result := public.nexora_create_order_atomic_v5_3(payload || jsonb_build_object('shippingQuote', v_shipping_quote));
  order_id_value := nullif(result->>'orderId','')::uuid;
  new_order_number := public.nexora_next_order_number();

  for item_value in select * from jsonb_array_elements(coalesce(payload->'items', '[]'::jsonb)) loop
    v_weight_range := coalesce(
      nullif(item_value->>'weightRange', ''),
      case upper(coalesce(item_value->>'size', ''))
        when 'S' then '50-65KG'
        when 'SMALL' then '50-65KG'
        when 'M' then '65-75KG'
        when 'MEDIUM' then '65-75KG'
        when 'L' then '75-85KG'
        when 'LARGE' then '75-85KG'
        when 'XL' then '85-95KG'
        when 'XXL' then '95-110KG'
        when '2XL' then '95-110KG'
        else null
      end
    );
    v_size_label := coalesce(nullif(item_value->>'sizeLabel', ''), case when v_weight_range is not null then coalesce(item_value->>'size','') || ' (' || v_weight_range || ')' else item_value->>'size' end);

    update public.order_items oi
    set product_image_url = coalesce(nullif(item_value->>'image', ''), nullif(oi.image, ''), nullif(oi.product_image_url, '')),
        size_label = v_size_label,
        weight_range = v_weight_range,
        product_snapshot = jsonb_build_object(
          'productId', oi.product_id,
          'variantId', oi.variant_id,
          'name', oi.product_name,
          'slug', oi.slug,
          'size', oi.size,
          'sizeLabel', v_size_label,
          'weightRange', v_weight_range,
          'color', oi.color,
          'image', coalesce(nullif(item_value->>'image', ''), nullif(oi.image, ''), nullif(oi.product_image_url, '')),
          'unitPrice', oi.unit_price,
          'quantity', oi.quantity,
          'lineTotal', oi.total
        )
    where oi.order_id = order_id_value
      and oi.product_id = nullif(item_value->>'productId','')::uuid
      and upper(coalesce(oi.size, '')) = upper(coalesce(item_value->>'size', oi.size, ''));
  end loop;

  update public.orders o
  set order_number = new_order_number,
      payment_method = payment_method_value,
      payment_status = payment_status_value,
      payment_confirmation_phone = confirmation_phone_value,
      payment_screenshot_required = screenshot_required_value,
      payment_confirmation_channel = 'whatsapp',
      shipping_fee = coalesce((v_shipping_quote->>'shippingFee')::numeric, shipping_fee),
      cod_fee = coalesce((v_shipping_quote->>'codFee')::numeric, 0),
      total = greatest(0, subtotal - discount_total + coalesce((v_shipping_quote->>'shippingFee')::numeric, shipping_fee) + coalesce((v_shipping_quote->>'codFee')::numeric, 0)),
      delivery_estimate = coalesce(v_shipping_quote->>'deliveryEstimate', '4-7 business days'),
      shipping_provider = coalesce(v_shipping_quote->>'provider', 'shipblu'),
      shipping_quote = v_shipping_quote,
      followup_status = 'not_contacted',
      invoice_snapshot = jsonb_build_object(
        'orderNumber', new_order_number,
        'customer', jsonb_build_object('name', customer_name, 'phone', customer_phone, 'governorate', governorate, 'city', city, 'address', address),
        'paymentMethod', payment_method_value,
        'paymentStatus', payment_status_value,
        'paymentScreenshotRequired', screenshot_required_value,
        'confirmationPhone', confirmation_phone_value,
        'subtotal', subtotal,
        'discount', discount_total,
        'shippingFee', coalesce((v_shipping_quote->>'shippingFee')::numeric, shipping_fee),
        'codFee', coalesce((v_shipping_quote->>'codFee')::numeric, 0),
        'total', greatest(0, subtotal - discount_total + coalesce((v_shipping_quote->>'shippingFee')::numeric, shipping_fee) + coalesce((v_shipping_quote->>'codFee')::numeric, 0)),
        'shipping', v_shipping_quote,
        'deliveryPolicy', '4-7 business days, excluding Fridays and official holidays.'
      ),
      updated_at = now()
  where o.id = order_id_value;

  insert into public.order_followups(order_id, type, note, created_by)
  values (
    order_id_value,
    'order_created',
    case
      when payment_method_value = 'instapay' then 'Order created. Waiting for Instapay/bank transfer screenshot on WhatsApp.'
      when payment_method_value = 'vodafone_cash' then 'Order created. Waiting for Vodafone Cash screenshot on WhatsApp.'
      when payment_method_value = 'valu' then 'Order created. Customer selected ValU installments. Confirm manually on WhatsApp.'
      else 'Order created. Awaiting customer confirmation.'
    end,
    'system'
  )
  on conflict do nothing;

  select jsonb_build_object(
    'orderId', id,
    'orderNumber', order_number,
    'total', total,
    'shippingFee', shipping_fee,
    'codFee', cod_fee,
    'deliveryEstimate', delivery_estimate,
    'paymentMethod', payment_method,
    'paymentStatus', payment_status,
    'paymentScreenshotRequired', payment_screenshot_required,
    'idempotent', coalesce((result->>'idempotent')::boolean, false),
    'shipping', v_shipping_quote
  )
  into result
  from public.orders
  where id = order_id_value;

  return result;
end;
$$;

insert into public.nexora_system_migrations(version, title, notes)
values (
  'storefront-tiles-payment-methods-upgrade',
  'Storefront Tiles + Premium Manual Payments Upgrade',
  'Adds max-5 visible/hidden seasonal storefront tiles, ValU manual payments, screenshot-required transfer flow, and premium WhatsApp confirmation defaults.'
)
on conflict (version) do update
set title = excluded.title,
    notes = excluded.notes,
    applied_at = now();
