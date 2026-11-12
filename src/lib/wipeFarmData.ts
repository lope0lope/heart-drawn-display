import { captureHeaders } from '@/lib/cloudConnection';

/** The Cloud function wipes all related records in a single transaction. */
export async function wipeFarmData() {
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/farm-write/wipe`, {
    method: 'POST',
    headers: { ...captureHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirmation: 'WIPE' }),
  });
  const data = await response.json();
  if (!response.ok || data.ok !== true) throw new Error(data.message || 'Wipe failed; please try again.');
}