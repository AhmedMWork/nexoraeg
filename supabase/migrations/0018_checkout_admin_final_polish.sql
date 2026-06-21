-- ============================================================
-- NEXORA — Checkout + Admin Final Polish
-- Fixes COD fee for non-COD payments, safer multi-color order item
-- snapshots, and polished payment/follow-up defaults.
-- ============================================================

-- Recreate payment-aware order wrapper with payment-aware COD fee and safer item matching.
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
  cod_fee_value numeric := 0;
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

  cod_fee_value := case
    when payment_method_value = 'cod' then coalesce((v_shipping_quote->>'codFee')::numeric, 0)
    else 0
  end;

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
      and upper(coalesce(oi.size, '')) = upper(coalesce(item_value->>'size', oi.size, ''))
      and (
        nullif(item_value->>'variantId', '') is null
        or oi.variant_id = nullif(item_value->>'variantId', '')::uuid
      )
      and coalesce(lower(oi.color), '') = coalesce(lower(nullif(item_value->>'color', '')), coalesce(lower(oi.color), ''));
  end loop;

  update public.orders o
  set order_number = new_order_number,
      payment_method = payment_method_value,
      payment_status = payment_status_value,
      payment_confirmation_phone = confirmation_phone_value,
      payment_screenshot_required = screenshot_required_value,
      payment_confirmation_channel = 'whatsapp',
      shipping_fee = coalesce((v_shipping_quote->>'shippingFee')::numeric, shipping_fee),
      cod_fee = cod_fee_value,
      total = greatest(0, subtotal - discount_total + coalesce((v_shipping_quote->>'shippingFee')::numeric, shipping_fee) + cod_fee_value),
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
        'codFee', cod_fee_value,
        'total', greatest(0, subtotal - discount_total + coalesce((v_shipping_quote->>'shippingFee')::numeric, shipping_fee) + cod_fee_value),
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



update public.site_settings
set payment_settings = coalesce(payment_settings, '{}'::jsonb) || jsonb_build_object(
  'confirmationPhone', '01037141322',
  'instapayContact', '01037141322',
  'vodafoneCashNumber', '01037141322',
  'screenshotRequired', true,
  'instructions', 'Manual transfer orders require WhatsApp confirmation. Instapay and Vodafone Cash require a clear screenshot before preparation.',
  'instapayInstructions', 'حوّل قيمة الطلب على رقم NEXORA ثم أرسل Screenshot التحويل على واتساب مع رقم الطلب.',
  'vodafoneCashInstructions', 'حوّل على Vodafone Cash ثم أرسل Screenshot واضح يظهر رقم العملية والمبلغ.',
  'valuInstructions', 'ValU installment requests are confirmed manually on WhatsApp before order preparation.'
)
where id = 'main';

insert into public.nexora_system_migrations(version, title, notes)
values (
  'checkout-admin-final-polish',
  'Checkout + Admin Final Polish',
  'Payment-aware COD totals, safer color/variant item snapshots, clearer manual payment instructions and admin follow-up labels.'
)
on conflict (version) do update
set title = excluded.title,
    notes = excluded.notes,
    applied_at = now();
