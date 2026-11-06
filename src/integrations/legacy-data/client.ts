import { createClient } from '@supabase/supabase-js';

// Preserve the existing farm dataset until a separate, verified Cloud migration.
export const supabase = createClient(
  'https://ngwziztwvjlbdslhbwdj.supabase.co',
  'sb_publishable_tyAUb20moMlyE8Sd666h8A_-KEIqVA7',
);