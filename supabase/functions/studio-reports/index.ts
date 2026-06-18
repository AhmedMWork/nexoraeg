/* eslint-disable @typescript-eslint/no-explicit-any */
import { corsHeaders, json, requireStudio, serviceClient } from '../_shared/studio.ts';

type AnyRow = Record<string, any>;

function countBy(rows: AnyRow[], key: string) {
  const map = new Map<string, number>();
  for (const row of rows) {
    const value = String(row[key] || 'direct');
    map.set(value, (map.get(value) || 0) + 1);
  }
  return [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
}

function campaignKey(row: AnyRow) {
  return `${String(row.source || 'direct')}::${String(row.campaign || 'no_campaign')}`;
}

function normalizeCampaign(value: unknown) {
  return String(value || 'no_campaign').trim() || 'no_campaign';
}

function normalizeSource(value: unknown) {
  return String(value || 'direct').trim() || 'direct';
}

async function campaignReport(supabase: ReturnType<typeof serviceClient>, days = 60) {
  const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * Math.max(1, Math.min(Number(days || 60), 365))).toISOString();
  const [{ data: events }, { data: leads }, { data: whatsapp }, { data: orders }] = await Promise.all([
    supabase.from('visitor_events').select('source,medium,campaign,content,event_name,page_url,product_id,cart_value,metadata,created_at').gte('created_at', since).limit(30000),
    supabase.from('lead_profiles').select('source,medium,campaign,interest_product_name,created_at').gte('created_at', since).limit(8000),
    supabase.from('whatsapp_clicks').select('source,medium,campaign,product_name,cart_value,created_at').gte('created_at', since).limit(8000),
    supabase.from('orders').select('source_platform,campaign,total,created_at').gte('created_at', since).limit(8000),
  ]);

  const report = new Map<string, AnyRow>();
  const ensure = (source?: unknown, campaign?: unknown, medium?: unknown, content?: unknown) => {
    const row = { source: normalizeSource(source), campaign: normalizeCampaign(campaign) };
    const key = campaignKey(row);
    if (!report.has(key)) {
      report.set(key, {
        ...row,
        medium: medium || '',
        content: content || '',
        visitors: 0,
        productViews: 0,
        addToCart: 0,
        checkoutStarted: 0,
        leads: 0,
        whatsappClicks: 0,
        orders: 0,
        revenue: 0,
        cartValue: 0,
        landingPages: {},
        products: {},
      });
    }
    return report.get(key)!;
  };

  for (const event of events || []) {
    const row = ensure(event.source, event.campaign, event.medium, event.content);
    const eventName = String(event.event_name || '');
    if (eventName === 'page_view') {
      row.visitors += 1;
      const page = String(event.page_url || '/');
      row.landingPages[page] = (row.landingPages[page] || 0) + 1;
    }
    if (eventName === 'product_view') {
      row.productViews += 1;
      const productName = String(event.metadata?.productName || event.metadata?.name || event.product_id || 'Unknown product');
      row.products[productName] = (row.products[productName] || 0) + 1;
    }
    if (eventName === 'add_to_cart') row.addToCart += 1;
    if (eventName === 'checkout_started' || eventName === 'checkout_start') row.checkoutStarted += 1;
    row.cartValue += Number(event.cart_value || 0);
  }
  for (const lead of leads || []) ensure(lead.source, lead.campaign, lead.medium).leads += 1;
  for (const click of whatsapp || []) {
    const row = ensure(click.source, click.campaign, click.medium);
    row.whatsappClicks += 1;
    row.cartValue += Number(click.cart_value || 0);
  }
  for (const order of orders || []) {
    const row = ensure(order.source_platform, order.campaign, 'order');
    row.orders += 1;
    row.revenue += Number(order.total || 0);
  }

  return [...report.values()].map((row) => {
    const topLanding = Object.entries(row.landingPages).sort((a: any, b: any) => b[1] - a[1])[0]?.[0] || '—';
    const topProduct = Object.entries(row.products).sort((a: any, b: any) => b[1] - a[1])[0]?.[0] || '—';
    delete row.landingPages;
    delete row.products;
    return { ...row, topLanding, topProduct };
  }).sort((a, b) => (b.revenue + b.orders * 250 + b.leads * 50 + b.visitors) - (a.revenue + a.orders * 250 + a.leads * 50 + a.visitors)).slice(0, 150);
}

async function productAnalyticsReport(supabase: ReturnType<typeof serviceClient>, filters: AnyRow = {}) {
  const days = Math.max(1, Math.min(Number(filters.days || 30), 365));
  const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * days).toISOString();
  const [{ data: events }, { data: orders }, { data: items }] = await Promise.all([
    supabase.from('visitor_events').select('source,medium,campaign,content,event_name,product_id,cart_value,metadata,session_id,visitor_id,created_at').gte('created_at', since).limit(50000),
    supabase.from('orders').select('id,total,source_platform,campaign,attribution,created_at').gte('created_at', since).limit(12000),
    supabase.from('order_items').select('order_id,product_id,product_name,size,color,quantity,total').limit(50000),
  ]);

  const productFilter = String(filters.product || '').toLowerCase().trim();
  const sourceFilter = String(filters.source || '').toLowerCase().trim();
  const campaignFilter = String(filters.campaign || '').toLowerCase().trim();
  const orderMap = new Map((orders || []).map((o: AnyRow) => [o.id, o]));
  const map = new Map<string, AnyRow>();
  const ensure = (id: string, name: string) => {
    const key = id || name || 'unknown';
    if (!map.has(key)) map.set(key, {
      productId: id || '', productName: name || 'Unknown product', views: 0, uniqueViewers: new Set<string>(), addToCart: 0, checkoutStarted: 0, orders: 0, unitsSold: 0, revenue: 0, sources: {}, campaigns: {}, sizes: {}, colors: {}, cartValue: 0,
    });
    return map.get(key)!;
  };

  for (const event of events || []) {
    const name = String(event.metadata?.productName || event.metadata?.name || event.product_id || 'Unknown product');
    const productId = String(event.product_id || event.metadata?.productId || '');
    if (productFilter && !(`${name} ${productId}`.toLowerCase().includes(productFilter))) continue;
    if (sourceFilter && String(event.source || '').toLowerCase() !== sourceFilter) continue;
    if (campaignFilter && String(event.campaign || '').toLowerCase() !== campaignFilter) continue;
    const row = ensure(productId, name);
    const eventName = String(event.event_name || '');
    if (eventName === 'product_view') { row.views += 1; if (event.visitor_id || event.session_id) row.uniqueViewers.add(String(event.visitor_id || event.session_id)); }
    if (eventName === 'add_to_cart') row.addToCart += 1;
    if (eventName === 'checkout_started' || eventName === 'checkout_start') row.checkoutStarted += 1;
    const source = normalizeSource(event.source);
    const campaign = normalizeCampaign(event.campaign);
    row.sources[source] = (row.sources[source] || 0) + 1;
    row.campaigns[campaign] = (row.campaigns[campaign] || 0) + 1;
    const size = String(event.metadata?.size || '').trim();
    const color = String(event.metadata?.color || '').trim();
    if (size) row.sizes[size] = (row.sizes[size] || 0) + 1;
    if (color) row.colors[color] = (row.colors[color] || 0) + 1;
    row.cartValue += Number(event.cart_value || 0);
  }

  for (const item of items || []) {
    const order = orderMap.get(item.order_id);
    if (!order) continue;
    const name = String(item.product_name || item.product_id || 'Unknown product');
    const productId = String(item.product_id || '');
    if (productFilter && !(`${name} ${productId}`.toLowerCase().includes(productFilter))) continue;
    const row = ensure(productId, name);
    row.orders += 1;
    row.unitsSold += Number(item.quantity || 0);
    row.revenue += Number(item.total || 0);
    const source = normalizeSource(order.source_platform || order.attribution?.lastTouch?.source || order.attribution?.source);
    const campaign = normalizeCampaign(order.campaign || order.attribution?.lastTouch?.campaign || order.attribution?.campaign);
    row.sources[source] = (row.sources[source] || 0) + 1;
    row.campaigns[campaign] = (row.campaigns[campaign] || 0) + 1;
    if (item.size) row.sizes[item.size] = (row.sizes[item.size] || 0) + Number(item.quantity || 1);
    if (item.color) row.colors[item.color] = (row.colors[item.color] || 0) + Number(item.quantity || 1);
  }

  return [...map.values()].map((row) => {
    const topSource = Object.entries(row.sources).sort((a: any,b: any) => b[1]-a[1])[0]?.[0] || '—';
    const topCampaign = Object.entries(row.campaigns).sort((a: any,b: any) => b[1]-a[1])[0]?.[0] || '—';
    const topSize = Object.entries(row.sizes).sort((a: any,b: any) => b[1]-a[1])[0]?.[0] || '—';
    const topColor = Object.entries(row.colors).sort((a: any,b: any) => b[1]-a[1])[0]?.[0] || '—';
    const uniqueViewers = row.uniqueViewers.size;
    const conversionRate = row.views ? Math.round((row.orders / row.views) * 1000) / 10 : 0;
    const addToCartRate = row.views ? Math.round((row.addToCart / row.views) * 1000) / 10 : 0;
    delete row.sources; delete row.campaigns; delete row.sizes; delete row.colors; delete row.uniqueViewers;
    return { ...row, uniqueViewers, topSource, topCampaign, topSize, topColor, conversionRate, addToCartRate };
  }).sort((a,b) => (b.revenue + b.orders * 250 + b.addToCart * 20 + b.views) - (a.revenue + a.orders * 250 + a.addToCart * 20 + a.views)).slice(0, 250);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const blocked = await requireStudio(req); if (blocked) return blocked;
  try {
    const body = await req.json().catch(() => ({}));
    const supabase = serviceClient();
    const sinceToday = new Date();
    sinceToday.setHours(0, 0, 0, 0);
    const today = sinceToday.toISOString();

    if (body.action === 'product-analytics') {
      const products = await productAnalyticsReport(supabase, body);
      const summary = products.reduce((acc: AnyRow, row: AnyRow) => { acc.views += Number(row.views || 0); acc.uniqueViewers += Number(row.uniqueViewers || 0); acc.addToCart += Number(row.addToCart || 0); acc.orders += Number(row.orders || 0); acc.unitsSold += Number(row.unitsSold || 0); acc.revenue += Number(row.revenue || 0); return acc; }, { views: 0, uniqueViewers: 0, addToCart: 0, orders: 0, unitsSold: 0, revenue: 0 });
      return json({ products, summary, days: Number(body.days || 30) }, 200, req);
    }

    if (body.action === 'campaigns') {
      const campaigns = await campaignReport(supabase, Number(body.days || 60));
      const summary = campaigns.reduce((acc: AnyRow, row: AnyRow) => {
        acc.visitors += Number(row.visitors || 0);
        acc.productViews += Number(row.productViews || 0);
        acc.addToCart += Number(row.addToCart || 0);
        acc.checkoutStarted += Number(row.checkoutStarted || 0);
        acc.leads += Number(row.leads || 0);
        acc.whatsappClicks += Number(row.whatsappClicks || 0);
        acc.orders += Number(row.orders || 0);
        acc.revenue += Number(row.revenue || 0);
        return acc;
      }, { visitors: 0, productViews: 0, addToCart: 0, checkoutStarted: 0, leads: 0, whatsappClicks: 0, orders: 0, revenue: 0 });
      return json({ campaigns, summary }, 200, req);
    }

    const [{ data: visitorsToday }, { data: leadsToday }, { data: whatsappToday }, { data: recentLeads }, { data: recentVisitors }, { data: allEvents }] = await Promise.all([
      supabase.from('visitor_profiles').select('*').gte('last_seen_at', today).limit(3000),
      supabase.from('lead_profiles').select('*').gte('created_at', today).limit(3000),
      supabase.from('whatsapp_clicks').select('*').gte('created_at', today).limit(3000),
      supabase.from('lead_profiles').select('*').order('created_at', { ascending: false }).limit(8),
      supabase.from('visitor_profiles').select('*').order('last_seen_at', { ascending: false }).limit(8),
      supabase.from('visitor_events').select('source,campaign,event_name,page_url,metadata,created_at').gte('created_at', new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString()).limit(15000),
    ]);

    const topSources = countBy(allEvents || [], 'source').slice(0, 8);
    const topCampaigns = await campaignReport(supabase, Number(body.days || 30));
    const eventTotals = countBy(allEvents || [], 'event_name').slice(0, 12);
    const topLandingPages = countBy((allEvents || []).filter((e) => e.event_name === 'page_view'), 'page_url').slice(0, 8);

    return json({
      visitorsToday: visitorsToday?.length || 0,
      leadsToday: leadsToday?.length || 0,
      whatsappClicksToday: whatsappToday?.length || 0,
      topSources,
      topCampaigns: topCampaigns.slice(0, 8),
      eventTotals,
      topLandingPages,
      recentLeads: recentLeads || [],
      recentVisitors: recentVisitors || [],
    }, 200, req);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Could not load growth report.' }, 500, req);
  }
});
