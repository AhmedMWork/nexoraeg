-- NEXORA Experience Upgrade — Admin English labels and order timeline hardening
-- Safe additive/label-only migration. No resets and no destructive changes.

insert into public.order_followup_types(type, label, sort_order)
values
  ('whatsapp_sent', 'WhatsApp sent', 1),
  ('reminder_sent', 'Reminder sent', 2),
  ('second_followup', 'Additional reminder', 3),
  ('called', 'Called', 4),
  ('no_answer', 'No answer', 5),
  ('confirmed', 'Confirmed', 6),
  ('payment_received', 'Payment confirmed', 7),
  ('waiting_screenshot', 'Waiting payment proof', 8),
  ('valu_followup', 'ValU follow-up', 9),
  ('order_edited', 'Order edited', 10),
  ('address_updated', 'Address updated', 11),
  ('items_updated', 'Items updated', 12),
  ('shipblu', 'Shipping update', 13),
  ('note', 'Internal note', 99)
on conflict (type) do update
set label = excluded.label,
    sort_order = excluded.sort_order;

create index if not exists order_followups_order_created_idx
  on public.order_followups(order_id, created_at desc);

create index if not exists order_edit_history_order_created_idx
  on public.order_edit_history(order_id, created_at desc);
