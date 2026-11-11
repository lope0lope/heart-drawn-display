// Uploads from the CrocTrack website itself need no key; anything else (external apps) must send x-api-key.
const APP_ORIGINS = [/^https:\/\/heart-drawn-display\.lovable\.app$/, /^https:\/\/[a-z0-9-]+--9d506385-223e-4e62-8826-de39a22b559d\.lovable\.app$/, /^https:\/\/9d506385-223e-4e62-8826-de39a22b559d\.lovableproject\.com$/, /^http:\/\/localhost:\d+$/];
export function uploadAllowed(req: Request): boolean {
  const key = Deno.env.get('CAPTURE_API_KEY');
  if (key && req.headers.get('x-api-key') === key) return true;
  const origin = req.headers.get('origin') ?? '';
  return APP_ORIGINS.some(r => r.test(origin));
}
