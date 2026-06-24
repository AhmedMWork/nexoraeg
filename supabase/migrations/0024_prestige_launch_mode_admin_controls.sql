-- NEXORA Prestige Upgrade: Launch Mode, Opening Soon countdown, and launch subscribers
-- Safe, additive migration. Does not remove existing columns or permissions.

alter table if exists public.site_settings
  add column if not exists launch_settings jsonb not null default jsonb_build_object(
    'enabled', false,
    'launchAt', (now() + interval '7 days')::text,
    'timezone', 'Africa/Cairo',
    'autoOpen', true,
    'title', 'NEXORA is Opening Soon',
    'subtitle', 'A new premium shopping experience is almost here.',
    'eyebrow', 'Premium launch experience',
    'announcement', 'We are preparing new drops, smoother checkout, and a better shopping journey.',
    'buttonText', 'Contact us on WhatsApp',
    'whatsappMessage', 'Hello NEXORA, I would like to know more about the launch.',
    'showCountdown', true,
    'showNotifyForm', true,
    'showSocialLinks', true,
    'allowAdminBypass', true,
    'notifySuccessMessage', 'You are on the launch list. We will contact you when NEXORA opens.'
  );

create table if not exists public.launch_subscribers (
  id uuid primary key default gen_random_uuid(),
  name text,
  contact text not null unique,
  email text,
  phone text,
  source text not null default 'opening_soon',
  status text not null default 'active' check (status in ('active','contacted','archived','blocked')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_launch_subscribers_created_at on public.launch_subscribers(created_at desc);
create index if not exists idx_launch_subscribers_status on public.launch_subscribers(status);

alter table public.launch_subscribers enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'launch_subscribers' and policyname = 'Launch subscribers are inserted through edge functions only'
  ) then
    create policy "Launch subscribers are inserted through edge functions only"
      on public.launch_subscribers for insert
      with check (false);
  end if;
end $$;

-- Keep settings row healthy for projects created before launch_settings existed.
insert into public.site_settings (id, brand_name, launch_settings)
values ('main', 'NEXORA', default)
on conflict (id) do nothing;

update public.site_settings
set launch_settings = coalesce(launch_settings, '{}'::jsonb) || jsonb_build_object(
  'enabled', coalesce((launch_settings->>'enabled')::boolean, false),
  'autoOpen', coalesce((launch_settings->>'autoOpen')::boolean, true),
  'showCountdown', coalesce((launch_settings->>'showCountdown')::boolean, true),
  'showNotifyForm', coalesce((launch_settings->>'showNotifyForm')::boolean, true),
  'showSocialLinks', coalesce((launch_settings->>'showSocialLinks')::boolean, true)
)
where id = 'main';

insert into public.admin_notifications (type, title, body, severity, action_url, is_read)
values ('launch_mode', 'Launch Mode is available', 'Configure Opening Soon, countdown, and notification capture from Store Readiness → Launch Mode.', 'info', '/nexora-admin/controls', false)
on conflict do nothing;
