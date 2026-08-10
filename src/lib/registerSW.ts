/**
 * Single, guarded service-worker registration point.
 *
 * Offline support only ever activates in the published app — never in dev,
 * never inside the Lovable preview iframe. `?sw=off` is a kill switch.
 */

const SW_URL = '/sw.js';

function isBlockedContext(): boolean {
  if (!import.meta.env.PROD) return true;
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  const host = window.location.hostname;
  if (host.startsWith('id-preview--') || host.startsWith('preview--')) return true;
  if (host === 'lovableproject.com' || host.endsWith('.lovableproject.com')) return true;
  if (host === 'lovableproject-dev.com' || host.endsWith('.lovableproject-dev.com')) return true;
  if (host === 'beta.lovable.dev' || host.endsWith('.beta.lovable.dev')) return true;
  if (new URL(window.location.href).searchParams.get('sw') === 'off') return true;
  return false;
}

async function unregisterOurWorkers() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.allSettled(
      regs
        .filter(r => (r.active?.scriptURL ?? r.installing?.scriptURL ?? '').endsWith(SW_URL))
        .map(r => r.unregister()),
    );
  } catch {
    /* ignore */
  }
}

export function registerOfflineSupport() {
  if (!('serviceWorker' in navigator)) return;
  if (isBlockedContext()) {
    void unregisterOurWorkers();
    return;
  }
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(SW_URL, { scope: '/' }).catch(() => {
      /* offline support is best-effort */
    });
  });
}
