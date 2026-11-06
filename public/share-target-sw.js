/*
 * Receives photos shared from other Android apps (e.g. "USB Camera") into the
 * installed CrocTrack app. Stores the file, then opens the capture page which
 * attaches it to the current entry at full resolution.
 */
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'POST' || url.pathname !== '/share-target') return;
  event.respondWith((async () => {
    try {
      const form = await event.request.formData();
      const file = form.getAll('photo').find(f => f && typeof f !== 'string');
      if (file) {
        const cache = await caches.open('shared-photos');
        await cache.put('/shared-photo', new Response(file, {
          headers: { 'Content-Type': file.type || 'image/jpeg', 'X-File-Name': encodeURIComponent(file.name || 'shared.jpg') },
        }));
      }
    } catch (e) { /* fall through to redirect */ }
    return Response.redirect('/capture?shared=1', 303);
  })());
});
