import { corsHeaders, json, requireStudio, serviceClient } from '../_shared/studio.ts';

function countBy<T extends Record<string, unknown>>(rows: T[], key: string) {
  const map = new Map<string, number>();
  for (const row of rows) {
    const value = String(row[key] || 'direct');
    map.set(value, (map.get(value) || 0) + 1);
  }
  return [...map.entries()].map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count);
}

function campaignKey(row: Record<string, unknown>) {
  return `${String(row.source || 'direct')}::${String(row.campaign || 'no_campaign')}`;
}

async function campaignReport(supabase: ReturnType<typeof serviceClient>) {
  const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString();
  const [{ data: events }, { data: leads }, { data: whatsapp }, { data: orders }] = await Promise.all([
    supabase.from('visitor_events').select('source,campaign,event_name').gte('created_at', since).limit(20000),
    supabase.from('lead_profiles').select('source,campaign').gte('created_at', since).limit(5000),
    supabase.from('whatsapp_clicks').select('source,campaign').gte('created_at', since).limit(5000),
    supabase.from('orders').select('source_platform,campaign,total,created_at').gte('created_at', since).limit(5000),
  ]);

  const report = new Map<string, { source: string; campaign: string; visitors: number; leads: number; whatsappClicks: number; orders: number; revenue: number }>();
  const ensure = (source?: string | null, campaign?: string | null) => {
    const row = { source: source || 'direct', campaign: campaign || 'no_campaign' };
    const key = campaignKey(row);
    if (!report.has(key)) report.set(key, { ...row, visitors: 0, leads: 0, whatsappClicks: 0, orders: 0, revenue: 0 });
    return report.get(key)!;
  };

  for (const event of events || []) {
    if (event.event_name === 'page_view') ensure(event.source, event.campaign).visitors += 1;
  }
  for (const lead of leads || []) ensure(lead.source, lead.campaign).leads += 1;
  for (const click of whatsapp || []) ensure(click.source, click.campaign).whatsappClicks += 1;
  for (const order of orders || []) {
    const row = ensure(order.source_platform, order.campaign);
    row.orders += 1;
    row.revenue += Number(order.total || 0);
  }
  return [...report.values()].sort((a, b) => (b.revenue + b.leads * 50 + b.visitors) - (a.revenue + a.leads * 50 + a.visitors)).slice(0, 100);
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

    if (body.action === 'campaigns') {
      const campaigns = await campaignReport(supabase);
      return json({ campaigns }, 200, req);
    }

    const [{ data: visitorsToday }, { data: leadsToday }, { data: whatsappToday }, { data: recentLeads }, { data: recentVisitors }, { data: allEvents }] = await Promise.all([
      supabase.from('visitor_profiles').select('*').gte('last_seen_at', today).limit(2000),
      supabase.from('lead_profiles').select('*').gte('created_at', today).limit(2000),
      supabase.from('whatsapp_clicks').select('*').gte('created_at', today).limit(2000),
      supabase.from('lead_profiles').select('*').order('created_at', { ascending: false }).limit(8),
      supabase.from('visitor_profiles').select('*').order('last_seen_at', { ascending: false }).limit(8),
      supabase.from('visitor_events').select('source,campaign,event_name,created_at').gte('created_at', new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString()).limit(10000),
    ]);

    const topSources = countBy(allEvents || [], 'source').slice(0, 8);
    const topCampaigns = await campaignReport(supabase);
    return json({
      visitorsToday: visitorsToday?.length || 0,
      leadsToday: leadsToday?.length || 0,
      whatsappClicksToday: whatsappToday?.length || 0,
      topSources,
      topCampaigns: topCampaigns.slice(0, 8),
      recentLeads: recentLeads || [],
      recentVisitors: recentVisitors || [],
    }, 200, req);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Could not load growth report.' }, 500, req);
  }
});
