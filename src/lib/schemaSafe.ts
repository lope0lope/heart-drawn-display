import { supabase } from '@/integrations/supabase/client';

/**
 * Newer columns (placement / pen-history tracking) only exist once the
 * accompanying SQL migration has been run. These helpers write them when
 * available and silently fall back to the legacy shape when the column is
 * missing, so uploads never break on a database that is a step behind.
 */

function omit<T extends Record<string, any>>(row: T, keys: string[]): T {
  const copy: Record<string, any> = { ...row };
  for (const k of keys) delete copy[k];
  return copy as T;
}

function isMissingColumn(error: any): boolean {
  const msg = `${error?.message ?? ''} ${error?.details ?? ''}`.toLowerCase();
  return msg.includes('column') && (msg.includes('does not exist') || msg.includes('schema cache'));
}

export async function insertSafe(table: string, rows: any[], optionalKeys: string[]) {
  const { error } = await supabase.from(table as any).insert(rows);
  if (error && isMissingColumn(error)) {
    const stripped = rows.map(r => omit(r, optionalKeys));
    return await supabase.from(table as any).insert(stripped);
  }
  return { error };
}

export async function insertOneSafe(table: string, row: any, optionalKeys: string[]) {
  const first = await supabase.from(table as any).insert(row).select('id').single();
  if (first.error && isMissingColumn(first.error)) {
    return await supabase.from(table as any).insert(omit(row, optionalKeys)).select('id').single();
  }
  return first;
}

export async function updateSafeById(table: string, id: number, payload: any, optionalKeys: string[]) {
  const { error } = await supabase.from(table as any).update(payload).eq('id', id);
  if (error && isMissingColumn(error)) {
    return await supabase.from(table as any).update(omit(payload, optionalKeys)).eq('id', id);
  }
  return { error };
}

export const CROC_PLACEMENT_KEYS = ['placement_date', 'placement_belly_cm', 'pen_since'];
export const INSPECTION_PEN_KEYS = ['pen_id', 'line', 'pen_slot'];
