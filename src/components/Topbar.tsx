import { type ScreenName } from '@/data/mockData';

interface TopbarProps {
  title: string;
  onNavigate: (screen: ScreenName) => void;
}

export default function Topbar({ title, onNavigate }: TopbarProps) {
  return (
    <div className="bg-surface border-b border-border px-7 py-3.5 flex items-center justify-between flex-shrink-0">
      <div className="font-display text-[22px] font-semibold text-ct-text tracking-[2px] uppercase">{title}</div>
      <div className="flex items-center gap-3.5">
        <input
          className="bg-surface-2 border border-border text-ct-text px-3.5 py-2 font-mono-ibm text-xs rounded-sm w-60 outline-none focus:border-ct-accent"
          placeholder="Search tag # or pen slot…"
        />
        <div className="font-mono-ibm text-[11px] bg-ct-tag text-ct-accent px-3 py-1 rounded-sm border border-border">
          Q2 2026 · CYCLE 2
        </div>
        <button
          className="bg-ct-accent text-background border-none px-[18px] py-2 font-mono-ibm text-[11px] font-medium tracking-[1px] uppercase cursor-pointer rounded-sm transition-all hover:bg-ct-accent2 whitespace-nowrap"
          onClick={() => onNavigate('upload')}
        >
          ↑ Upload CSV
        </button>
      </div>
    </div>
  );
}
