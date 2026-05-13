import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SIZE_BANDS, sizeBandColor, countSizeBands } from '@/lib/crocUtils';
import type { CrocRecord } from '@/hooks/useCrocs';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  crocs: CrocRecord[];
}

export default function CullHorizonDialog({ open, onOpenChange, title, crocs }: Props) {
  const bc = countSizeBands(crocs);
  const max = Math.max(...bc, 1);
  const total = crocs.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl text-ct-accent">{title}</DialogTitle>
        </DialogHeader>
        <div>
          <div className="font-mono-ibm text-[10px] text-ct-text3 tracking-[2px] uppercase mb-3">
            Size Category Snapshot · {total} croc{total === 1 ? '' : 's'}
          </div>
          {total === 0 ? (
            <div className="text-xs text-ct-text3 text-center py-6">No crocodiles in this group.</div>
          ) : (
            SIZE_BANDS.map((b, i) => (
              <div key={i} className="flex items-center gap-2.5 mb-2">
                <span className="font-mono-ibm text-[10px] text-ct-text3 w-[58px]">{b.range}</span>
                <div className="flex-1 h-[9px] bg-surface-3 rounded-sm overflow-hidden">
                  <div className="h-full rounded-sm" style={{ width: `${(bc[i] / max) * 100}%`, background: sizeBandColor(i) }} />
                </div>
                <span className="font-mono-ibm text-[11px] w-[34px] text-right" style={{ color: sizeBandColor(i) }}>{bc[i]}</span>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
