import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { Entry, photoPath, MAX_PHOTO_BYTES } from './validation.ts';
const cors = { ...corsHeaders, 'Access-Control-Allow-Headers': `${corsHeaders['Access-Control-Allow-Headers']}, x-api-key` };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const url = Deno.env.get('SUPABASE_URL');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!url || !serviceKey) throw new Error('Cloud binding unavailable');
const db = createClient(url, serviceKey, { auth: { persistSession: false } });
const BUCKET = 'croc-photos';
const PhotoMeta = Entry.pick({ client_id: true, tag: true, date: true });
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const key = Deno.env.get('CAPTURE_API_KEY');
  if (!key || req.headers.get('x-api-key') !== key) return json({ error: 'unauthorized' }, 401);
  const route = new URL(req.url).pathname.replace(/^.*\/ingest-capture/, '') || '/';
  try {
    if (req.method === 'GET' && route === '/health') return json({ ok: true, storage: 'private', max_photo_bytes: MAX_PHOTO_BYTES });
    if (req.method === 'GET' && route === '/conditions') {
      const { data, error } = await db.from('condition_codes').select('*').order('code');
      if (error) throw error;
      return json({ conditions: data });
    }
    if (req.method === 'POST' && route === '/photo') {
      const form = await req.formData();
      const parsed = PhotoMeta.safeParse(Object.fromEntries(['client_id','tag','date'].map(k => [k, form.get(k)])));
      if (!parsed.success) return json({ error: 'validation_failed', details: parsed.error.flatten() }, 400);
      const file = form.get('photo');
      if (!(file instanceof File)) return json({ error: 'photo file required' }, 400);
      if (!['image/jpeg','image/png'].includes(file.type)) return json({ error: 'JPEG or PNG required' }, 415);
      if (file.size > MAX_PHOTO_BYTES) return json({ error: 'photo too large (max 25 MiB)' }, 413);
      const path = photoPath(parsed.data, file.type);
      const { error } = await db.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: true });
      if (error) throw error;
      const { data: signed, error: signError } = await db.storage.from(BUCKET).createSignedUrl(path, 3600);
      if (signError) throw signError;
      return json({ photo_path: path, photo_url: signed?.signedUrl, expires_in: 3600 });
    }
    if (req.method === 'POST' && route === '/') {
      const parsed = z.object({ entries: z.array(Entry).min(1).max(200) }).safeParse(await req.json());
      if (!parsed.success) return json({ error: 'validation_failed', details: parsed.error.flatten() }, 400);
      const results = [];
      for (const input of parsed.data.entries) {
        try {
          const { data: duplicate, error: duplicateError } = await db.from('capture_ingest_log').select('client_id').eq('client_id', input.client_id).maybeSingle();
          if (duplicateError) throw duplicateError;
          if (duplicate) { results.push({ client_id: input.client_id, status: 'duplicate' }); continue; }
          const e = { ...input };
          if (e.photo_base64) {
            const binary = atob(e.photo_base64.replace(/^data:[^;]+;base64,/, ''));
            if (binary.length > MAX_PHOTO_BYTES) throw new Error('photo too large (max 25 MiB)');
            const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
            e.photo_path = photoPath(e, e.photo_content_type ?? 'image/jpeg');
            const { error } = await db.storage.from(BUCKET).upload(e.photo_path, bytes, { contentType: e.photo_content_type ?? 'image/jpeg', upsert: true });
            if (error) throw error;
          }
          let signedUrl: string | null = null;
          if (e.photo_path) {
            if (![photoPath(e,'image/jpeg'),photoPath(e,'image/png')].includes(e.photo_path)) throw new Error('photo_path must belong to this entry');
            const { data: signed, error } = await db.storage.from(BUCKET).createSignedUrl(e.photo_path, 3600);
            if (error || !signed) throw new Error('photo not found; upload photo first');
            signedUrl = signed.signedUrl;
          }
          if (e.marks.length) {
            const { data: codes, error } = await db.from('condition_codes').select('code').in('code', [...new Set(e.marks.map(m => m.code))]);
            if (error) throw error;
            if (e.marks.some(m => !codes?.some(c => c.code === m.code))) throw new Error('unknown condition code');
          }
          const { data, error } = await db.rpc('commit_capture', { e, p_photo_url: signedUrl });
          if (error) throw error;
          results.push(data);
        } catch (error) { results.push({ client_id: input.client_id, status: 'rejected', reason: error instanceof Error ? error.message : 'Entry could not be stored' }); }
      }
      return json({ results, saved: results.filter(r => r.status === 'saved').length });
    }
    return json({ error: 'not_found' }, 404);
  } catch (error) { return json({ error: error instanceof Error ? error.message : 'Request failed' }, 400); }
});
