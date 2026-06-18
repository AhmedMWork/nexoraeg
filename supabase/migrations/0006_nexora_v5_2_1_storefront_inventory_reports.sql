-- ============================================================
-- NEXORA V5.2.1 — Storefront Controls, Inventory Visibility, Reports Polish
-- Safe additive migration intended to run after V5.2 Ultimate.
-- ============================================================

alter table if exists public.site_settings
  add column if not exists home_collection_tiles jsonb default jsonb_build_array(
    jsonb_build_object('id','oversized-tees','title','Oversized Tees','titleAr','تيشيرتات واسعة','href','/shop/unisex','image','/assets/products/women-sand-tee.jpg','eyebrow','Explore'),
    jsonb_build_object('id','core-essentials','title','Core Essentials','titleAr','أساسيات يومية','href','/shop','image','/assets/products/men-cream-tee.jpg','eyebrow','Explore'),
    jsonb_build_object('id','limited-drop','title','Limited Drop','titleAr','الإصدارات المحدودة','href','/limited','image','/assets/nexora-logo-bg.jpg','eyebrow','Explore'),
    jsonb_build_object('id','last-pieces','title','Last Pieces','titleAr','آخر القطع','href','/shop?availability=last-pieces','image','/assets/products/men-black-tee.jpg','eyebrow','Explore')
  );

insert into public.site_settings (id) values ('main') on conflict (id) do nothing;

update public.site_settings
set home_collection_tiles = coalesce(home_collection_tiles, jsonb_build_array(
    jsonb_build_object('id','oversized-tees','title','Oversized Tees','titleAr','تيشيرتات واسعة','href','/shop/unisex','image','/assets/products/women-sand-tee.jpg','eyebrow','Explore'),
    jsonb_build_object('id','core-essentials','title','Core Essentials','titleAr','أساسيات يومية','href','/shop','image','/assets/products/men-cream-tee.jpg','eyebrow','Explore'),
    jsonb_build_object('id','limited-drop','title','Limited Drop','titleAr','الإصدارات المحدودة','href','/limited','image','/assets/nexora-logo-bg.jpg','eyebrow','Explore'),
    jsonb_build_object('id','last-pieces','title','Last Pieces','titleAr','آخر القطع','href','/shop?availability=last-pieces','image','/assets/products/men-black-tee.jpg','eyebrow','Explore')
  )),
  updated_at = now()
where id = 'main';

create index if not exists idx_inventory_logs_product_created on public.inventory_logs(product_id, created_at desc);
create index if not exists idx_visitor_events_campaign_source_created on public.visitor_events(source, campaign, created_at desc);
create index if not exists idx_lead_profiles_source_campaign_created on public.lead_profiles(source, campaign, created_at desc);
create index if not exists idx_whatsapp_clicks_source_campaign_created on public.whatsapp_clicks(source, campaign, created_at desc);
