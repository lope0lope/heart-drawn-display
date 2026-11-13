import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { CrocRecord } from '@/hooks/useCrocs';

const penNum = (c: CrocRecord) => `${c.line}${c.pen_slot}`;

/** Printable croc list sorted by house, line, pen so staff can walk the farm in order. */
export function downloadCrocListPdf(title: string, crocs: CrocRecord[]) {
  const sorted = [...crocs].sort((a, b) =>
    a.pen_id.localeCompare(b.pen_id) || a.line.localeCompare(b.line) || a.pen_slot - b.pen_slot);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const date = new Date().toISOString().slice(0, 10);
  doc.setFontSize(16);
  doc.text(`CrocTrack: ${title}`, 14, 15);
  doc.setFontSize(10);
  doc.text(`${sorted.length} croc${sorted.length === 1 ? '' : 's'} · printed ${date}`, 14, 21);
  autoTable(doc, {
    startY: 26,
    head: [['#', 'House', 'Pen', 'Tag', 'Belly (cm)', 'Cull', 'Conditions', 'Last inspected', 'Found']],
    body: sorted.map((c, i) => [
      i + 1, c.pen_id, penNum(c), c.tag ?? 'NT', c.belly_cm ?? '', c.cull_schedule ?? '',
      (c.condition_codes ?? []).join(', '), c.inspection_date ?? '', '',
    ]),
    styles: { fontSize: 9, cellPadding: 1.8 },
    headStyles: { fillColor: [122, 94, 24], textColor: 255 },
    columnStyles: { 1: { fontStyle: 'bold' }, 2: { fontStyle: 'bold' }, 3: { fontStyle: 'bold' }, 8: { cellWidth: 16 } },
    didDrawCell: (d) => {
      if (d.section === 'body' && d.column.index === 8) {
        doc.rect(d.cell.x + 5, d.cell.y + 1, 4, 4);
      }
    },
  });
  doc.save(`croctrack_${title.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}_${date}.pdf`);
}
