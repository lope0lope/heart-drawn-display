import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { captureRequest } from '@/lib/cloudConnection';

import { useOnlineStatus, useOfflineConditionCodes } from '@/hooks/useOffline';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Trash2, Plus, CloudUpload, Save, Pencil, X, Camera, ImagePlus, HardDrive, Wifi, WifiOff } from 'lucide-react';

import { normaliseCull, cullToConditionCode } from '@/lib/inspectionParser';
import CrocConditionMap from '@/components/CrocConditionMap';
import { marksToCodes, markToString, type ConditionMark } from '@/lib/crocZones';
import { prepareFilePhoto, dataUrlToBlob } from '@/lib/photoUtils';
import OTGCameraCapture from '@/components/OTGCameraCapture';
import { PHOTO_BUCKET } from '@/hooks/useCrocPhotos';
import { insertSafe, insertOneSafe, updateSafeById, CROC_PLACEMENT_KEYS, INSPECTION_PEN_KEYS } from '@/lib/schemaSafe';
import {
  loadPendingEntries, savePendingEntries, clearPendingEntries,
  saveDraftEntry, loadDraftEntry, requestPersistentStorage, getStorageEstimate,
} from '@/lib/captureStore';


const HOUSES = ['GH1', 'GH2'] as const;
const LINES = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N'];
const CULL_OPTS = ['', 'CULLED', 'NXT', '1', '2', '3'] as const;
const CULL_LABELS: Record<string, string> = {
  '': '—', CULLED: 'Cull', NXT: 'NXT', '1': '1', '2': '2', '3': '3',
};

interface Entry {
  id: string;
  house: 'GH1' | 'GH2';
  line: string;
  slot: string;
  tag: string;
  size: string;
  date: string; // yyyy-mm-dd
  marks: ConditionMark[];
  photo: string; // small preview for the UI (thumbnails)
  photoFull: string; // full-resolution source (e.g. 4K OTG camera frame) uploaded for inspection
  photoRes?: string; // native capture resolution, e.g. "4096 × 3072"
  cull: string;
  createdAt: number;
}

function newEntry(prev?: Partial<Entry>): Entry {
  return {
    id: crypto.randomUUID(),
    house: (prev?.house as any) ?? 'GH1',
    line: prev?.line ?? 'A',
    slot: '',
    tag: '',
    size: '',
    date: prev?.date ?? new Date().toISOString().slice(0, 10),
    marks: [],
    photo: '',
    photoFull: '',
    photoRes: undefined,
    cull: '',
    createdAt: Date.now(),
  };
}

export default function FieldCaptureScreen() {
  const conditionCodes = useOfflineConditionCodes();
  const online = useOnlineStatus();

  const queryClient = useQueryClient();

  const [draft, setDraft] = useState<Entry>(() => newEntry());
  const [pending, setPending] = useState<Entry[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [committing, setCommitting] = useState(false);
  const [restored, setRestored] = useState(false);
  const [persistent, setPersistent] = useState(false);
  const [usageMb, setUsageMb] = useState<number | null>(null);
  const [camOpen, setCamOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Restore anything captured before the page/device was closed.
  useEffect(() => {
    let alive = true;
    (async () => {
      const [queue, savedDraft, granted] = await Promise.all([
        loadPendingEntries<Entry>(),
        loadDraftEntry<Entry>(),
        requestPersistentStorage(),
      ]);
      if (!alive) return;
      setPending(queue);
      if (savedDraft?.id) setDraft(savedDraft);
      setPersistent(granted);
      setRestored(true);
      if (queue.length) {
        toast.success(`Restored ${queue.length} unsent ${queue.length === 1 ? 'entry' : 'entries'} from this device`);
      }
      const est = await getStorageEstimate();
      if (alive && est) setUsageMb(est.usage / (1024 * 1024));
    })();
    return () => { alive = false; };
  }, []);

  // Persist the queue on every change (after the initial restore).
  useEffect(() => {
    if (!restored) return;
    savePendingEntries(pending).catch(() => {
      toast.error('Device storage is full — commit the queue to free space.');
    });
    getStorageEstimate().then(est => { if (est) setUsageMb(est.usage / (1024 * 1024)); });
  }, [pending, restored]);

  // Persist the in-progress entry so a reload mid-capture loses nothing.
  useEffect(() => {
    if (!restored) return;
    const t = setTimeout(() => { saveDraftEntry(draft); }, 400);
    return () => clearTimeout(t);
  }, [draft, restored]);


  const isValid = useMemo(() => {
    const slotN = parseInt(draft.slot, 10);
    return draft.house && draft.line && Number.isFinite(slotN) && slotN >= 1
      && draft.tag.trim().length > 0 && !!draft.date;
  }, [draft]);

  const onPickPhoto = async (file?: File) => {
    if (!file) return;
    try {
      // Keep the original capture resolution; only the UI thumbnail is compressed.
      const { full, preview, width, height } = await prepareFilePhoto(file);
      setDraft(d => ({ ...d, photo: preview, photoFull: full, photoRes: `${width} × ${height}` }));
    } catch (err: any) {
      toast.error(err.message ?? 'Could not process that photo');
    }
  };

  // Photo shared in from another app (Android Share menu → CrocTrack).
  useEffect(() => {
    if (!restored) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('shared') !== '1' || !('caches' in window)) return;
    (async () => {
      try {
        const cache = await caches.open('shared-photos');
        const res = await cache.match('/shared-photo');
        if (!res) return;
        const blob = await res.blob();
        const name = decodeURIComponent(res.headers.get('X-File-Name') || 'shared.jpg');
        await onPickPhoto(new File([blob], name, { type: blob.type || 'image/jpeg' }));
        await cache.delete('/shared-photo');
        toast.success('Shared photo attached to this entry');
      } finally {
        window.history.replaceState(null, '', window.location.pathname);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restored]);

  const onCameraCapture = (r: { full: string; preview: string; width: number; height: number }) => {
    setDraft(d => ({ ...d, photo: r.preview, photoFull: r.full, photoRes: `${r.width} × ${r.height}` }));
    toast.success(`Captured at ${r.width} × ${r.height} — full resolution stored`);
  };

  const saveDraft = useCallback(() => {
    if (!isValid) {
      toast.error('Fill in House, Line, Pen, Tag and Date first.');
      return;
    }
    if (editingId) {
      setPending(p => p.map(e => e.id === editingId ? { ...draft, id: editingId } : e));
      toast.success('Entry updated');
      setEditingId(null);
    } else {
      setPending(p => [...p, { ...draft, id: crypto.randomUUID() }]);
      toast.success(`Saved ${draft.tag} to pending queue`);
    }
    // Prefill next entry with same house/line/date for fast farm-walk capture
    setDraft(newEntry({ house: draft.house, line: draft.line, date: draft.date }));
  }, [draft, editingId, isValid]);

  const editEntry = (e: Entry) => {
    setDraft({ ...e });
    setEditingId(e.id);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(newEntry({ house: draft.house, line: draft.line, date: draft.date }));
  };

  const removeEntry = (id: string) => {
    setPending(p => p.filter(e => e.id !== id));
    if (editingId === id) cancelEdit();
  };

  const clearAll = () => {
    if (!confirm('Discard all pending entries?')) return;
    setPending([]);
    clearPendingEntries();
    cancelEdit();
  };


  const commitAll = useCallback(async () => {
    if (!pending.length) return;
    if (!navigator.onLine) {
      toast.error('No connection — the queue stays safely on this device. Commit once you are back online.');
      return;
    }
    setCommitting(true);

    try {
      let saved = 0, duplicates = 0;
      const completed = new Set<string>();
      const failures: string[] = [];
      for (const e of pending) {
        try {
          const entry: Record<string, unknown> = {
            client_id: e.id, house: e.house, line: e.line, pen: Number(e.slot),
            tag: e.tag.trim(), size_cm: e.size ? Number(e.size) : null,
            date: e.date, cull: e.cull,
            marks: e.marks.map(m => ({ code: m.code, zone_key: m.zoneKey, zone_label: m.zoneLabel, x: m.mx, y: m.my, name: m.name })),
          };
          if (e.photoFull || e.photo) {
            const blob = dataUrlToBlob(e.photoFull || e.photo);
            const form = new FormData();
            form.append('photo', blob, blob.type === 'image/png' ? 'capture.png' : 'capture.jpg');
            form.append('tag', e.tag.trim()); form.append('date', e.date); form.append('client_id', e.id);
            const uploaded = await captureRequest('/photo', { method: 'POST', body: form });
            entry.photo_path = uploaded.photo_path;
          }
          const response = await captureRequest('', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entries: [entry] }) });
          const result = response.results?.[0];
          if (result?.status === 'saved' || result?.status === 'duplicate') {
            completed.add(e.id);
            if (result.status === 'saved') saved++; else duplicates++;
          } else failures.push(result?.reason ?? 'Entry rejected');
        } catch (error) { failures.push(error instanceof Error ? error.message : 'Upload failed'); }
      }
      const remaining = pending.filter(e => !completed.has(e.id));
      await savePendingEntries(remaining);
      setPending(remaining);
      queryClient.invalidateQueries();
      if (saved || duplicates) toast.success(`Committed: ${saved} saved · ${duplicates} already saved`);
      if (failures.length) toast.error(`${failures.length} entries remain on this device: ${failures[0]}`);
    } catch (err: any) {
      toast.error(`Commit failed: ${err.message ?? err}`);
    } finally {
      setCommitting(false);
    }
  }, [pending, queryClient]);

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* On-device storage status */}
      <div className="flex flex-wrap items-center gap-2 bg-surface-2/50 border border-border rounded-sm px-3 py-2 font-mono-ibm text-[10px] uppercase tracking-[1.5px] text-ct-text3">
        {online ? <Wifi className="w-3.5 h-3.5 text-ct-good flex-shrink-0" /> : <WifiOff className="w-3.5 h-3.5 text-ct-warn flex-shrink-0" />}
        <span className={online ? 'text-ct-good' : 'text-ct-warn'}>{online ? 'Online' : 'Offline — capture continues'}</span>
        <span className="text-border">·</span>
        <HardDrive className="w-3.5 h-3.5 text-ct-accent flex-shrink-0" />
        <span className="text-ct-text2">
          {restored ? `${pending.length} unsent on this device` : 'Restoring local session…'}
        </span>
        <span className="text-border">·</span>
        <span>{persistent ? 'Persistent storage granted' : 'Saved in device database'}</span>
        {usageMb !== null && (
          <>
            <span className="text-border">·</span>
            <span>{usageMb.toFixed(1)} MB used</span>
          </>
        )}
        <span className="text-border hidden sm:inline">·</span>
        <span className="hidden sm:inline">Survives page close &amp; device restart</span>
      </div>

      {!online && (
        <div className="bg-ct-warn/10 border border-ct-warn/40 rounded-sm px-3 py-2 font-mono-ibm text-[11px] text-ct-warn">
          No connection. Keep capturing — every entry and photo is stored on this tablet and the
          <span className="font-semibold"> Commit </span> button will sync the whole queue once you are back in coverage.
        </div>
      )}


      {/* Draft form */}
      <div className="bg-surface border border-border rounded-sm p-4 sm:p-6">

        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-display text-xl sm:text-2xl text-ct-accent tracking-wider">
              {editingId ? 'Edit Entry' : 'New Field Entry'}
            </h2>
            <p className="font-mono-ibm text-[10px] text-ct-text3 uppercase tracking-[2px] mt-1">
              Capture one crocodile at a time · saved locally until committed
            </p>
          </div>
          {editingId && (
            <button onClick={cancelEdit} className="text-ct-text3 hover:text-ct-text p-2 active:scale-95" aria-label="Cancel edit">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          <Field label="House">
            <SelectBig value={draft.house} onChange={v => setDraft(d => ({ ...d, house: v as any }))}
              options={HOUSES.map(h => ({ value: h, label: h }))} />
          </Field>
          <Field label="Line">
            <SelectBig value={draft.line} onChange={v => setDraft(d => ({ ...d, line: v }))}
              options={LINES.map(l => ({ value: l, label: l }))} />
          </Field>
          <Field label="Pen">
            <InputBig type="number" inputMode="numeric" min="1" value={draft.slot}
              onChange={v => setDraft(d => ({ ...d, slot: v }))} placeholder="e.g. 12" />
          </Field>
          <Field label="Tag">
            <InputBig value={draft.tag} onChange={v => setDraft(d => ({ ...d, tag: v }))}
              placeholder="Tag ID" />
          </Field>
          <Field label="Size (cm)">
            <InputBig type="number" inputMode="decimal" step="0.1" value={draft.size}
              onChange={v => setDraft(d => ({ ...d, size: v }))} placeholder="e.g. 34" />
          </Field>
          <Field label="Cull">
            <SelectBig value={draft.cull} onChange={v => setDraft(d => ({ ...d, cull: v }))}
              options={CULL_OPTS.map(c => ({ value: c, label: CULL_LABELS[c] ?? c }))} />
          </Field>
          <Field label="Date">
            <InputBig type="date" value={draft.date} onChange={v => setDraft(d => ({ ...d, date: v }))} />
          </Field>
        </div>

        {/* Photo (optional) */}
        <div className="mt-6">
          <div className="font-mono-ibm text-[10px] text-ct-text3 uppercase tracking-[2px] mb-2">
            Photo · optional
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => onPickPhoto(e.target.files?.[0] ?? undefined)}
          />
          {draft.photo ? (
            <div className="flex items-center gap-3">
              <img src={draft.photo} alt="Captured crocodile" className="w-24 h-24 object-cover rounded-sm border border-border" />
              <div className="flex flex-col gap-2 items-start">
                {draft.photoRes && (
                  <span className="font-mono-ibm text-[10px] text-ct-good uppercase tracking-[1.5px]">
                    {draft.photoRes} stored full-res
                  </span>
                )}
                <button
                  onClick={() => setCamOpen(true)}
                  className="font-mono-ibm text-[11px] uppercase tracking-[1.5px] text-ct-accent border border-border rounded-sm px-3 py-2 active:scale-95 hover:border-ct-accent"
                >
                  Retake (camera)
                </button>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="font-mono-ibm text-[11px] uppercase tracking-[1.5px] text-ct-text2 border border-border rounded-sm px-3 py-2 active:scale-95 hover:border-ct-accent"
                >
                  Attach file
                </button>
                <button
                  onClick={() => setDraft(d => ({ ...d, photo: '', photoFull: '', photoRes: undefined }))}
                  className="font-mono-ibm text-[11px] uppercase tracking-[1.5px] text-ct-danger px-3 py-2 active:scale-95"
                >
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={() => setCamOpen(true)}
                className="flex items-center justify-center gap-2 border border-ct-accent/50 rounded-sm py-6 text-ct-accent font-mono-ibm text-xs uppercase tracking-[1.5px] hover:border-ct-accent hover:bg-ct-accent/5 active:scale-[.99] transition-all"
              >
                <Camera className="w-4 h-4" />
                Use OTG camera
              </button>
              <button
                onClick={() => fileRef.current?.click()}
                className="flex items-center justify-center gap-2 border border-dashed border-border rounded-sm py-6 text-ct-text2 font-mono-ibm text-xs uppercase tracking-[1.5px] hover:border-ct-accent hover:text-ct-accent active:scale-[.99] transition-all"
              >
                <ImagePlus className="w-4 h-4" />
                Attach photo file
              </button>
            </div>
          )}
        </div>

        {/* Location-based conditions */}
        <div className="mt-6">
          <div className="font-mono-ibm text-[10px] text-ct-text3 uppercase tracking-[2px] mb-3">
            Conditions — tap a spot on the diagram
          </div>
          {conditionCodes.length === 0 && (
            <div className="text-ct-text3 text-xs mb-2">Loading condition codes…</div>
          )}
          <CrocConditionMap
            marks={draft.marks}
            onChange={marks => setDraft(d => ({ ...d, marks }))}
            conditionCodes={conditionCodes}
          />
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <button
            onClick={saveDraft}
            disabled={!isValid}
            className="flex-1 flex items-center justify-center gap-2 bg-ct-accent text-background font-mono-ibm text-sm font-semibold tracking-[1.5px] uppercase py-4 rounded-sm hover:bg-ct-accent2 active:scale-[.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {editingId ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {editingId ? 'Update Entry' : 'Save Entry'}
          </button>
        </div>
      </div>

      {camOpen && (
        <OTGCameraCapture
          onCapture={onCameraCapture}
          onFallbackFile={f => { onPickPhoto(f); }}
          onClose={() => setCamOpen(false)}
        />
      )}

      {/* Pending queue */}
      <div className="bg-surface border border-border rounded-sm p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-display text-lg sm:text-xl text-ct-text tracking-wider">
              Pending Queue
              <span className="ml-2 text-ct-accent">({pending.length})</span>
            </h2>
            <p className="font-mono-ibm text-[10px] text-ct-text3 uppercase tracking-[2px] mt-1">
              Stored locally on this device
            </p>
          </div>
          {pending.length > 0 && (
            <button
              onClick={clearAll}
              className="text-xs font-mono-ibm text-ct-danger hover:underline uppercase tracking-wider"
            >
              Discard All
            </button>
          )}
        </div>

        {pending.length === 0 ? (
          <div className="text-center py-10 text-ct-text3 font-mono-ibm text-xs uppercase tracking-[2px]">
            No entries queued
          </div>
        ) : (
          <div className="space-y-2">
            {pending.map(e => (
              <div key={e.id} className={`flex items-center gap-3 p-3 rounded-sm border ${
                editingId === e.id ? 'border-ct-accent bg-surface-2' : 'border-border bg-surface-2/50'
              }`}>
                {e.photo ? (
                  <img src={e.photo} alt={`Croc ${e.tag}`} className="w-12 h-12 object-cover rounded-sm border border-border flex-shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-sm border border-dashed border-border flex items-center justify-center text-[8px] font-mono-ibm text-ct-text3 flex-shrink-0 text-center leading-tight">no<br />photo</div>
                )}
                <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs font-mono-ibm">
                  <div><span className="text-ct-text3">Pen </span><span className="text-ct-accent">{e.house} {e.line}{e.slot}</span></div>
                  <div><span className="text-ct-text3">Tag </span><span className="text-ct-text">{e.tag}</span></div>
                  <div><span className="text-ct-text3">Size </span><span className="text-ct-text">{e.size || '—'} cm</span></div>
                  <div><span className="text-ct-text3">Cull </span><span className="text-ct-text">{e.cull || '—'}</span></div>
                  <div className="truncate"><span className="text-ct-text3">Cond </span><span className="text-ct-text">{e.marks.map(markToString).join(', ') || '—'}</span></div>
                </div>
                <button onClick={() => editEntry(e)} className="p-2 text-ct-text2 hover:text-ct-accent active:scale-95" aria-label="Edit">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => removeEntry(e.id)} className="p-2 text-ct-text2 hover:text-ct-danger active:scale-95" aria-label="Delete">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={commitAll}
          disabled={!pending.length || committing || !online}
          className="mt-5 w-full flex items-center justify-center gap-2 bg-ct-good text-background font-mono-ibm text-sm font-semibold tracking-[1.5px] uppercase py-4 rounded-sm hover:opacity-90 active:scale-[.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {online ? <CloudUpload className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
          {committing
            ? 'Committing…'
            : !online
              ? `${pending.length} queued · waiting for connection`
              : `Commit ${pending.length} to Dataset`}
        </button>

      </div>
    </div>
  );
}

/* --- inputs (large touch targets for tablet use) --- */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono-ibm text-[10px] text-ct-text3 uppercase tracking-[2px]">{label}</span>
      {children}
    </label>
  );
}

function InputBig(props: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  inputMode?: any;
  step?: string;
  min?: string;
}) {
  const { onChange, ...rest } = props;
  return (
    <input
      {...rest}
      onChange={e => onChange(e.target.value)}
      className="bg-surface-2 border border-border text-ct-text px-3 py-3 rounded-sm font-mono-ibm text-sm outline-none focus:border-ct-accent"
    />
  );
}

function SelectBig({ value, onChange, options }: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="bg-surface-2 border border-border text-ct-text px-3 py-3 rounded-sm font-mono-ibm text-sm outline-none focus:border-ct-accent"
    >
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
