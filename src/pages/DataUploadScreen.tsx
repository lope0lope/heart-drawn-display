import { useState } from 'react';
import { exportLiveCrocs, exportInspectionHistory } from '@/lib/exportData';
import { toast } from 'sonner';

export default function DataUploadScreen() {
  const [status, setStatus] = useState<'awaiting' | 'processing' | 'done'>('awaiting');
  const [fileName, setFileName] = useState('');
  const [penFilter, setPenFilter] = useState<string>('');
  const [exporting, setExporting] = useState<string | null>(null);

  const uploadHistory = [
    { name: 'inspection_GH1_Q2-2026-C2.csv', records: 910, date: '18 Apr 2026', ok: true },
    { name: 'inspection_GH2_Q2-2026-C2.csv', records: 884, date: '18 Apr 2026', ok: true },
    { name: 'inspection_GH1_Q2-2026-C1.csv', records: 902, date: '12 Feb 2026', ok: false },
    { name: 'inspection_GH2_Q1-2026-C3.csv', records: 876, date: '10 Dec 2025', ok: true },
  ];

  const handleFile = (file: File | null) => {
    if (!file) return;
    setFileName(file.name);
    setStatus('processing');
    setTimeout(() => setStatus('done'), 700);
  };

  const handleExport = async (type: 'live' | 'history') => {
    const key = type;
    setExporting(key);
    try {
      const filter = penFilter || undefined;
      const count = type === 'live'
        ? await exportLiveCrocs(filter)
        : await exportInspectionHistory(filter);
      toast.success(`Exported ${count} records`);
    } catch (err: any) {
      toast.error(err.message || 'Export failed');
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="flex flex-col gap-3.5">
        {/* Data Export */}
        <div className="bg-surface border border-border rounded overflow-hidden">
          <div className="px-[18px] py-3 border-b border-border">
            <span className="font-mono-ibm text-[10px] text-ct-text3 tracking-[2px] uppercase">Data Export</span>
          </div>
          <div className="px-[18px] py-4 flex flex-col gap-3">
            <div className="text-xs text-ct-text2 mb-1">Download live or historical data as CSV for auditing or re-upload.</div>
            <div>
              <div className="font-mono-ibm text-[9px] text-ct-text3 tracking-[2px] uppercase mb-1.5">Filter by pen</div>
              <div className="flex gap-2">
                {['', 'GH1', 'GH2'].map(p => (
                  <button
                    key={p}
                    onClick={() => setPenFilter(p)}
                    className={`px-3 py-1.5 font-mono-ibm text-[11px] rounded-sm border cursor-pointer transition-all ${
                      penFilter === p
                        ? 'bg-ct-accent text-background border-ct-accent'
                        : 'bg-surface-2 text-ct-text2 border-border hover:border-ct-accent'
                    }`}
                  >
                    {p || 'All'}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 mt-1">
              <button
                onClick={() => handleExport('live')}
                disabled={exporting !== null}
                className="flex-1 bg-ct-accent text-background px-[18px] py-2.5 font-mono-ibm text-[11px] font-medium tracking-[1px] uppercase rounded-sm cursor-pointer disabled:opacity-50 transition-all hover:bg-ct-accent2"
              >
                {exporting === 'live' ? 'Exporting…' : '↓ Live Croc Data'}
              </button>
              <button
                onClick={() => handleExport('history')}
                disabled={exporting !== null}
                className="flex-1 bg-transparent text-ct-accent border border-border px-[18px] py-2.5 font-mono-ibm text-[11px] font-medium tracking-[1px] uppercase rounded-sm cursor-pointer disabled:opacity-50 transition-all hover:border-ct-accent"
              >
                {exporting === 'history' ? 'Exporting…' : '↓ Inspection History'}
              </button>
            </div>
            <div className="font-mono-ibm text-[10px] text-ct-text3 bg-surface-2 p-2.5 rounded-sm border border-border leading-[1.8]">
              <strong className="text-ct-text2">Live data</strong> — current croc records (tag, pen, size, grade, conditions)<br />
              <strong className="text-ct-text2">History</strong> — all inspection measurements over time for growth auditing<br />
              <span className="text-ct-accent">CSV format matches the upload template</span> — edit &amp; re-import
            </div>
          </div>
        </div>

        {/* Upload Zone */}
        <div className="bg-surface border border-border rounded overflow-hidden">
          <div className="px-[18px] py-3 border-b border-border">
            <span className="font-mono-ibm text-[10px] text-ct-text3 tracking-[2px] uppercase">Upload Inspection CSV</span>
          </div>
          <div className="px-[18px] py-4">
            <div
              className="border-2 border-dashed border-border rounded-md p-9 text-center cursor-pointer transition-all hover:border-ct-accent hover:bg-[rgba(201,168,76,.04)]"
              onClick={() => document.getElementById('file-input')?.click()}
              onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-ct-accent', 'bg-[rgba(201,168,76,.04)]'); }}
              onDragLeave={e => { e.currentTarget.classList.remove('border-ct-accent', 'bg-[rgba(201,168,76,.04)]'); }}
              onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
            >
              <div className="text-[32px] mb-2.5 opacity-30">↑</div>
              <div className="font-display text-xl text-ct-text2 mb-1.5">Drop CSV file here</div>
              <div className="text-[11px] text-ct-text3 font-mono-ibm">or click to browse · .csv files only</div>
              <input type="file" id="file-input" accept=".csv" className="hidden" onChange={e => handleFile(e.target.files?.[0] || null)} />
            </div>
            <div className="mt-4">
              <div className="font-mono-ibm text-[9px] text-ct-text3 tracking-[2px] uppercase mb-2">Required columns</div>
              <div className="font-mono-ibm text-[11px] text-ct-text2 leading-[2.1] bg-surface-2 p-3 rounded-sm border border-border">
                tag_id &nbsp;·&nbsp; pen &nbsp;·&nbsp; row<br />
                size_cm &nbsp;·&nbsp; grade &nbsp;·&nbsp; batch<br />
                condition_codes &nbsp;·&nbsp; inspection_date<br />
                readiness &nbsp;·&nbsp; green_tag &nbsp;·&nbsp; feed_g
              </div>
            </div>
          </div>
        </div>

        {/* Upload History */}
        <div className="bg-surface border border-border rounded overflow-hidden">
          <div className="px-[18px] py-3 border-b border-border">
            <span className="font-mono-ibm text-[10px] text-ct-text3 tracking-[2px] uppercase">Upload History</span>
          </div>
          <div className="px-[14px] py-2">
            {uploadHistory.map((u, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5 bg-surface-2 rounded-sm border border-border mb-1.5">
                <span className={`text-[13px] ${u.ok ? 'text-ct-good' : 'text-ct-warn'}`}>{u.ok ? '✓' : '⚠'}</span>
                <span className="font-mono-ibm text-[11px] text-ct-text flex-1">{u.name}</span>
                <span className="font-mono-ibm text-[10px] text-ct-text3">{u.records} records · {u.date}</span>
                <span className={`inline-block px-2.5 py-0.5 rounded-[10px] text-[10px] font-mono-ibm ${u.ok ? 'bg-[rgba(76,175,80,.15)] text-ct-good' : 'bg-[rgba(212,137,42,.15)] text-ct-warn'}`}>
                  {u.ok ? 'Clean' : '1 warning'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3.5">
        {/* Data Preview */}
        <div className="bg-surface border border-border rounded overflow-hidden">
          <div className="px-[18px] py-3 border-b border-border flex items-center justify-between">
            <span className="font-mono-ibm text-[10px] text-ct-text3 tracking-[2px] uppercase">Data Preview</span>
            <span className={`inline-block px-2.5 py-0.5 rounded-[10px] text-[10px] font-mono-ibm ${status === 'done' ? 'bg-[rgba(76,175,80,.15)] text-ct-good' : 'bg-[rgba(201,168,76,.15)] text-ct-accent'}`}>
              {status === 'awaiting' ? 'Awaiting file' : status === 'processing' ? 'Processing…' : '✓ 910 records loaded'}
            </span>
          </div>
          <div className="px-[18px] py-4">
            {status !== 'done' ? (
              <div className="text-center py-10 text-ct-text3 font-mono-ibm text-[11px]">No file loaded.</div>
            ) : (
              <>
                <div className="text-[11px] text-ct-text2 mb-2.5 font-mono-ibm">Preview — <strong className="text-ct-accent">{fileName}</strong></div>
                <div className="overflow-x-auto">
                  <table className="border-collapse text-[11px] w-full">
                    <thead>
                      <tr className="bg-surface-3">
                        {['tag_id', 'pen', 'row', 'size_cm', 'condition_codes', 'readiness', 'feed_g'].map(h => (
                          <th key={h} className="p-[5px_8px] border border-border text-ct-text3 font-mono-ibm text-[9px]">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[[5001, 'GH1', 'A', 29, '', '', 1], [5002, 'GH1', 'A', 31, 'DS02B', 'next', 1], [5003, 'GH1', 'A', 34, '', '', 1], [5004, 'GH1', 'A', 27, 'FW06R', '2', 1], [5005, 'GH1', 'A', 38, '', '', 1]].map((r, i) => (
                        <tr key={i}>
                          {r.map((v, j) => <td key={j} className="p-[5px_8px] border border-border text-ct-text2">{v}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Validation Report */}
        <div className="bg-surface border border-border rounded overflow-hidden">
          <div className="px-[18px] py-3 border-b border-border">
            <span className="font-mono-ibm text-[10px] text-ct-text3 tracking-[2px] uppercase">Validation Report</span>
          </div>
          <div className="px-[18px] py-4">
            {status !== 'done' ? (
              <div className="text-center py-5 text-ct-text3 font-mono-ibm text-[11px]">Validation runs automatically on upload.</div>
            ) : (
              <div className="flex flex-col gap-2">
                {[
                  { ok: true, text: '910 records parsed successfully' },
                  { ok: true, text: 'All required columns present' },
                  { ok: true, text: '0 duplicate tag IDs' },
                  { ok: false, text: '3 records with unrecognised condition codes — flagged for review' },
                  { ok: true, text: 'All tag IDs within known batch ranges' },
                ].map((v, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <span className={v.ok ? 'text-ct-good' : 'text-ct-warn'}>{v.ok ? '✓' : '⚠'}</span>
                    <span className="text-xs text-ct-text2">{v.text}</span>
                  </div>
                ))}
                <div className="mt-2 flex gap-2">
                  <button className="bg-ct-accent text-background px-[18px] py-2 font-mono-ibm text-[11px] font-medium tracking-[1px] uppercase rounded-sm cursor-pointer">Confirm Import</button>
                  <button className="bg-transparent text-ct-accent border border-border px-3.5 py-[7px] font-mono-ibm text-[11px] tracking-[1px] rounded-sm cursor-pointer hover:border-ct-accent">Review Flags</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
