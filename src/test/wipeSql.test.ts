import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(`${process.cwd()}/drizzle/migrations/0003_fix_wipe_safe_delete_predicates.sql`, 'utf8');

describe('Cloud-safe complete dataset wipe', () => {
  for (const [table, key] of [
    ['capture_ingest_log', 'client_id'],
    ['croc_photos', 'id'],
    ['inspections', 'id'],
    ['cull_records', 'id'],
    ['feed_records', 'id'],
    ['crocs', 'id'],
    ['upload_logs', 'id'],
  ]) {
    it(`deletes all ${table} rows with the explicit predicate Cloud requires`, () => {
      expect(sql).toContain(`DELETE FROM public.${table} WHERE ${key} IS NOT NULL;`);
      expect(sql).not.toContain(`DELETE FROM public.${table};`);
    });
  }
});