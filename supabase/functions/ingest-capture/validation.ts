import { z } from 'npm:zod@3';
export const MAX_PHOTO_BYTES = 25 * 1024 * 1024;
export const Entry = z.object({
  client_id: z.string().regex(/^[A-Za-z0-9_-]{8,100}$/),
  house: z.enum(['GH1','GH2']),
  line: z.string().trim().toUpperCase().regex(/^[A-N]$/),
  pen: z.coerce.number().int().min(1).max(200),
  tag: z.string().trim().min(1).max(40),
  size_cm: z.number().min(5).max(300).nullable().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v, 'Invalid date'),
  cull: z.enum(['','NX','NEXT','NXT','1','2','R','CULL','CULLED']).nullable().optional(),
  marks: z.array(z.object({ code: z.string().min(1).max(20), zone_key: z.string().max(40).optional(), zone_label: z.string().min(1).max(60), x: z.number().min(0).max(976).optional(), y: z.number().min(0).max(1091).optional(), name: z.string().max(120).optional() })).max(100).default([]),
  photo_path: z.string().max(300).optional(),
  photo_base64: z.string().max(Math.ceil(MAX_PHOTO_BYTES * 4 / 3) + 100).optional(),
  photo_content_type: z.enum(['image/jpeg','image/png']).optional(),
});
export function photoPath(e: { tag: string; date: string; client_id: string }, type: string) {
  return `${encodeURIComponent(e.tag)}/${e.date}-${e.client_id}.${type === 'image/png' ? 'png' : 'jpg'}`;
}