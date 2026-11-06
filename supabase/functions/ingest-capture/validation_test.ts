import { Entry, MAX_PHOTO_BYTES, photoPath } from './validation.ts';
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
Deno.test('4K originals are accepted up to 25 MiB without any dimension restriction', () => {
  assertEquals(MAX_PHOTO_BYTES, 26214400);
  assertEquals(Entry.safeParse({client_id:'test-4k-image',house:'GH1',line:'A',pen:1,tag:'4K',size_cm:34,date:'2026-11-06',photo_path:'4K/2026-11-06-test-4k-image.jpg'}).success,true);
});
Deno.test('cull staff markers are preserved and unsupported values rejected', () => {
  const e = {client_id:'test-cull-marker',house:'GH1',line:'A',pen:1,tag:'T',date:'2026-11-06'};
  for (const cull of ['NXT','1','2','3','CULLED']) assertEquals(Entry.parse({...e,cull}).cull,cull);
  assertEquals(Entry.safeParse({...e,cull:'4'}).success,false);
});
Deno.test('photo paths cannot escape an entry folder', () => {
  assertEquals(photoPath({tag:'../TEST',date:'2026-11-06',client_id:'test-photo-path'},'image/png'),'..%2FTEST/2026-11-06-test-photo-path.png');
  assertEquals(Entry.safeParse({client_id:'../../bad',house:'GH1',line:'A',pen:1,tag:'T',date:'2026-11-06'}).success,false);
});