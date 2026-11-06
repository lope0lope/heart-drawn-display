// CrocTrack external capture ingest API.
// Deploy: supabase functions deploy ingest-capture --no-verify-jwt
// Secrets: supabase secrets set CAPTURE_API_KEY=<long random key>
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';

const BUCKET = 'croc-photos';
const MAX_PHOTO_BYTES = 25 * 1024 * 1024;
const cors = { ...corsHeaders, 'Access-Control-Allow-Headers': `${corsHeaders['Access-Control-Allow-Headers'] ?? ''}, x-api-key`.replace(/^, /, '') };

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

function normaliseCull(raw?: string | null): string {
  const v = (raw ?? '').toString().trim().toUpperCase();
  if (v === 'CULL' || v === 'CULLED') return 'CULLED';
  if (v === 'NXT' || v === 'NEXT' || v === 'NX') return 'NXT';
  if (['1', '2', '3'].includes(v)) return v;
  return '';
}

const Mark = z.object({
  code: z.string().min(1).max(20),
  zone_key: z.string().max(40).optional(),
  zone_label: z.string().min(1).max(60),
  x: z.number().min(0).max(976).optional(),
  y: z.number().min(0).max(1091).optional(),
  name: z.string().max(120).optional(),
});

const Entry = z.object({
  client_id: z.string().min(8).max(100),
  house: z.enum(['GH1', 'GH2']),
  line: z.string().regex(/^[A-Za-z][A-Za-z0-9]?$/),
  pen: z.coerce.number().int().min(1).max(200),
  tag: z.string().trim().min(1).max(40),
  size_cm: z.coerce.number().min(5).max(300).nullable().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  cull: z.string().max(10).nullable().optional(),
  marks: z.array(Mark).max(100).default([]),
  photo_path: z.string().max(300).optional(),
  photo_base64: z.string().optional(),
  photo_content_type: z.enum(['image/jpeg', 'image/png']).optional(),
});
const Batch = z.object({ entries: z.array(Entry).min(1).max(200) });
type EntryT = z.infer<typeof Entry>;

function b64ToBytes(b64: string) {
  const clean = b64.replace(/^data:[^;]+;base64,/, '');
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function ingest(e: EntryT) {
  const { data: seen } = await db.from('capture_ingest_log').select('client_id').eq('client_id', e.client_id).maybeSingle();
  if (seen) return { client_id: e.client_id, status: 'duplicate' };

  const tag = e.tag.trim();
  const cull = normaliseCull(e.cull);
  const plain = [...new Set(e.marks.map(m => m.code))];
  const detailed = e.marks.map(m => `${m.code}@${m.zone_label}`);
  const live = [...plain];
  if (cull && cull !== 'CULLED') live.push(`CULL-${cull}`);
  const size = e.size_cm ?? null;
  const line = e.line.toUpperCase();

  const base: Record<string, unknown> = {
    tag, pen_id: e.house, line, pen_slot: e.pen, belly_cm: size,
    condition_codes: live, inspection_date: e.date, cull_schedule: cull || null,
  };

  const { data: ex } = await db.from('crocs').select('*').eq('tag', tag).maybeSingle();
  let crocId: number;
  if (!ex) {
    const { data, error } = await db.from('crocs').insert({ ...base, placement_date: e.date, placement_belly_cm: size, pen_since: e.date }).select('id').single();
    if (error) return { client_id: e.client_id, status: 'rejected', reason: error.message };
    crocId = data.id;
  } else {
    crocId = ex.id;
    if ((ex.inspection_date ?? '') <= e.date) {
      const moved = ex.pen_id !== e.house || ex.line !== line || ex.pen_slot !== e.pen;
      const { error } = await db.from('crocs').update({
        ...base,
        placement_date: ex.placement_date ?? e.date,
        placement_belly_cm: ex.placement_belly_cm ?? size,
        pen_since: moved ? e.date : (ex.pen_since ?? e.date),
      }).eq('id', ex.id);
      if (error) return { client_id: e.client_id, status: 'rejected', reason: error.message };
    }
  }

  await db.from('inspections').delete().eq('croc_id', crocId).eq('inspection_date', e.date);
  const { error: iErr } = await db.from('inspections').insert({
    croc_id: crocId, inspection_date: e.date, belly_cm: size,
    condition_codes: detailed.length ? detailed : plain, pen_id: e.house, line, pen_slot: e.pen,
  });
  if (iErr) return { client_id: e.client_id, status: 'rejected', reason: iErr.message };

  let photo_url: string | null = null;
  let path = e.photo_path ?? null;
  if (!path && e.photo_base64) {
    const bytes = b64ToBytes(e.photo_base64);
    if (bytes.length > MAX_PHOTO_BYTES) return { client_id: e.client_id, status: 'rejected', reason: 'photo too large' };
    const ext = e.photo_content_type === 'image/png' ? 'png' : 'jpg';
    path = `${tag}/${e.date}-${e.client_id}.${ext}`;
    const up = await db.storage.from(BUCKET).upload(path, bytes, { contentType: e.photo_content_type ?? 'image/jpeg', upsert: true });
    if (up.error) return { client_id: e.client_id, status: 'rejected', reason: `photo: ${up.error.message}` };
  }
  if (path) {
    photo_url = db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    const marks = e.marks.map((m, i) => ({ id: `${e.client_id}-${i}`, zoneKey: m.zone_key ?? '', zoneLabel: m.zone_label, code: m.code, name: m.name ?? m.code, mx: m.x ?? 0, my: m.y ?? 0 }));
    await db.from('croc_photos').insert({ croc_id: crocId, tag, inspection_date: e.date, photo_url, storage_path: path, belly_cm: size, marks });
  }

  await db.from('capture_ingest_log').insert({ client_id: e.client_id, croc_id: crocId, tag, inspection_date: e.date });
  return { client_id: e.client_id, status: 'saved', croc_id: crocId, photo_url };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const key = Deno.env.get('CAPTURE_API_KEY');
  if (!key || req.headers.get('x-api-key') !== key) return json({ error: 'unauthorized' }, 401);

  const route = new URL(req.url).pathname.replace(/^.*\/ingest-capture/, '') || '/';
  try {
    if (req.method === 'GET' && route === '/health') return json({ ok: true, time: new Date().toISOString() });

    if (req.method === 'GET' && route === '/conditions') {
      const { data, error } = await db.from('condition_codes').select('*');
      if (error) return json({ error: error.message }, 500);
      return json({ conditions: (data ?? []).filter((c: any) => c.code?.toLowerCase() !== 'kk' && !/^malnourish/i.test(c.name ?? '')) });
    }

    if (req.method === 'POST' && route === '/photo') {
      const form = await req.formData();
      const file = form.get('photo');
      const tag = String(form.get('tag') ?? '').trim();
      const date = String(form.get('date') ?? '');
      const clientId = String(form.get('client_id') ?? '');
      if (!(file instanceof File)) return json({ error: 'photo file required' }, 400);
      if (!tag || !/^\d{4}-\d{2}-\d{2}$/.test(date) || clientId.length < 8) return json({ error: 'tag, date (YYYY-MM-DD) and client_id required' }, 400);
      if (!['image/jpeg', 'image/png'].includes(file.type)) return json({ error: 'only image/jpeg or image/png' }, 415);
      if (file.size > MAX_PHOTO_BYTES) return json({ error: 'photo too large (max 25 MB)' }, 413);
      const path = `${tag}/${date}-${clientId}.${file.type === 'image/png' ? 'png' : 'jpg'}`;
      const up = await db.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: true });
      if (up.error) return json({ error: up.error.message }, 500);
      return json({ photo_path: path, photo_url: db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl });
    }

    if (req.method === 'POST' && route === '/') {
      const parsed = Batch.safeParse(await req.json());
      if (!parsed.success) return json({ error: 'validation_failed', details: parsed.error.flatten() }, 400);
      const results = [];
      for (const e of parsed.data.entries) {
        try { results.push(await ingest(e)); }
        catch (err) { results.push({ client_id: e.client_id, status: 'rejected', reason: String(err) }); }
      }
      return json({ results, saved: results.filter(r => r.status === 'saved').length });
    }
    return json({ error: 'not_found' }, 404);
  } catch (err) {
    return json({ error: 'server_error', message: String(err) }, 500);
  }
});
