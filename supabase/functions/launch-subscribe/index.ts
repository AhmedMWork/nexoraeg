import { corsHeaders, json, serviceClient } from '../_shared/studio.ts';

function isEmail(value: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }
function isPhone(value: string) { return /^\+?[0-9\s().-]{8,20}$/.test(value); }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    const name = String(body.name || '').trim().slice(0, 120);
    const contact = String(body.contact || '').trim().slice(0, 160);
    const source = String(body.source || 'opening_soon').trim().slice(0, 80);
    if (!contact) return json({ error: 'Please enter your phone number or email.' }, 400);
    if (!isEmail(contact) && !isPhone(contact)) return json({ error: 'Please enter a valid phone number or email.' }, 400);

    const supabase = serviceClient();
    const email = isEmail(contact) ? contact.toLowerCase() : null;
    const phone = !email ? contact : null;
    const { error } = await supabase.from('launch_subscribers').upsert({
      name,
      contact,
      email,
      phone,
      source,
      status: 'active',
      metadata: { userAgent: req.headers.get('user-agent') || null },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'contact' });
    if (error) throw error;
    return json({ ok: true });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Could not save subscriber.' }, 500);
  }
});
