import { corsHeaders, json, requireStudio, serviceClient } from '../_shared/studio.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const blocked = await requireStudio(req); if (blocked) return blocked;
  try {
    const body = await req.json().catch(() => ({}));
    const supabase = serviceClient();
    if (body.action === 'journey') {
      const { data, error } = await supabase.from('visitor_events').select('*').eq('visitor_id', body.visitorId).order('created_at', { ascending: false }).limit(500);
      if (error) throw error;
      return json({ events: data || [] }, 200, req);
    }
    const { data, error } = await supabase.from('visitor_profiles').select('*').order('last_seen_at', { ascending: false }).limit(1000);
    if (error) throw error;
    return json({ visitors: data || [] }, 200, req);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Could not load visitors.' }, 500, req);
  }
});
