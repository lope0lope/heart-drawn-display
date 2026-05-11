import { useState, useCallback } from 'react';
import { Menu, Search, Upload, X } from 'lucide-react';
import { type ScreenName } from '@/data/mockData';

interface TopbarProps {
  title: string;
  onNavigate: (screen: ScreenName) => void;
  onSearch?: (query: string) => void;
  onMenuClick?: () => void;
}

export default function Topbar({ title, onNavigate, onSearch, onMenuClick }: TopbarProps) {
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  const submit = useCallback(() => {
    if (query.trim()) {
      onSearch?.(query.trim());
      setSearchOpen(false);
    }
  }, [query, onSearch]);

  return (
    <div className="bg-surface border-b border-border px-3 sm:px-5 md:px-7 py-3 sm:py-3.5 flex items-center gap-2 sm:gap-3.5 flex-shrink-0">
      {/* Mobile menu */}
      <button
        className="md:hidden p-2 -ml-2 text-ct-text2 hover:text-ct-accent rounded-sm active:scale-95 transition-all"
        onClick={onMenuClick}
        aria-label="Menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      <div className="font-display text-base sm:text-[20px] md:text-[22px] font-semibold text-ct-text tracking-[1px] sm:tracking-[2px] uppercase truncate flex-1 md:flex-none">
        {title}
      </div>

      <div className="flex items-center gap-2 sm:gap-3.5 ml-auto">
        {/* Desktop search */}
        <input
          className="hidden md:block bg-surface-2 border border-border text-ct-text px-3.5 py-2 font-mono-ibm text-xs rounded-sm w-48 lg:w-60 outline-none focus:border-ct-accent"
          placeholder="Search tag # or pen slot…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
        />

        {/* Mobile search trigger */}
        <button
          className="md:hidden p-2 text-ct-text2 hover:text-ct-accent active:scale-95 transition-all"
          onClick={() => setSearchOpen(true)}
          aria-label="Search"
        >
          <Search className="w-4 h-4" />
        </button>

        <div className="hidden lg:block font-mono-ibm text-[11px] bg-ct-tag text-ct-accent px-3 py-1 rounded-sm border border-border whitespace-nowrap">
          Q2 2026 · CYCLE 2
        </div>

        {/* Upload — icon-only on mobile */}
        <button
          className="bg-ct-accent text-background border-none px-3 sm:px-[18px] py-2 font-mono-ibm text-[11px] font-medium tracking-[1px] uppercase cursor-pointer rounded-sm transition-all hover:bg-ct-accent2 active:scale-95 whitespace-nowrap flex items-center gap-1.5"
          onClick={() => onNavigate('upload')}
        >
          <Upload className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Upload CSV</span>
        </button>
      </div>

      {/* Mobile search overlay */}
      {searchOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col p-4">
          <div className="flex items-center gap-2 bg-surface border border-border rounded-sm px-3 py-2.5">
            <Search className="w-4 h-4 text-ct-text3" />
            <input
              autoFocus
              className="flex-1 bg-transparent text-ct-text font-mono-ibm text-sm outline-none"
              placeholder="Tag # or pen slot…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submit()}
            />
            <button onClick={() => setSearchOpen(false)} aria-label="Close">
              <X className="w-4 h-4 text-ct-text3" />
            </button>
          </div>
          <div className="font-mono-ibm text-[10px] text-ct-text3 mt-3 px-1">
            Press Enter to open profile
          </div>
        </div>
      )}
    </div>
  );
}
