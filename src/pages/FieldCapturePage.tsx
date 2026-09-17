import FieldCaptureScreen from './FieldCaptureScreen';

export default function FieldCapturePage() {
  return (
    <div className="capture-light min-h-[100dvh] bg-background text-foreground flex flex-col">
      <header className="bg-surface border-b border-border px-4 sm:px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div>
          <div className="font-display text-lg sm:text-xl font-bold text-ct-accent tracking-[2px]">◈ CROCTRACK</div>
          <div className="font-mono-ibm text-[9px] text-ct-text3 tracking-[3px] uppercase mt-0.5">
            Field Capture · Tablet Mode
          </div>
        </div>
        <div className="font-mono-ibm text-[10px] text-ct-text3 uppercase tracking-[2px] hidden sm:block">
          Standalone Capture
        </div>
      </header>
      <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
        <FieldCaptureScreen />
      </main>
    </div>
  );
}
