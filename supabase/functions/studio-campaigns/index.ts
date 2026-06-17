import { corsHeaders, json, requireStudio, serviceClient, auditLog } from '../_shared/studio.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const blocked = await requireStudio(req); if (blocked) return blocked;
  try {
    const body = await req.json().catch(() => ({}));
    const supabase = serviceClient();
    if (body.action === 'create') {
      const link = body.link || {};
      const { data, error } = await supabase.from('campaign_links').insert({
        name: link.name,
        platform: link.platform,
        source: link.source,
        medium: link.medium,
        campaign: link.campaign,
        content: link.content,
        landing_page: link.landingPage,
        final_url: link.finalUrl,
      }).select('id').single();
      if (error) throw error;
      await auditLog('campaign_link_created', 'campaign_link', data.id, link);
      return json({ id: data.id }, 200, req);
    }
    const { data, error } = await supabase.from('campaign_links').select('*').order('created_at', { ascending: false }).limit(500);
    if (error) throw error;
    return json({ links: data || [] }, 200, req);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Could not manage campaign links.' }, 500, req);
  }
});
