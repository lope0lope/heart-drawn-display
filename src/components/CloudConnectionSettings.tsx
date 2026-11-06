import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { captureRequest, getUploadKey, saveUploadKey } from '@/lib/cloudConnection';

export default function CloudConnectionSettings() {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState('');
  const [status, setStatus] = useState('');
  return <>
    <Button variant="outline" size="icon" className="fixed bottom-3 right-3 z-50 bg-background" aria-label="Connection settings" title="Connection settings" onClick={() => { setKey(getUploadKey()); setStatus(''); setOpen(true); }}><KeyRound /></Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>Upload connection</DialogTitle></DialogHeader>
      <label className="space-y-2 text-sm">Private upload key<input type="password" autoComplete="off" aria-label="Private upload key" value={key} onChange={e => setKey(e.target.value)} className="w-full border border-input bg-background p-3 rounded-md" /></label>
      <Button onClick={async () => { saveUploadKey(key); try { await captureRequest('/health'); setStatus('Connected to Lovable Cloud'); } catch (e) { setStatus(e instanceof Error ? e.message : 'Connection failed'); } }}>Save and test</Button>
      <p role="status" className="text-sm text-muted-foreground">{status}</p>
    </DialogContent></Dialog>
  </>;
}