import { corsHeaders, json, requireStudio, serviceClient, auditLog } from '../_shared/studio.ts';

function errorMessage(error: unknown, fallback = 'Could not load customers.') {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) return String((error as { message?: unknown }).message || fallback);
  return fallback;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const blocked = await requireStudio(req); if (blocked) return blocked;

  try {
    const body = await req.json().catch(() => ({}));
    const supabase = serviceClient();

    if (body.action === 'refresh') {
      const { error } = await supabase.rpc('nexora_refresh_customer_profiles_v5_5');
      if (error) {
        // Do not hard-crash the admin. Return the exact setup issue while keeping the page usable.
        return json({ ok: false, warning: error.message, fix: 'Run the V5.5.5 recovery migration, then redeploy studio-customers.' }, 200, req);
      }
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

    let refreshWarning: string | null = null;
    const refreshResult = await supabase.rpc('nexora_refresh_customer_profiles_v5_5');
    if (refreshResult.error) refreshWarning = refreshResult.error.message;

    const [{ data: customers, error: customersError }, { data: notes, error: notesError }] = await Promise.all([
      supabase.from('customer_profiles').select('*').order('last_order_at', { ascending: false }).limit(1000),
      supabase.from('customer_notes').select('*').order('created_at', { ascending: false }).limit(3000),
    ]);

    if (!customersError) {
      return json({ customers: customers || [], notes: notesError ? [] : notes || [], warning: refreshWarning || notesError?.message || null }, 200, req);
    }

    // Last-resort fallback: derive customers from orders so the page still opens
    // even if CRM tables are missing or partially migrated.
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('customer_phone, customer_email, customer_name, governorate, city, address, total, status, order_status, created_at, source_platform, campaign')
      .not('customer_phone', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1000);

    if (ordersError) throw customersError;

    const byPhone = new Map<string, Record<string, unknown>>();
    for (const order of orders || []) {
      const phone = String(order.customer_phone || '').trim();
      if (!phone) continue;
      const previous = byPhone.get(phone);
      const isValidRevenue = !['cancelled', 'returned', 'failed'].includes(String(order.order_status || order.status || ''));
      if (!previous) {
        byPhone.set(phone, {
          id: `phone:${phone}`,
          phone,
          email: order.customer_email || '',
          full_name: order.customer_name || '',
          governorate: order.governorate || '',
          city: order.city || '',
          address: order.address || '',
          total_orders: 1,
          total_revenue: isValidRevenue ? Number(order.total || 0) : 0,
          last_order_at: order.created_at,
          first_source: order.source_platform || '',
          last_source: order.source_platform || '',
          first_campaign: order.campaign || '',
          last_campaign: order.campaign || '',
          tags: [],
          status: 'active',
          notes: '',
          fallback: true,
        });
      } else {
        previous.total_orders = Number(previous.total_orders || 0) + 1;
        previous.total_revenue = Number(previous.total_revenue || 0) + (isValidRevenue ? Number(order.total || 0) : 0);
        previous.first_source = previous.first_source || order.source_platform || '';
        previous.first_campaign = previous.first_campaign || order.campaign || '';
      }
    }

    return json({
      customers: Array.from(byPhone.values()),
      notes: [],
      warning: `Customer CRM table issue: ${customersError.message}. Showing fallback customers from orders.`,
    }, 200, req);
  } catch (error) {
    return json({ error: errorMessage(error), fix: 'Run supabase db push with the V5.5.5 package and redeploy Edge Functions.' }, 500, req);
  }
});
