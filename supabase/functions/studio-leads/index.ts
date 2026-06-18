 
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

    if (body.action === 'create-task') {
      const title = String(body.title || '').trim();
      if (!title) return json({ error: 'Task title is required.' }, 400, req);
      const { data, error } = await supabase.from('lead_tasks').insert({ lead_id: body.leadId, title, due_at: body.dueAt || null, created_by: 'studio' }).select('id').single();
      if (error) throw error;
      await auditLog('lead_task_created', 'lead', String(body.leadId), { title, dueAt: body.dueAt });
      return json({ id: data.id }, 200, req);
    }

    if (body.action === 'complete-task') {
      const { error } = await supabase.from('lead_tasks').update({ status: 'done', completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', body.taskId);
      if (error) throw error;
      await auditLog('lead_task_completed', 'lead_task', String(body.taskId), {});
      return json({ ok: true }, 200, req);
    }

    const [{ data, error }, { data: tasks }, { data: notes }] = await Promise.all([
      supabase.from('lead_profiles').select('*').order('created_at', { ascending: false }).limit(1000),
      supabase.from('lead_tasks').select('*').order('due_at', { ascending: true, nullsFirst: false }).limit(2000),
      supabase.from('lead_notes').select('*').order('created_at', { ascending: false }).limit(2000),
    ]);
    if (error) throw error;
    return json({ leads: data || [], tasks: tasks || [], notes: notes || [] }, 200, req);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Could not load leads.' }, 500, req);
  }
});
