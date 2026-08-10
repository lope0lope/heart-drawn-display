import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useConditionCodes } from '@/hooks/useCrocs';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Trash2, Plus, CloudUpload, Save, Pencil, X, Camera, HardDrive } from 'lucide-react';
import { normaliseCull, cullToConditionCode } from '@/lib/inspectionParser';
import CrocConditionMap from '@/components/CrocConditionMap';
import { marksToCodes, markToString, type ConditionMark } from '@/lib/crocZones';
import { fileToCompressedDataUrl, dataUrlToBlob } from '@/lib/photoUtils';
import { PHOTO_BUCKET } from '@/hooks/useCrocPhotos';
import { insertSafe, insertOneSafe, updateSafeById, CROC_PLACEMENT_KEYS, INSPECTION_PEN_KEYS } from '@/lib/schemaSafe';
import {
  loadPendingEntries, savePendingEntries, clearPendingEntries,
  saveDraftEntry, loadDraftEntry, requestPersistentStorage, getStorageEstimate,
} from '@/lib/captureStore';


const HOUSES = ['GH1', 'GH2'] as const;
const LINES = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N'];
const CULL_OPTS = ['', 'NXT', '1', '2', '3'] as const;
const GRADES = ['', '1', '2'] as const;

interface Entry {
  id: string;
  house: 'GH1' | 'GH2';
  line: string;
  slot: string;
  tag: string;
  size: string;
  grade: string;
  date: string; // yyyy-mm-dd
  marks: ConditionMark[];
  photo: string; // compressed jpeg data URL (required)
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
    grade: '',
    date: prev?.date ?? new Date().toISOString().slice(0, 10),
    marks: [],
    photo: '',
    cull: '',
    createdAt: Date.now(),
  };
}

export default function FieldCaptureScreen() {
  const { data: conditionCodes = [] } = useConditionCodes();
  const queryClient = useQueryClient();

  const [draft, setDraft] = useState<Entry>(() => newEntry());
  const [pending, setPending] = useState<Entry[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [committing, setCommitting] = useState(false);
  const [restored, setRestored] = useState(false);
  const [persistent, setPersistent] = useState(false);
  const [usageMb, setUsageMb] = useState<number | null>(null);
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
      const dataUrl = await fileToCompressedDataUrl(file);
      setDraft(d => ({ ...d, photo: dataUrl }));
    } catch (err: any) {
      toast.error(err.message ?? 'Could not process that photo');
    }
  };

  const saveDraft = useCallback(() => {
    if (!isValid) {
      toast.error('Fill in House, Line, Slot, Tag and Date first.');
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
    setCommitting(true);
    let inserted = 0, updated = 0, inspections = 0, photos = 0, failed = 0;
    let photoWarning = '';

    try {
      const tags = [...new Set(pending.map(p => p.tag.trim()))];
      const { data: existing } = await supabase
        .from('crocs')
        .select('*')
        .in('tag', tags);
      const tagToId = new Map((existing ?? []).map(c => [c.tag, c as any] as const));

      for (const e of pending) {
        const slotN = parseInt(e.slot, 10);
        const plainCodes = marksToCodes(e.marks);
        const detailedCodes = e.marks.map(markToString);
        const cullCode = cullToConditionCode(e.cull);
        const liveCodes = [...plainCodes];
        if (cullCode) liveCodes.push(cullCode);

        const live: any = {
          tag: e.tag.trim(),
          pen_id: e.house,
          line: e.line,
          pen_slot: slotN,
          belly_cm: e.size ? parseFloat(e.size) : null,
          grade: e.grade ? parseInt(e.grade, 10) : null,
          condition_codes: liveCodes,
          inspection_date: e.date,
          cull_schedule: normaliseCull(e.cull) || null,
        };

        const ex = tagToId.get(e.tag.trim());
        let crocId: number | undefined = ex?.id;

        if (!ex) {
          const { data, error } = await insertOneSafe('crocs', {
            ...live,
            placement_date: e.date,
            placement_belly_cm: live.belly_cm,
            pen_since: e.date,
          }, CROC_PLACEMENT_KEYS);
          if (error) { failed++; console.error(error); continue; }
          crocId = (data as any).id;
          inserted++;
        } else {
          if ((ex.inspection_date ?? '') <= e.date) {
            const moved = ex.pen_id !== e.house || ex.line !== e.line || ex.pen_slot !== slotN;
            const { error } = await updateSafeById('crocs', ex.id, {
              ...live,
              placement_date: ex.placement_date ?? e.date,
              placement_belly_cm: ex.placement_belly_cm ?? live.belly_cm,
              pen_since: moved ? e.date : (ex.pen_since ?? e.date),
            }, CROC_PLACEMENT_KEYS);
            if (error) { failed++; console.error(error); continue; }
            updated++;
          }
        }

        if (crocId) {
          await supabase.from('inspections').delete()
            .eq('croc_id', crocId).eq('inspection_date', e.date);
          const { error } = await insertSafe('inspections', [{
            croc_id: crocId,
            inspection_date: e.date,
            belly_cm: live.belly_cm,
            condition_codes: detailedCodes.length ? detailedCodes : plainCodes,
            pen_id: e.house,
            line: e.line,
            pen_slot: slotN,
          }], INSPECTION_PEN_KEYS);
          if (error) { failed++; console.error(error); }
          else inspections++;

          // Photo evidence
          if (e.photo) {
            const path = `${e.tag.trim()}/${e.date}-${e.id}.jpg`;
            const up = await supabase.storage.from(PHOTO_BUCKET)
              .upload(path, dataUrlToBlob(e.photo), { contentType: 'image/jpeg', upsert: true });
            if (up.error) {
              photoWarning = up.error.message;
            } else {
              const { data: pub } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
              const { error: pErr } = await supabase.from('croc_photos').insert({
                croc_id: crocId,
                tag: e.tag.trim(),
                inspection_date: e.date,
                photo_url: pub.publicUrl,
                storage_path: path,
                belly_cm: live.belly_cm,
                marks: e.marks,
              });
              if (pErr) photoWarning = pErr.message;
              else photos++;
            }
          }
        }
      }

      queryClient.invalidateQueries();
      toast.success(`Committed: ${inserted} new · ${updated} updated · ${inspections} inspections · ${photos} photos${failed ? ` · ${failed} failed` : ''}`);
      if (photoWarning) {
        toast.error(`Photos not stored: ${photoWarning}`);
      }
      if (failed === 0 && !photoWarning) { setPending([]); await clearPendingEntries(); }
    } catch (err: any) {
      toast.error(`Commit failed: ${err.message ?? err}`);
    } finally {
      setCommitting(false);
    }
  }, [pending, queryClient]);

  return (
    <div className="max-w-5xl mx-auto space-y-5">
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
          <Field label="Slot">
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
          <Field label="Grading">
            <SelectBig value={draft.grade} onChange={v => setDraft(d => ({ ...d, grade: v }))}
              options={GRADES.map(g => ({ value: g, label: g || '—' }))} />
          </Field>
          <Field label="Cull">
            <SelectBig value={draft.cull} onChange={v => setDraft(d => ({ ...d, cull: v }))}
              options={CULL_OPTS.map(c => ({ value: c, label: c || 'None' }))} />
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
            capture="environment"
            className="hidden"
            onChange={e => onPickPhoto(e.target.files?.[0] ?? undefined)}
          />
          {draft.photo ? (
            <div className="flex items-center gap-3">
              <img src={draft.photo} alt="Captured crocodile" className="w-24 h-24 object-cover rounded-sm border border-border" />
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => fileRef.current?.click()}
                  className="font-mono-ibm text-[11px] uppercase tracking-[1.5px] text-ct-accent border border-border rounded-sm px-3 py-2 active:scale-95 hover:border-ct-accent"
                >
                  Retake
                </button>
                <button
                  onClick={() => setDraft(d => ({ ...d, photo: '' }))}
                  className="font-mono-ibm text-[11px] uppercase tracking-[1.5px] text-ct-danger px-3 py-2 active:scale-95"
                >
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 border border-dashed border-border rounded-sm py-6 text-ct-text2 font-mono-ibm text-xs uppercase tracking-[1.5px] hover:border-ct-accent hover:text-ct-accent active:scale-[.99] transition-all"
            >
              <Camera className="w-4 h-4" />
              Take / attach photo
            </button>
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
                <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs font-mono-ibm">
                  <div><span className="text-ct-text3">Pen </span><span className="text-ct-accent">{e.house} {e.line}{e.slot}</span></div>
                  <div><span className="text-ct-text3">Tag </span><span className="text-ct-text">{e.tag}</span></div>
                  <div><span className="text-ct-text3">Size </span><span className="text-ct-text">{e.size || '—'} cm</span></div>
                  <div><span className="text-ct-text3">Gr </span><span className="text-ct-text">{e.grade || '—'}</span></div>
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
          disabled={!pending.length || committing}
          className="mt-5 w-full flex items-center justify-center gap-2 bg-ct-good text-background font-mono-ibm text-sm font-semibold tracking-[1.5px] uppercase py-4 rounded-sm hover:opacity-90 active:scale-[.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <CloudUpload className="w-4 h-4" />
          {committing ? 'Committing…' : `Commit ${pending.length} to Dataset`}
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
