-- ============================================================
-- NEXORA V5 Pro — Payment settings + order events foundation
-- Backward-compatible: extends jsonb settings and adds optional
-- operational tables without changing existing checkout signatures.
-- ============================================================

create table if not exists public.payment_methods_config (
  method text primary key check (method in ('cod', 'instapay', 'vodafone_cash', 'valu')),
  enabled boolean not null default true,
  display_name text not null,
  instructions_ar text not null default '',
  instructions_en text not null default '',
  requires_screenshot boolean not null default false,
  requires_manual_confirmation boolean not null default false,
  initial_payment_status text not null default 'pending',
  sort_order integer not null default 100,
  updated_at timestamptz not null default now()
);

create table if not exists public.whatsapp_templates (
  id uuid primary key default gen_random_uuid(),
  template_key text not null unique,
  title text not null,
  body_ar text not null,
  body_en text not null default '',
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  event_type text not null,
  title text not null,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_by text not null default 'system',
  created_at timestamptz not null default now()
);

create index if not exists order_events_order_created_idx on public.order_events(order_id, created_at desc);

alter table public.payment_methods_config enable row level security;
alter table public.whatsapp_templates enable row level security;
alter table public.order_events enable row level security;

-- Public read keeps checkout display configurable. Admin writes still go through Edge Functions/service role.
do $$ begin
  create policy "payment_methods_config_public_read" on public.payment_methods_config for select using (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "whatsapp_templates_public_enabled_read" on public.whatsapp_templates for select using (enabled = true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "order_events_service_role_all" on public.order_events for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
exception when duplicate_object then null;
end $$;

insert into public.payment_methods_config(method, enabled, display_name, instructions_ar, instructions_en, requires_screenshot, requires_manual_confirmation, initial_payment_status, sort_order)
values
  ('cod', true, 'الدفع عند الاستلام', 'سيتم تأكيد الطلب معك على واتساب قبل التجهيز. برجاء التأكد من أن رقم الهاتف صحيح ومتاح للتواصل.', 'Pay cash on delivery after WhatsApp confirmation.', false, true, 'pending', 10),
  ('instapay', true, 'Instapay / تحويل بنكي', 'حوّل قيمة الطلب على رقم NEXORA ثم أرسل Screenshot التحويل على واتساب مع رقم الطلب.', 'Transfer via Instapay and send a clear screenshot on WhatsApp.', true, true, 'waiting_transfer', 20),
  ('vodafone_cash', true, 'Vodafone Cash', 'حوّل على Vodafone Cash ثم أرسل Screenshot واضح يظهر رقم العملية والمبلغ.', 'Transfer via Vodafone Cash and send a clear screenshot showing transaction number and amount.', true, true, 'waiting_transfer', 30),
  ('valu', true, 'ValU Installments', 'لا تقم بأي تحويل قبل التواصل معك وتأكيد تفاصيل التقسيط.', 'ValU installments are confirmed manually on WhatsApp before preparation.', false, true, 'pending_confirmation', 40)
on conflict (method) do update
set display_name = excluded.display_name,
    instructions_ar = excluded.instructions_ar,
    instructions_en = excluded.instructions_en,
    requires_screenshot = excluded.requires_screenshot,
    requires_manual_confirmation = excluded.requires_manual_confirmation,
    initial_payment_status = excluded.initial_payment_status,
    sort_order = excluded.sort_order,
    updated_at = now();

insert into public.whatsapp_templates(template_key, title, body_ar, body_en)
values
  ('order_confirmation', 'Order confirmation', 'أهلاً NEXORA، تم تسجيل طلبي رقم {{order_number}}. برجاء تأكيد الطلب وموعد التوصيل.', 'Hello NEXORA, my order {{order_number}} was registered. Please confirm delivery details.'),
  ('payment_screenshot_request', 'Payment screenshot request', 'أهلاً NEXORA، تم تسجيل طلبي رقم {{order_number}} وسأرسل Screenshot التحويل لتأكيد الدفع.', 'Hello NEXORA, my order {{order_number}} was registered and I will send the transfer screenshot.'),
  ('valu_followup', 'ValU follow-up', 'أهلاً NEXORA، تم تسجيل طلبي رقم {{order_number}} بنظام ValU. برجاء التواصل معي لتأكيد تفاصيل التقسيط.', 'Hello NEXORA, my order {{order_number}} was registered with ValU. Please contact me to confirm installments.'),
  ('shipping_update', 'Shipping update', 'أهلاً، معاك NEXORA. طلبك رقم {{order_number}} قيد التجهيز وسنرسل تحديث الشحن قريبًا.', 'Hello from NEXORA. Your order {{order_number}} is being prepared and shipping updates will follow.')
on conflict (template_key) do update
set title = excluded.title,
    body_ar = excluded.body_ar,
    body_en = excluded.body_en,
    updated_at = now();

update public.site_settings
set payment_settings = coalesce(payment_settings, '{}'::jsonb) || jsonb_build_object(
  'codEnabled', true,
  'instapayEnabled', true,
  'vodafoneCashEnabled', true,
  'valuEnabled', true,
  'transferNumber', '01037141322',
  'confirmationPhone', '01037141322',
  'whatsappConfirmationNumber', '201037141322',
  'codFeeEnabled', true,
  'requireScreenshotInstapay', true,
  'requireScreenshotVodafone', true,
  'codInstructionsAr', 'سيتم تأكيد الطلب معك على واتساب قبل التجهيز. برجاء التأكد من أن رقم الهاتف صحيح ومتاح للتواصل.',
  'instapayInstructionsAr', 'بعد تسجيل الطلب، اضغط على زر واتساب وأرسل Screenshot التحويل مع رقم الطلب. لا يتم تجهيز الطلب إلا بعد تأكيد الدفع.',
  'vodafoneInstructionsAr', 'بعد تسجيل الطلب، أرسل Screenshot التحويل على واتساب ويجب أن يكون رقم العملية والمبلغ واضحين.',
  'valuInstructionsAr', 'لا تقم بأي تحويل قبل التواصل معك وتأكيد تفاصيل التقسيط. فريق NEXORA سيؤكد الخطوات على واتساب.'
)
where id = 'main';

insert into public.nexora_system_migrations(version, title, notes)
values (
  'v5-pro-payment-settings-order-events',
  'V5 Pro payment settings and order events',
  'Adds configurable payment method foundations, WhatsApp templates and order event timeline table while preserving existing checkout APIs.'
)
on conflict (version) do update
set title = excluded.title,
    notes = excluded.notes,
    applied_at = now();
