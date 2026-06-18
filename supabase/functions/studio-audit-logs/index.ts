import { corsHeaders, json, requireStudio, serviceClient } from '../_shared/studio.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const blocked = await requireStudio(req); if (blocked) return blocked;
  const supabase = serviceClient();
  const body = await req.json().catch(() => ({}));

  try {
    if (!body.action || body.action === 'list') {
      const limit = Math.min(Number(body.limit || 300), 500);
      let query = supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(limit);
      if (body.entityType) query = query.eq('entity_type', body.entityType);
      if (body.actionName) query = query.eq('action', body.actionName);
      const { data, error } = await query;
      if (error) throw error;
      return json({ logs: data || [] });
    }

    if (body.action === 'create') {
      const log = body.log || {};
      const { data, error } = await supabase.from('audit_logs').insert({
        admin_email: log.admin_email || 'studio@nexora.local',
        action: log.action || 'studio_event',
        entity_type: log.entity_type || log.entityType || 'system',
        entity_id: log.entity_id || log.entityId || 'system',
        before: log.before || null,
        after: log.after || log.metadata || null,
      }).select('id').single();
      if (error) throw error;
      return json({ id: data.id });
    }

    return json({ error: 'Unknown action.' }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Studio audit log request failed.' }, 500);
  }
});
