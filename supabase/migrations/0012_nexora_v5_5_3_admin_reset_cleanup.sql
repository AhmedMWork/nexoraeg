-- ============================================================
-- NEXORA V5.5.3 — Clean Light Admin Reset + Supabase Cleanup
-- Safe, additive migration. No destructive changes.
-- ============================================================

-- Keep pgcrypto explicitly enabled for older projects even though checkout no longer relies on gen_random_bytes.
do $$ begin create extension if not exists pgcrypto with schema extensions; exception when others then raise notice 'pgcrypto unavailable: %', sqlerrm; end $$;

-- Lightweight migration ledger for owner/support diagnostics.
create table if not exists public.nexora_system_migrations (
  version text primary key,
  title text not null,
  notes text,
  applied_at timestamptz not null default now()
);

insert into public.nexora_system_migrations (version, title, notes)
values (
  '5.5.3',
  'Clean Light Admin Reset + Checkout Confidence',
  'Owner-facing admin navigation reduced; technical diagnostics kept under Setup & Recovery; checkout cart storage bumped to avoid stale reset carts.'
)
on conflict (version) do update
set title = excluded.title,
    notes = excluded.notes,
    applied_at = now();

-- Make free shipping messaging opt-in and explicit forever.
alter table if exists public.shipping_settings
  add column if not exists show_free_shipping_progress boolean not null default false,
  add column if not exists free_shipping_progress_message text not null default 'Add {amount} more for free shipping.';

update public.shipping_settings
set show_free_shipping_progress = false
where show_free_shipping_progress is null;

-- Indexes for admin daily dashboard and checkout diagnostics.
create index if not exists idx_orders_status_created_at on public.orders (status, created_at desc);
create index if not exists idx_orders_shipping_status_created_at on public.orders (shipping_status, created_at desc);
create index if not exists idx_product_variants_product_status_stock on public.product_variants (product_id, status, stock);
create index if not exists idx_visitor_events_created_event on public.visitor_events (created_at desc, event_name);
create index if not exists idx_leads_status_created_at on public.leads (status, created_at desc);

comment on table public.nexora_system_migrations is 'NEXORA additive release ledger used by Setup & Recovery to explain deployed release state.';
comment on column public.shipping_settings.show_free_shipping_progress is 'Owner-controlled toggle. Checkout must not show free shipping progress unless this is true.';
