-- NEXORA V5.1 — Admin Arabic HQ + order editing support
-- Safe additive migration. It does not reset or remove existing production data.

alter table if exists public.orders
  add column if not exists cod_fee numeric default 0,
  add column if not exists payment_reference text,
  add column if not exists payment_notes text,
  add column if not exists payment_confirmation_phone text default '01037141322',
  add column if not exists followup_status text default 'not_contacted';

create table if not exists public.order_edit_history (
  id uuid primary key default public.nexora_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  field_changed text not null default 'order',
  old_value jsonb default '{}'::jsonb,
  new_value jsonb default '{}'::jsonb,
  changed_by text default 'studio',
  reason text,
  created_at timestamptz default now()
);

create index if not exists order_edit_history_order_created_idx on public.order_edit_history(order_id, created_at desc);

alter table public.order_edit_history enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'order_edit_history' and policyname = 'order_edit_history_service_role_all'
  ) then
    create policy "order_edit_history_service_role_all"
      on public.order_edit_history
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;

insert into public.order_followup_types(type, label, sort_order)
values
  ('order_edited', 'تم تعديل الطلب', 5),
  ('address_updated', 'تم تعديل العنوان', 6),
  ('items_updated', 'تم تعديل المنتجات', 7)
on conflict (type) do update set label = excluded.label, sort_order = excluded.sort_order;
