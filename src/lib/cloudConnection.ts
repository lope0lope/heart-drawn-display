const KEY_NAME = 'croctrack.cloud-upload-key';

export function getUploadKey() { return localStorage.getItem(KEY_NAME) ?? ''; }
export function saveUploadKey(key: string) { localStorage.setItem(KEY_NAME, key.trim()); }
export const captureEndpoint = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ingest-capture`;
export function captureHeaders() {
  const key = getUploadKey();
  if (!key) throw new Error('Set the upload connection key first using Connection settings.');
  return { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, 'x-api-key': key };
}

export async function captureRequest(path: string, init: RequestInit = {}) {
  const response = await fetch(`${captureEndpoint}${path}`, { ...init, headers: { ...captureHeaders(), ...init.headers } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? `Upload failed (${response.status})`);
  return data;
}