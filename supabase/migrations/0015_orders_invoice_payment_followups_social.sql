-- ============================================================
-- NEXORA — Orders Invoice, Manual Payments, Follow-ups, Social Links
-- Safe additive migration for a clean owner-facing orders workflow.
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

-- Loosen older payment check constraints safely so manual payment methods work.
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
  add column if not exists payment_reference text,
  add column if not exists payment_notes text,
  add column if not exists payment_confirmation_phone text default '01037141322',
  add column if not exists payment_confirmed_at timestamptz,
  add column if not exists followup_status text default 'not_contacted',
  add column if not exists invoice_snapshot jsonb not null default '{}'::jsonb;

alter table if exists public.order_items
  add column if not exists product_image_url text,
  add column if not exists product_snapshot jsonb not null default '{}'::jsonb;

update public.order_items
set product_image_url = coalesce(nullif(product_image_url, ''), nullif(image, ''))
where product_image_url is null or product_image_url = '';

create table if not exists public.order_daily_sequences (
  sequence_date date primary key,
  last_number integer not null default 0,
  updated_at timestamptz not null default now()
);

create or replace function public.nexora_next_order_number()
returns text
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  date_key date := current_date;
  next_value integer;
begin
  insert into public.order_daily_sequences(sequence_date, last_number)
  values (date_key, 0)
  on conflict (sequence_date) do nothing;

  update public.order_daily_sequences
  set last_number = last_number + 1,
      updated_at = now()
  where sequence_date = date_key
  returning last_number into next_value;

  return 'NX-' || to_char(date_key, 'YYMMDD') || '-' || lpad(next_value::text, 3, '0');
end;
$$;

create table if not exists public.order_followups (
  id uuid primary key default public.nexora_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  type text not null default 'note',
  note text,
  created_by text default 'studio',
  created_at timestamptz not null default now()
);

create index if not exists idx_order_followups_order_created on public.order_followups(order_id, created_at desc);

alter table if exists public.site_settings
  add column if not exists payment_settings jsonb not null default '{"instapayEnabled":true,"vodafoneCashEnabled":true,"confirmationPhone":"01037141322","instructions":"Payment is confirmed manually on WhatsApp."}'::jsonb,
  add column if not exists social_links jsonb not null default '{}'::jsonb;

update public.site_settings
set social_links = coalesce(social_links, '{}'::jsonb) || jsonb_build_object(
  'facebook', 'https://www.facebook.com/share/18k2uTBtYu/?mibextid=wwXIfr',
  'instagram', 'https://www.instagram.com/nexora.eg_wear?igsh=Zm9zN2ZjZ3Q3Zmlw&utm_source=qr',
  'whatsapp', 'https://wa.me/201037141322'
)
where id = 'main';

update public.site_settings
set payment_settings = coalesce(payment_settings, '{}'::jsonb) || jsonb_build_object(
  'instapayEnabled', true,
  'vodafoneCashEnabled', true,
  'confirmationPhone', '01037141322',
  'instructions', 'Choose Instapay or Vodafone Cash and NEXORA will confirm payment manually on WhatsApp.'
)
where id = 'main';

alter table public.order_followups enable row level security;
drop policy if exists "service role manages order followups" on public.order_followups;
create policy "service role manages order followups" on public.order_followups
for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- Replace shipping-aware order wrapper with invoice/payment/follow-up support.
create or replace function public.nexora_create_order_atomic_v5_4(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
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

  update public.order_items oi
  set product_image_url = coalesce(nullif(oi.product_image_url, ''), nullif(oi.image, '')),
      product_snapshot = jsonb_build_object(
        'productId', oi.product_id,
        'variantId', oi.variant_id,
        'name', oi.product_name,
        'slug', oi.slug,
        'size', oi.size,
        'color', oi.color,
        'image', coalesce(nullif(oi.product_image_url, ''), nullif(oi.image, '')),
        'unitPrice', oi.unit_price,
        'quantity', oi.quantity,
        'lineTotal', oi.total
      )
  where oi.order_id = order_id_value;

  update public.orders o
  set order_number = new_order_number,
      payment_method = payment_method_value,
      payment_status = payment_status_value,
      payment_confirmation_phone = confirmation_phone_value,
      shipping_fee = coalesce((v_shipping_quote->>'shippingFee')::numeric, shipping_fee),
      cod_fee = coalesce((v_shipping_quote->>'codFee')::numeric, 0),
      total = greatest(0, subtotal - discount_total + coalesce((v_shipping_quote->>'shippingFee')::numeric, shipping_fee) + coalesce((v_shipping_quote->>'codFee')::numeric, 0)),
      delivery_estimate = v_shipping_quote->>'deliveryEstimate',
      shipping_provider = v_shipping_quote->>'provider',
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
        'shipping', v_shipping_quote
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

do $nexora_record_release$
begin
  if to_regclass('public.nexora_system_migrations') is not null then
    if exists (select 1 from information_schema.columns where table_schema='public' and table_name='nexora_system_migrations' and column_name='notes') then
      insert into public.nexora_system_migrations(version, title, notes)
      values ('orders-payment-followups-social', 'Orders Invoice + Manual Payments', 'Adds order invoice snapshots, item images, follow-up timeline, manual payment methods, compact order code, and social links.')
      on conflict (version) do update set title = excluded.title, notes = excluded.notes, applied_at = now();
    elsif exists (select 1 from information_schema.columns where table_schema='public' and table_name='nexora_system_migrations' and column_name='summary') then
      insert into public.nexora_system_migrations(version, summary)
      values ('orders-payment-followups-social', 'Adds order invoice snapshots, manual payment methods, follow-up timeline and social links.')
      on conflict (version) do update set summary = excluded.summary, applied_at = now();
    end if;
  end if;
end
$nexora_record_release$;
