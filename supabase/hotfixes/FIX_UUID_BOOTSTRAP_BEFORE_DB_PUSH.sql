-- ============================================================
-- NEXORA UUID BOOTSTRAP
-- Safe on fresh and already-live Supabase databases.
-- No dependency on pgcrypto, uuid-ossp, gen_random_uuid, or gen_random_bytes.
-- Compatibility aliases are kept so older partially-applied databases do not fail.
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
    substr(value, 1, 8) || '-' ||
    substr(value, 9, 4) || '-4' ||
    substr(value, 14, 3) || '-' ||
    substr('89ab', floor(random() * 4)::int + 1, 1) || substr(value, 18, 3) || '-' ||
    substr(value, 21, 12)
  )::uuid;
end;
$$;

create or replace function public.nexora_uuid_v5_5_5()
returns uuid
language sql
volatile
set search_path = public, pg_catalog
as $$
  select public.nexora_uuid();
$$;

create or replace function public.nexora_uuid_v5_5_4()
returns uuid
language sql
volatile
set search_path = public, pg_catalog
as $$
  select public.nexora_uuid();
$$;

-- ============================================================
-- NEXORA V5.5.6 — migration bootstrap hotfix
-- Must exist before 0009 creates CRM tables on already-live databases.
-- No dependency on pgcrypto/uuid-ossp/gen_random_bytes.
-- ============================================================



