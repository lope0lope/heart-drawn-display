import { useEffect, useRef, useState } from 'react';
import { X, Camera, ImagePlus } from 'lucide-react';

/**
 * Live OTG / USB camera capture modal.
 *
 * Requests the highest resolution the camera exposes (Arducam 12MP UVC
 * modules expose up to 4096×3072; typical phones/tablets give up to 4K) and
 * grabs full frames at the sensor's native output, so stored photos keep
 * their full resolution for later inspection.
 */

interface Props {
  onCapture: (result: { full: string; preview: string; width: number; height: number }) => void;
  onFallbackFile: (file: File) => void;
  onClose: () => void;
}

function friendlyError(err: unknown): string {
  const name = (err as any)?.name ?? '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Camera permission was denied. Allow camera access for this app, then try again — or attach a photo file instead.';
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'DevicesNotFoundError') {
    return 'No camera was found. Check the OTG/USB camera is connected, then try again — or attach a photo file instead.';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'The camera is already in use by another app. Close it and try again.';
  }
  const msg = (err as any)?.message ?? '';
  return msg || 'The camera could not be started — attach a photo file instead.';
}

export default function OTGCameraCapture({ onCapture, onFallbackFile, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState('');
  const [res, setRes] = useState<string>('');
  const [maxRes, setMaxRes] = useState<string>('');
  const [started, setStarted] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw Object.assign(new Error('Live camera is not supported on this device.'), { name: 'Unsupported' });
        }
        // Ask for the largest frame the sensor offers; the browser picks the
        // closest available mode (4096×3072 for 12MP UVC, 4K on most tablets).
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 4096 },
            height: { ideal: 3072 },
            frameRate: { ideal: 15 },
          },
          audio: false,
        });
        if (!alive) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = stream;
        const v = videoRef.current;
        if (!v) return;
        v.srcObject = stream;
        await v.play().catch(() => {});
        const track = stream.getVideoTracks()[0];
        const s: any = track?.getSettings?.() ?? {};
        const w = s.width ?? v.videoWidth;
        const h = s.height ?? v.videoHeight;
        setRes(w && h ? `${w} × ${h}` : '');
        const caps: any = track?.getCapabilities?.() ?? {};
        if (caps.width?.max && caps.height?.max) {
          setMaxRes(`up to ${caps.width.max} × ${caps.height.max}`);
        }
        setStarted(true);
      } catch (err) {
        if (alive) setError(friendlyError(err));
      }
    })();
    return () => {
      alive = false;
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    };
  }, []);

  const capture = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const w = v.videoWidth;
    const h = v.videoHeight;

    // Full-resolution frame: native sensor output, high-quality JPEG.
    const fullCanvas = document.createElement('canvas');
    fullCanvas.width = w;
    fullCanvas.height = h;
    const ctx = fullCanvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, w, h);
    const full = fullCanvas.toDataURL('image/jpeg', 0.92);

    // Small preview for the entry form / queue thumbnails.
    const scale = Math.min(1, 1000 / Math.max(w, h));
    const pw = Math.round(w * scale);
    const ph = Math.round(h * scale);
    const prevCanvas = document.createElement('canvas');
    prevCanvas.width = pw;
    prevCanvas.height = ph;
    const pctx = prevCanvas.getContext('2d');
    if (!pctx) return;
    pctx.drawImage(v, 0, 0, pw, ph);
    const preview = prevCanvas.toDataURL('image/jpeg', 0.62);

    onCapture({ full, preview, width: w, height: h });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/95 flex flex-col" role="dialog" aria-label="Camera capture">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface flex-shrink-0">
        <div>
          <div className="font-display text-lg text-ct-accent tracking-wider">Live Camera</div>
          <div className="font-mono-ibm text-[9px] text-ct-text3 uppercase tracking-[2px] mt-0.5">
            OTG / USB camera · full resolution
          </div>
        </div>
        <button onClick={onClose} className="p-2 text-ct-text2 hover:text-ct-text active:scale-95" aria-label="Close camera">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 relative overflow-hidden bg-black flex items-center justify-center">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className={`w-full h-full object-contain ${started ? '' : 'hidden'}`}
        />
        {!started && !error && (
          <div className="text-ct-text3 font-mono-ibm text-xs uppercase tracking-[2px] animate-pulse">
            Starting camera…
          </div>
        )}
        {error && (
          <div className="max-w-md mx-4 text-center">
            <div className="text-ct-warn font-mono-ibm text-xs leading-relaxed">{error}</div>
            <button
              onClick={() => fileRef.current?.click()}
              className="mt-4 inline-flex items-center gap-2 border border-border rounded-sm px-4 py-2.5 font-mono-ibm text-[11px] uppercase tracking-[1.5px] text-ct-accent hover:border-ct-accent active:scale-95"
            >
              <ImagePlus className="w-4 h-4" />
              Attach photo file
            </button>
          </div>
        )}
      </div>

      {started && (
        <div className="border-t border-border bg-surface px-4 py-3 flex-shrink-0">
          <div className="flex items-center justify-center gap-2 font-mono-ibm text-[10px] text-ct-text3 uppercase tracking-[2px] mb-3">
            <span className="text-ct-accent">{res || 'Resolution unknown'}</span>
            {maxRes && <span>· sensor {maxRes}</span>}
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center justify-center gap-2 border border-border rounded-sm px-4 py-4 font-mono-ibm text-[11px] uppercase tracking-[1.5px] text-ct-text2 hover:border-ct-accent active:scale-95"
            >
              <ImagePlus className="w-4 h-4" />
              <span className="hidden sm:inline">Attach file</span>
            </button>
            <button
              onClick={capture}
              className="flex-1 flex items-center justify-center gap-2 bg-ct-accent text-background font-mono-ibm text-sm font-semibold tracking-[1.5px] uppercase py-4 rounded-sm hover:bg-ct-accent2 active:scale-[.98] transition-all"
            >
              <Camera className="w-4 h-4" />
              Capture photo
            </button>
          </div>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) onFallbackFile(f);
          onClose();
        }}
      />
    </div>
  );
}
