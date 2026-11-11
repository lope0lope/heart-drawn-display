import { createClient } from '@supabase/supabase-js';
import type { Database } from '../supabase/types';
import { getUploadKey } from '@/lib/cloudConnection';

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Reads stay account-free. All dataset/file writes pass through a key-checked function.
export const supabase = createClient<Database>(url, publishableKey, {
  global: {
    fetch: async (input, init) => {
      const request = new Request(input, init);
      const target = new URL(request.url);
      const fileWrite = target.pathname.startsWith('/storage/v1/object/') && !target.pathname.startsWith('/storage/v1/object/sign/');
      const dataWrite = target.pathname.startsWith('/rest/v1/');
      if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && (fileWrite || dataWrite)) {
        const key = getUploadKey();
        const headers = new Headers(request.headers);
        headers.delete('authorization');
        headers.set('apikey', publishableKey);
        if (key) headers.set('x-api-key', key);
        headers.set('x-farm-path', target.pathname + target.search);
        headers.set('x-farm-method', request.method);
        return fetch(`${url}/functions/v1/farm-write`, { method: 'POST', headers, body: await request.arrayBuffer() });
      }
      const headers = new Headers(request.headers);
      if (headers.get('Authorization') === `Bearer ${publishableKey}`) headers.delete('Authorization');
      headers.set('apikey', publishableKey);
      return fetch(request, { headers });
    },
  },
});