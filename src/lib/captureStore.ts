/**
 * Durable local storage for the field-capture session.
 *
 * Uses IndexedDB (survives page close, browser restart and device reboot, and
 * has no ~5 MB cap like localStorage — important because each entry carries a
 * compressed photo). Falls back to localStorage when IndexedDB is unavailable.
 */

const DB_NAME = 'croctrack-capture';
const DB_VERSION = 1;
const STORE = 'pending';
const META = 'meta';
const LS_KEY = 'croctrack.field-capture.pending.v2';
const LS_DRAFT_KEY = 'croctrack.field-capture.draft.v1';

let dbPromise: Promise<IDBDatabase> | null = null;

function hasIDB() {
  try { return typeof indexedDB !== 'undefined'; } catch { return false; }
}

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(META)) db.createObjectStore(META);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(db => new Promise<T>((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = fn(t.objectStore(store));
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  }));
}

/** Ask the browser not to evict our data under storage pressure. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && await navigator.storage.persisted()) return true;
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch { /* ignore */ }
  return false;
}

export async function getStorageEstimate(): Promise<{ usage: number; quota: number } | null> {
  try {
    const e = await navigator.storage?.estimate?.();
    if (!e) return null;
    return { usage: e.usage ?? 0, quota: e.quota ?? 0 };
  } catch { return null; }
}

export async function loadPendingEntries<T extends { id: string; createdAt?: number }>(): Promise<T[]> {
  // Migrate any legacy localStorage queue into IndexedDB once.
  let legacy: T[] = [];
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) legacy = JSON.parse(raw) as T[];
  } catch { /* ignore */ }

  if (!hasIDB()) return legacy;

  try {
    const rows = await tx<T[]>(STORE, 'readonly', s => s.getAll() as IDBRequest<T[]>);
    if (legacy.length) {
      const known = new Set(rows.map(r => r.id));
      const merged = [...rows, ...legacy.filter(l => !known.has(l.id))];
      await savePendingEntries(merged);
      try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
      return sortEntries(merged);
    }
    return sortEntries(rows);
  } catch {
    return legacy;
  }
}

function sortEntries<T extends { createdAt?: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
}

export async function savePendingEntries<T extends { id: string }>(entries: T[]): Promise<void> {
  if (!hasIDB()) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(entries)); } catch { throw new Error('Device storage is full'); }
    return;
  }
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(STORE, 'readwrite');
    const store = t.objectStore(STORE);
    store.clear();
    entries.forEach(e => store.put(e));
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export async function clearPendingEntries(): Promise<void> {
  try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
  if (!hasIDB()) return;
  await tx(STORE, 'readwrite', s => s.clear());
}

/** The in-progress (not yet saved) entry, so a reload mid-capture loses nothing. */
export async function saveDraftEntry(draft: unknown): Promise<void> {
  if (!hasIDB()) {
    try { localStorage.setItem(LS_DRAFT_KEY, JSON.stringify(draft)); } catch { /* ignore */ }
    return;
  }
  try { await tx(META, 'readwrite', s => s.put(draft, 'draft')); } catch { /* ignore */ }
}

export async function loadDraftEntry<T>(): Promise<T | null> {
  if (hasIDB()) {
    try {
      const v = await tx<T>(META, 'readonly', s => s.get('draft') as IDBRequest<T>);
      if (v) return v;
    } catch { /* ignore */ }
  }
  try {
    const raw = localStorage.getItem(LS_DRAFT_KEY);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch { return null; }
}
