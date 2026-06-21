-- ============================================================
-- NEXORA — Product, Orders, Meta Pixel, Policy Upgrade
-- Safe additive migration after reset/push.
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

alter table if exists public.product_variants
  add column if not exists size_label text,
  add column if not exists weight_range text;

alter table if exists public.order_items
  add column if not exists size_label text,
  add column if not exists weight_range text,
  add column if not exists product_image_url text,
  add column if not exists product_snapshot jsonb not null default '{}'::jsonb;

alter table if exists public.site_settings
  add column if not exists meta_pixel_enabled boolean not null default false,
  add column if not exists meta_pixel_id text,
  add column if not exists return_policy_text text,
  add column if not exists shipping_policy_text text,
  add column if not exists social_links jsonb not null default '{}'::jsonb,
  add column if not exists payment_settings jsonb not null default '{}'::jsonb;

alter table if exists public.shipping_settings
  alter column fallback_delivery_estimate set default '4-7 business days';

update public.shipping_settings
set fallback_delivery_estimate = '4-7 business days'
where fallback_delivery_estimate is null
   or fallback_delivery_estimate ilike '%2-%'
   or fallback_delivery_estimate ilike '%3-%';

update public.shipping_zones
set delivery_estimate = '4-7 business days'
where delivery_estimate is null
   or delivery_estimate ilike '%2-%'
   or delivery_estimate ilike '%3-%';

update public.site_settings
set social_links = coalesce(social_links, '{}'::jsonb) || jsonb_build_object(
      'facebook', 'https://www.facebook.com/share/18k2uTBtYu/?mibextid=wwXIfr',
      'instagram', 'https://www.instagram.com/nexora.eg_wear?igsh=Zm9zN2ZjZ3Q3Zmlw&utm_source=qr',
      'whatsapp', 'https://wa.me/201037141322'
    ),
    payment_settings = coalesce(payment_settings, '{}'::jsonb) || jsonb_build_object(
      'instapayEnabled', true,
      'vodafoneCashEnabled', true,
      'confirmationPhone', '01037141322',
      'instructions', 'Instapay and Vodafone Cash are confirmed manually on WhatsApp.',
      'metaPixelEnabled', coalesce(meta_pixel_enabled, false),
      'metaPixelId', coalesce(meta_pixel_id, '')
    ),
    return_policy_text = coalesce(return_policy_text, '• الاسترجاع متاح فقط أثناء تواجد مندوب الشحن.
• يُرجى مراجعة الطلب جيدًا قبل مغادرة المندوب، ولا يُقبل الاسترجاع بعد ذلك.
• في حالة وجود مشكلة في الطباعة، يمكن استرجاع المنتج خلال 14 يومًا من الاستلام.
• الاستبدال متاح خلال 5 أيام من الاستلام عبر التواصل على واتساب.
• لا يمكن تقسيم الطلب - يتم استلامه أو استرجاعه كاملًا.
• المنتجات المخفضة تُسترجع فقط وقت التسليم ولا يُسمح باستبدالها.
• مدة الشحن: من 4 إلى 7 أيام عمل، عدا الجمعة والعطلات الرسمية.'),
    shipping_policy_text = coalesce(shipping_policy_text, 'مدة الشحن: من 4 إلى 7 أيام عمل، عدا الجمعة والعطلات الرسمية.')
where id = 'main';

-- Enrich existing order items if this migration runs on a live database.
update public.order_items oi
set product_image_url = coalesce(nullif(oi.product_image_url, ''), nullif(oi.image, '')),
    size_label = coalesce(nullif(oi.size_label, ''), oi.size),
    weight_range = coalesce(
      nullif(oi.weight_range, ''),
      case upper(coalesce(oi.size, ''))
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
    ),
    product_snapshot = coalesce(oi.product_snapshot, '{}'::jsonb) || jsonb_build_object(
      'name', oi.product_name,
      'size', oi.size,
      'sizeLabel', coalesce(nullif(oi.size_label, ''), oi.size),
      'weightRange', coalesce(nullif(oi.weight_range, ''), ''),
      'color', oi.color,
      'image', coalesce(nullif(oi.product_image_url, ''), nullif(oi.image, '')),
      'quantity', oi.quantity,
      'unitPrice', oi.unit_price,
      'lineTotal', oi.total
    );

-- Server-side order wrapper with payment, shipping, invoice snapshots and weight labels.
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
  confirmation_phone_value text := coalesce(payload->>'paymentConfirmationPhone', '01037141322');
  v_size_label text;
  v_weight_range text;
begin
  if payment_method_value not in ('cod', 'instapay', 'vodafone_cash') then
    raise exception 'Unsupported payment method.';
  end if;

  payment_status_value := case when payment_method_value = 'cod' then 'pending' else 'pending_confirmation' end;

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
      and coalesce(oi.variant_id::text, '') = coalesce(nullif(item_value->>'variantId',''), coalesce(oi.variant_id::text, ''))
      and upper(coalesce(oi.size, '')) = upper(coalesce(item_value->>'size', oi.size, ''));
  end loop;

  update public.orders o
  set order_number = new_order_number,
      payment_method = payment_method_value,
      payment_status = payment_status_value,
      payment_confirmation_phone = confirmation_phone_value,
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
  values (order_id_value, 'order_created', 'Order created. Awaiting customer confirmation.', 'system')
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
  'product-orders-pixel-policy-upgrade',
  'Product Orders Pixel Policy Upgrade',
  'Adds product size-weight labels, separate admin order page readiness, Meta Pixel settings, policy text, and richer invoice snapshots.'
)
on conflict (version) do update
set title = excluded.title,
    notes = excluded.notes,
    applied_at = now();
