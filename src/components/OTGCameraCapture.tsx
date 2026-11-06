import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Camera, ImagePlus, RefreshCw } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Props {
  onCapture: (result: { full: string; preview: string; width: number; height: number }) => void;
  onFallbackFile: (file: File) => void;
  onClose: () => void;
}

function friendlyError(err: unknown): string {
  const name = (err as { name?: string } | null)?.name ?? '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Camera permission was denied. Allow camera access, then try again — or attach a photo file instead.';
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'DevicesNotFoundError') {
    return 'That camera is unavailable. Check the USB connection, refresh the camera list, and select it again.';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'This camera is already in use by another app. Close it and try again.';
  }
  const message = (err as { message?: string } | null)?.message;
  return message || 'The camera could not be started — attach a photo file instead.';
}

function preferredExternalCamera(devices: MediaDeviceInfo[]): string {
  return devices.find(device => /usb|arducam|uvc|external/i.test(device.label))?.deviceId ?? '';
}

export default function OTGCameraCapture({ onCapture, onFallbackFile, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [error, setError] = useState('');
  const [res, setRes] = useState('');
  const [frameRate, setFrameRate] = useState('');
  const [started, setStarted] = useState(false);
  const [loadingDevices, setLoadingDevices] = useState(true);

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || !navigator.mediaDevices.enumerateDevices) {
      setError('Live camera selection is not supported on this device. Attach a photo file instead.');
      setLoadingDevices(false);
      return;
    }

    setLoadingDevices(true);
    setError('');
    try {
      // Camera labels are hidden until permission is granted. This temporary
      // stream is only used to unlock device names; it is never shown or captured.
      const permissionStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      permissionStream.getTracks().forEach(track => track.stop());
      const cameras = (await navigator.mediaDevices.enumerateDevices())
        .filter(device => device.kind === 'videoinput');
      setDevices(cameras);
      setSelectedDeviceId(current => {
        if (current && cameras.some(device => device.deviceId === current)) return current;
        return preferredExternalCamera(cameras);
      });
      if (cameras.length === 0) setError('No cameras found. Check the USB camera connection and refresh the list.');
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoadingDevices(false);
    }
  }, []);

  useEffect(() => {
    void refreshDevices();
    return () => streamRef.current?.getTracks().forEach(track => track.stop());
  }, [refreshDevices]);

  useEffect(() => {
    let alive = true;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    setStarted(false);
    setRes('');
    setFrameRate('');

    if (!selectedDeviceId) return () => { alive = false; };

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: { exact: selectedDeviceId },
            width: { ideal: 4608 },
            height: { ideal: 2592 },
            aspectRatio: { ideal: 16 / 9 },
            frameRate: { ideal: 15 },
          },
          audio: false,
        });
        if (!alive) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play().catch(() => {});
        const track = stream.getVideoTracks()[0];
        const settings = track?.getSettings();
        const width = settings?.width ?? video.videoWidth;
        const height = settings?.height ?? video.videoHeight;
        if (width && height) setRes(`${width} × ${height}`);
        if (settings?.frameRate) setFrameRate(`${Math.round(settings.frameRate)} fps`);
        setStarted(true);
        setError('');
      } catch (err) {
        if (alive) setError(friendlyError(err));
      }
    })();

    return () => {
      alive = false;
      streamRef.current?.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    };
  }, [selectedDeviceId]);

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const width = video.videoWidth;
    const height = video.videoHeight;
    const fullCanvas = document.createElement('canvas');
    fullCanvas.width = width;
    fullCanvas.height = height;
    const context = fullCanvas.getContext('2d');
    if (!context) return;
    context.drawImage(video, 0, 0, width, height);
    const full = fullCanvas.toDataURL('image/jpeg', 0.92);

    const scale = Math.min(1, 1000 / Math.max(width, height));
    const previewCanvas = document.createElement('canvas');
    previewCanvas.width = Math.round(width * scale);
    previewCanvas.height = Math.round(height * scale);
    const previewContext = previewCanvas.getContext('2d');
    if (!previewContext) return;
    previewContext.drawImage(video, 0, 0, previewCanvas.width, previewCanvas.height);
    const preview = previewCanvas.toDataURL('image/jpeg', 0.62);
    onCapture({ full, preview, width, height });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/95 flex flex-col" role="dialog" aria-label="Camera capture">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface flex-shrink-0">
        <div>
          <div className="font-display text-lg text-ct-accent">Select camera</div>
          <div className="font-mono-ibm text-[10px] text-ct-text3 uppercase mt-0.5">
            Requested mode: 4608 × 2592 at 15 fps
          </div>
        </div>
        <button onClick={onClose} className="p-2 text-ct-text2 hover:text-ct-text active:scale-95" aria-label="Close camera">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex items-center gap-2 border-b border-border bg-surface px-4 py-3">
        <Select value={selectedDeviceId} onValueChange={setSelectedDeviceId}>
          <SelectTrigger className="h-12 min-w-0 flex-1 rounded-sm border-border font-mono-ibm text-xs">
            <SelectValue placeholder={loadingDevices ? 'Finding cameras…' : 'Choose a camera'} />
          </SelectTrigger>
          <SelectContent>
            {devices.map((device, index) => (
              <SelectItem key={device.deviceId} value={device.deviceId}>
                {device.label || `Camera ${index + 1}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button
          onClick={() => void refreshDevices()}
          disabled={loadingDevices}
          className="flex h-12 w-12 flex-shrink-0 items-center justify-center border border-border text-ct-text2 disabled:opacity-50"
          aria-label="Refresh camera list"
          title="Refresh camera list"
        >
          <RefreshCw className={`h-4 w-4 ${loadingDevices ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex-1 relative min-h-0 overflow-hidden bg-muted flex items-center justify-center">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className={`h-full w-full object-contain ${started ? '' : 'hidden'}`}
        />
        {!started && !error && (
          <div className="px-6 text-center font-mono-ibm text-xs uppercase text-ct-text3">
            {selectedDeviceId ? 'Connecting to selected camera…' : 'Choose the USB camera above'}
          </div>
        )}
        {error && (
          <div className="mx-4 max-w-md text-center">
            <div className="font-mono-ibm text-xs leading-relaxed text-ct-warn">{error}</div>
            <button
              onClick={() => fileRef.current?.click()}
              className="mt-4 inline-flex items-center gap-2 border border-border px-4 py-3 font-mono-ibm text-[11px] uppercase text-ct-accent"
            >
              <ImagePlus className="h-4 w-4" /> Attach photo file
            </button>
          </div>
        )}
      </div>

      {started && (
        <div className="border-t border-border bg-surface px-4 py-3 flex-shrink-0">
          <div className="mb-3 flex flex-wrap items-center justify-center gap-2 font-mono-ibm text-[10px] uppercase text-ct-text3">
            <span className="text-ct-accent">Active stream: {res || 'resolution unknown'}</span>
            {frameRate && <span>· {frameRate}</span>}
          </div>
          <p className="mb-3 text-center font-mono-ibm text-[10px] leading-relaxed text-ct-text3">
            If the preview is green, this browser may not decode the camera’s MJPEG stream. The browser does not expose a control to select MJPEG encoding.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center justify-center gap-2 border border-border px-4 py-4 font-mono-ibm text-[11px] uppercase text-ct-text2"
            >
              <ImagePlus className="h-4 w-4" />
              <span className="hidden sm:inline">Attach file</span>
            </button>
            <button
              onClick={capture}
              className="flex flex-1 items-center justify-center gap-2 rounded-sm bg-ct-accent py-4 font-mono-ibm text-sm font-semibold uppercase text-background transition-all hover:bg-ct-accent2 active:scale-[.98]"
            >
              <Camera className="h-4 w-4" /> Capture photo
            </button>
          </div>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={event => {
          const file = event.target.files?.[0];
          if (file) onFallbackFile(file);
          onClose();
        }}
      />
    </div>
  );
}