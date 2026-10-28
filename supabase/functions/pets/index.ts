import { createClient } from 'npm:@supabase/supabase-js@2.117.3';
import { validatePet } from './validation.mjs';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
function reply(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { ...cors, 'Cache-Control': 'private, no-store' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return reply({ error: 'method_not_allowed' }, 405);
  const authorization = req.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return reply({ error: 'unauthorized' }, 401);
  const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: authError } = await client.auth.getUser(authorization.slice(7));
  if (authError || !user || user.is_anonymous) return reply({ error: 'unauthorized' }, 401);
  try {
    // Bound streamed input too; Content-Length alone is not authoritative.
    const reader = req.body?.getReader();
    if (!reader) return reply({ error: 'invalid_input' }, 400);
    const chunks: Uint8Array[] = []; let length = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 24000) { await reader.cancel(); return reply({ error: 'too_large' }, 413); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    let body;
    try { body = JSON.parse(new TextDecoder().decode(bytes)); } catch { return reply({ error: 'invalid_input' }, 400); }
    const parsed = validatePet(body?.pet);
    if (!parsed.ok || !parsed.value) return reply({ error: 'invalid_input', field: parsed.field }, 400);
    if (body.action === 'create') {
      const { data, error } = await client.rpc('create_pet', { p_pet: parsed.value });
      if (error) {
        console.error('pet_create_failed', error.code, error.message);
        if (error.code === '42501') return reply({ error: 'forbidden' }, 403);
        return reply({ error: 'save_failed' }, 500);
      }
      return reply({ pet: data }, 201);
    }
    if (body.action === 'update' && typeof body.id === 'string' && /^[0-9a-f-]{36}$/i.test(body.id)
        && typeof body.updated_at === 'string') {
      const { data, error } = await client.from('zwierze').update(parsed.value)
        .eq('id', body.id).eq('updated_at', body.updated_at).select().maybeSingle();
      if (error) { console.error('pet_update_failed', error.code); return reply({ error: 'save_failed' }, 500); }
      if (!data) return reply({ error: 'conflict_or_not_found' }, 409);
      return reply({ pet: data });
    }
    return reply({ error: 'invalid_input' }, 400);
  } catch { return reply({ error: 'save_failed' }, 500); }
});
