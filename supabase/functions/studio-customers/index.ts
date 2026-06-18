 
import { corsHeaders, json, requireStudio, serviceClient, auditLog } from '../_shared/studio.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const blocked = await requireStudio(req); if (blocked) return blocked;
  try {
    const body = await req.json().catch(() => ({}));
    const supabase = serviceClient();

    if (body.action === 'refresh') {
      const { error } = await supabase.rpc('nexora_refresh_customer_profiles_v5_5');
      if (error) throw error;
      return json({ ok: true }, 200, req);
    }

    if (body.action === 'update') {
      const updates = body.updates || {};
      const allowed: Record<string, unknown> = {};
      for (const key of ['full_name','email','phone','governorate','city','address','tags','status','notes'] as const) {
        if (updates[key] !== undefined) allowed[key] = updates[key];
      }
      allowed.updated_at = new Date().toISOString();
      const { error } = await supabase.from('customer_profiles').update(allowed).eq('id', body.id);
      if (error) throw error;
      await auditLog('customer_profile_updated', 'customer', String(body.id), allowed);
      return json({ ok: true }, 200, req);
    }

    if (body.action === 'add-note') {
      const note = String(body.note || '').trim();
      if (!note) return json({ error: 'Note is required.' }, 400, req);
      const { error } = await supabase.from('customer_notes').insert({ customer_id: body.customerId, note, created_by: 'studio' });
      if (error) throw error;
      await auditLog('customer_note_added', 'customer', String(body.customerId), { note });
      return json({ ok: true }, 200, req);
    }

    await supabase.rpc('nexora_refresh_customer_profiles_v5_5').then(() => undefined).catch(() => undefined);
    const [{ data: customers, error: customersError }, { data: notes }] = await Promise.all([
      supabase.from('customer_profiles').select('*').order('last_order_at', { ascending: false }).limit(1000),
      supabase.from('customer_notes').select('*').order('created_at', { ascending: false }).limit(3000),
    ]);
    if (customersError) throw customersError;
    return json({ customers: customers || [], notes: notes || [] }, 200, req);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Could not load customers.' }, 500, req);
  }
});
