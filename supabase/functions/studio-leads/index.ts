import { corsHeaders, json, requireStudio, serviceClient, auditLog } from '../_shared/studio.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const blocked = await requireStudio(req); if (blocked) return blocked;
  try {
    const body = await req.json().catch(() => ({}));
    const supabase = serviceClient();
    if (body.action === 'update-status') {
      const update: Record<string, unknown> = { status: body.status || 'contacted', updated_at: new Date().toISOString() };
      if (body.status === 'contacted') update.last_contacted_at = new Date().toISOString();
      if (body.notes) update.notes = body.notes;
      const { error } = await supabase.from('lead_profiles').update(update).eq('id', body.id);
      if (error) throw error;
      await supabase.from('lead_notes').insert({ lead_id: body.id, note: body.notes || `Status changed to ${body.status}`, status: body.status, created_by: 'studio' });
      await auditLog('lead_updated', 'lead', String(body.id), update);
      return json({ ok: true }, 200, req);
    }
    const { data, error } = await supabase.from('lead_profiles').select('*').order('created_at', { ascending: false }).limit(1000);
    if (error) throw error;
    return json({ leads: data || [] }, 200, req);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Could not load leads.' }, 500, req);
  }
});
