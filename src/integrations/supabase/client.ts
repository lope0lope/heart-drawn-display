import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ngwziztwvjlbdslhbwdj.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_tyAUb20moMlyE8Sd666h8A_-KEIqVA7';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
