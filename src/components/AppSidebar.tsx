import { type ScreenName } from '@/data/mockData';
import { Sheet, SheetContent } from '@/components/ui/sheet';

interface SidebarProps {
  activeScreen: ScreenName;
  onNavigate: (screen: ScreenName) => void;
  /** Mobile drawer state */
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
}

const navItems: Array<{ section?: string; id: ScreenName; icon: string; label: string; badge?: string }> = [
  { section: 'Operations', id: 'dashboard', icon: '◻', label: 'Dashboard' },
  { id: 'penmap', icon: '⊞', label: 'Pen Map' },
  { section: 'Data Entry', id: 'sheet', icon: '▦', label: 'Data Entry Sheet' },
  { section: 'Records', id: 'upload', icon: '↑', label: 'Data Upload' },
  { id: 'croc', icon: '◇', label: 'Croc Profiles' },
];

function NavBody({ activeScreen, onNavigate }: { activeScreen: ScreenName; onNavigate: (s: ScreenName) => void }) {
  let currentSection = '';
  return (
    <>
      <div className="px-5 pt-[22px] pb-[18px] border-b border-border">
        <div className="font-display text-[22px] font-bold text-ct-accent tracking-[2px]">◈ CROCTRACK</div>
        <div className="font-mono-ibm text-[9px] text-ct-text3 tracking-[3px] uppercase mt-0.5">Farm Intelligence System</div>
      </div>
      <div className="flex-1 py-3 overflow-y-auto">
        {navItems.map((item) => {
          const showSection = item.section && item.section !== currentSection;
          if (item.section) currentSection = item.section;
          return (
            <div key={item.id}>
              {showSection && (
                <div className="font-mono-ibm text-[9px] text-ct-text3 tracking-[3px] uppercase px-5 pt-3.5 pb-1.5">
                  {item.section}
                </div>
              )}
              <button
                className={`w-full flex items-center gap-2.5 px-5 py-3 cursor-pointer text-[13px] font-medium transition-all border-l-[3px] active:scale-[.98] ${
                  activeScreen === item.id
                    ? 'bg-surface-2 text-ct-accent border-l-ct-accent'
                    : 'text-ct-text2 border-l-transparent hover:bg-surface-2 hover:text-ct-text'
                }`}
                onClick={() => onNavigate(item.id)}
              >
                <span className="text-sm w-[18px] text-center">{item.icon}</span>
                {item.label}
                {item.badge && (
                  <span className="ml-auto bg-ct-warn text-foreground text-[9px] font-mono-ibm px-1.5 py-0.5 rounded-[10px]">
                    {item.badge}
                  </span>
                )}
              </button>
            </div>
          );
        })}
      </div>
      <div className="px-5 py-4 border-t border-border font-mono-ibm text-[10px] text-ct-text3 leading-[1.9]">
        <span className="text-ct-accent">GH1</span> &amp; <span className="text-ct-accent">GH2</span> · Rows A–M · 70 cols<br />
        Cycle <span className="text-ct-accent">Q2-2026</span><br />
        Next inspection: <span className="text-ct-accent">14 Apr 2026</span>
      </div>
    </>
  );
}

export default function AppSidebar({ activeScreen, onNavigate, mobileOpen, onMobileOpenChange }: SidebarProps) {
  const handleNav = (s: ScreenName) => {
    onNavigate(s);
    onMobileOpenChange?.(false);
  };

  return (
    <>
      {/* Desktop / tablet sidebar */}
      <nav className="hidden md:flex w-[220px] min-w-[220px] bg-surface border-r border-border flex-col z-10">
        <NavBody activeScreen={activeScreen} onNavigate={onNavigate} />
      </nav>

      {/* Mobile off-canvas drawer */}
      <Sheet open={!!mobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetContent side="left" className="p-0 w-[260px] bg-surface border-border flex flex-col">
          <NavBody activeScreen={activeScreen} onNavigate={handleNav} />
        </SheetContent>
      </Sheet>
    </>
  );
}
