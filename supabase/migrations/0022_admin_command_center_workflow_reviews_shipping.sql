-- NEXORA Admin Command Center Upgrade
-- Dynamic order workflow, dynamic follow-up types, customer review submission, and manual shipment fallback.

create table if not exists public.order_statuses (
  id uuid primary key default gen_random_uuid(),
  status_key text unique not null,
  label text not null,
  description text,
  color text default 'stone',
  sort_order integer default 0,
  is_active boolean default true,
  is_default boolean default false,
  is_final boolean default false,
  next_status_key text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.followup_types (
  id uuid primary key default gen_random_uuid(),
  type_key text unique not null,
  label text not null,
  description text,
  icon text default 'StickyNote',
  color text default 'stone',
  sort_order integer default 0,
  is_active boolean default true,
  is_quick_action boolean default false,
  template_text text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

insert into public.order_statuses (status_key, label, description, color, sort_order, is_active, is_default, is_final, next_status_key)
values
  ('pending', 'Pending', 'New order waiting for confirmation.', 'amber', 10, true, true, false, 'confirmed'),
  ('confirmed', 'Confirmed', 'Customer details and payment path are confirmed.', 'blue', 20, true, false, false, 'preparing'),
  ('preparing', 'Preparing', 'Items are being prepared by the team.', 'purple', 30, true, false, false, 'packed'),
  ('packed', 'Packed', 'Order is packed and ready for courier handoff.', 'indigo', 40, true, false, false, 'shipped'),
  ('shipped', 'Shipped', 'Shipment has left NEXORA.', 'cyan', 50, true, false, false, 'out_for_delivery'),
  ('out_for_delivery', 'Out for Delivery', 'Courier is delivering the order.', 'sky', 60, true, false, false, 'delivered'),
  ('delivered', 'Delivered', 'Order was delivered successfully.', 'green', 70, true, false, true, null),
  ('cancelled', 'Cancelled', 'Order was cancelled before completion.', 'red', 80, true, false, true, null),
  ('returned', 'Returned', 'Order was returned after delivery.', 'stone', 90, true, false, true, null)
on conflict (status_key) do update set
  label = excluded.label,
  description = excluded.description,
  color = excluded.color,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  is_default = excluded.is_default,
  is_final = excluded.is_final,
  next_status_key = excluded.next_status_key,
  updated_at = now();

insert into public.followup_types (type_key, label, description, icon, color, sort_order, is_active, is_quick_action, template_text)
values
  ('whatsapp_sent', 'WhatsApp Sent', 'A WhatsApp message was sent to the customer.', 'MessageCircle', 'green', 10, true, true, 'WhatsApp message sent.'),
  ('additional_reminder', 'Additional Reminder', 'A follow-up reminder was sent.', 'Bell', 'amber', 20, true, true, 'Additional reminder sent.'),
  ('payment_confirmed', 'Payment Confirmed', 'Payment was confirmed by the team.', 'CheckCircle', 'emerald', 30, true, true, 'Payment confirmed.'),
  ('payment_proof_received', 'Payment Proof Received', 'Customer sent a transfer screenshot or proof.', 'ReceiptText', 'blue', 40, true, true, 'Payment proof received on WhatsApp.'),
  ('shipping_update', 'Shipping Update', 'Shipment status or delivery details changed.', 'Truck', 'cyan', 50, true, true, 'Shipping update sent.'),
  ('no_answer', 'No Answer', 'Customer did not answer the follow-up.', 'PhoneOff', 'red', 60, true, true, 'Customer did not answer.'),
  ('valu_confirmed', 'ValU Confirmed', 'ValU installment confirmation was completed.', 'CreditCard', 'purple', 70, true, true, 'ValU installment details confirmed.'),
  ('customer_requested_change', 'Customer Requested Change', 'Customer requested an order edit.', 'Edit3', 'orange', 80, true, false, 'Customer requested order changes.'),
  ('order_edited', 'Order Edited', 'Order details were updated by admin.', 'Edit3', 'gold', 90, true, false, 'Order edited.'),
  ('status_update', 'Status Update', 'Order status changed.', 'Activity', 'slate', 100, true, false, 'Order status updated.'),
  ('note', 'Internal Note', 'Internal team note.', 'StickyNote', 'stone', 110, true, false, 'Internal note added.')
on conflict (type_key) do update set
  label = excluded.label,
  description = excluded.description,
  icon = excluded.icon,
  color = excluded.color,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  is_quick_action = excluded.is_quick_action,
  template_text = excluded.template_text,
  updated_at = now();

-- Normalize legacy follow-up type names without losing history.
update public.order_followups set type = 'additional_reminder' where type = 'second_followup';
update public.order_followups set type = 'payment_confirmed' where type = 'payment_received';
update public.order_followups set type = 'shipping_update' where type = 'shipblu';
update public.order_followups set type = 'payment_proof_received' where type = 'waiting_screenshot';

alter table public.reviews drop constraint if exists reviews_status_check;
alter table public.reviews add constraint reviews_status_check check (status in ('draft','pending','published','rejected','hidden','archived'));

alter table public.reviews add column if not exists review_type text default 'product';
alter table public.reviews add column if not exists customer_phone text;
alter table public.reviews add column if not exists admin_reply text;
alter table public.reviews add column if not exists approved_at timestamptz;
alter table public.reviews add column if not exists metadata jsonb default '{}'::jsonb;

update public.reviews set review_type = case when product_id is null then 'site' else 'product' end where review_type is null;

create index if not exists order_statuses_sort_idx on public.order_statuses (sort_order);
create index if not exists followup_types_sort_idx on public.followup_types (sort_order);
create index if not exists reviews_status_idx on public.reviews (status);
create index if not exists reviews_product_status_idx on public.reviews (product_id, status);
