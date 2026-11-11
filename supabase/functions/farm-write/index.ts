import { uploadAllowed } from '../_shared/upload-auth.ts';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
const cors = { ...corsHeaders, 'Access-Control-Allow-Headers': `${corsHeaders['Access-Control-Allow-Headers']}, x-api-key, x-farm-path, x-farm-method, x-upsert` };
const tables = ['crocs','inspections','croc_photos','cull_records','feed_records','upload_logs'];
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (!uploadAllowed(req)) return new Response(JSON.stringify({ message: 'Invalid upload connection key' }), { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } });
  const path = req.headers.get('x-farm-path') ?? '';
  const method = req.headers.get('x-farm-method') ?? '';
  const table = path.match(/^\/rest\/v1\/([a-z_]+)(?:\?|$)/)?.[1];
  const storage = /^\/storage\/v1\/object\/croc-photos\/[^?]+(?:\?.*)?$/.test(path);
  if ((!table || !tables.includes(table)) && !storage || !['POST','PATCH','DELETE','PUT'].includes(method) || path.includes('..') || path.includes('\\')) return new Response('Invalid write target', { status: 400, headers: cors });
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return new Response('Cloud unavailable', { status: 503, headers: cors });
  const headers = new Headers();
  for (const name of ['content-type','prefer','accept','x-upsert','content-profile','accept-profile']) {
    const value = req.headers.get(name); if (value) headers.set(name,value);
  }
  headers.set('apikey',serviceKey); headers.set('Authorization',`Bearer ${serviceKey}`);
  const response = await fetch(url + path, { method, headers, body: await req.arrayBuffer() });
  const out = new Headers(cors);
  for (const name of ['content-type','content-range','preference-applied']) { const value = response.headers.get(name); if (value) out.set(name,value); }
  return new Response(response.body, { status: response.status, headers: out });
});
