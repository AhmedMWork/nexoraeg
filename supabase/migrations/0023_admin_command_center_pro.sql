-- NEXORA Admin Command Center Pro
-- Additive-only migration: prepares roles, saved views, notifications and report preferences.
-- It does not remove existing permissions or change current owner access.

create table if not exists public.admin_role_presets (
  id uuid primary key default gen_random_uuid(),
  role_key text not null unique,
  label text not null,
  description text,
  permissions jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_saved_views (
  id uuid primary key default gen_random_uuid(),
  view_key text not null,
  label text not null,
  page text not null,
  filters jsonb not null default '{}'::jsonb,
  is_default boolean not null default false,
  sort_order integer not null default 100,
  created_by text default 'studio',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(page, view_key)
);

create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  notification_type text not null,
  title text not null,
  body text,
  target_path text,
  severity text not null default 'info',
  is_read boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

insert into public.admin_role_presets (role_key, label, description, permissions, sort_order)
values
  ('owner', 'Owner', 'Full access. Existing admin capabilities remain available.', '["*"]'::jsonb, 10),
  ('manager', 'Manager', 'Daily operations, catalog, reviews and reports.', '["view_dashboard","view_orders","edit_orders","create_shipments","manage_products","manage_reviews","view_reports"]'::jsonb, 20),
  ('orders_manager', 'Orders Manager', 'Order fulfillment, payment confirmation and follow-up history.', '["view_orders","edit_orders","mark_paid","create_shipments","print_invoices","add_followups"]'::jsonb, 30),
  ('inventory_manager', 'Inventory Manager', 'Catalog, variants and stock control.', '["view_products","edit_products","edit_inventory","manage_variants"]'::jsonb, 40),
  ('marketing_manager', 'Marketing Manager', 'Campaigns, coupons, storefront and analytics.', '["manage_campaigns","manage_coupons","edit_storefront","view_analytics","view_reports"]'::jsonb, 50),
  ('viewer', 'Viewer', 'Read-only access to dashboards, reports and operations.', '["view_dashboard","view_orders","view_products","view_reports"]'::jsonb, 60)
on conflict (role_key) do update set
  label = excluded.label,
  description = excluded.description,
  permissions = excluded.permissions,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.admin_saved_views (view_key, label, page, filters, is_default, sort_order)
values
  ('new_orders', 'New Orders', 'orders', '{"status":"pending"}'::jsonb, true, 10),
  ('waiting_payment_proof', 'Waiting Payment Proof', 'orders', '{"paymentStatus":"waiting_transfer"}'::jsonb, false, 20),
  ('valu_followup', 'ValU Follow-up', 'orders', '{"paymentMethod":"valu"}'::jsonb, false, 30),
  ('ready_to_ship', 'Ready to Ship', 'orders', '{"status":["confirmed","preparing","packed"],"shippingStatus":"not_created"}'::jsonb, false, 40),
  ('delayed_orders', 'Delayed Orders', 'orders', '{"age":"48h","status":["pending","confirmed","preparing"]}'::jsonb, false, 50)
on conflict (page, view_key) do update set
  label = excluded.label,
  filters = excluded.filters,
  is_default = excluded.is_default,
  sort_order = excluded.sort_order,
  updated_at = now();

create index if not exists idx_admin_notifications_read_created on public.admin_notifications (is_read, created_at desc);
create index if not exists idx_admin_saved_views_page_order on public.admin_saved_views (page, sort_order);

alter table public.admin_role_presets enable row level security;
alter table public.admin_saved_views enable row level security;
alter table public.admin_notifications enable row level security;

do $$ begin
  create policy "admin_role_presets_service_only" on public.admin_role_presets for all using (false) with check (false);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "admin_saved_views_service_only" on public.admin_saved_views for all using (false) with check (false);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "admin_notifications_service_only" on public.admin_notifications for all using (false) with check (false);
exception when duplicate_object then null; end $$;
