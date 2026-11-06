import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Camera, ImagePlus, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  onCapture: (result: { full: string; preview: string; width: number; height: number }) => void;
  onFallbackFile: (file: File) => void;
  onClose: () => void;
}

/**
 * Mode ladder. Each entry pins resolution AND frame rate exactly — USB
 * cameras like the Arducam only deliver 4608×2592 at ≤15 fps; letting the
 * browser pick 30 fps at that size produces a green, undecodable stream.
 */
type Mode = { label: string; w?: number; h?: number; fps?: number; fpsMax?: boolean };
const MODES: Mode[] = [
  { label: '4608 × 2592 @ 15fps', w: 4608, h: 2592, fps: 15 },
  { label: '4608 × 2592 @ ≤15fps', w: 4608, h: 2592, fps: 15, fpsMax: true },
  { label: '4608 × 2592 @ 10fps', w: 4608, h: 2592, fps: 10 },
  { label: '4608 × 2592 @ 5fps', w: 4608, h: 2592, fps: 5 },
  { label: '3840 × 2160 @ 15fps', w: 3840, h: 2160, fps: 15 },
  { label: '3840 × 2160 @ 30fps', w: 3840, h: 2160, fps: 30 },
  { label: '3840 × 2160 @ 10fps', w: 3840, h: 2160, fps: 10 },
  { label: '2560 × 1440 @ 15fps', w: 2560, h: 1440, fps: 15 },
  { label: '1920 × 1080 @ 30fps', w: 1920, h: 1080, fps: 30 },
  { label: '1280 × 720', w: 1280, h: 720 },
  { label: 'Camera default' },
];

function modeConstraints(m: Mode): MediaTrackConstraints {
  const c: MediaTrackConstraints = {};
  if (m.w && m.h) { c.width = { exact: m.w }; c.height = { exact: m.h }; }
  if (m.fps) c.frameRate = m.fpsMax ? { max: m.fps } : { exact: m.fps };
  return c;
}

/**
 * Sample a frame and report whether it looks broken: solid green
 * (failed MJPEG/YUV decode) or completely black/blank.
 */
function frameLooksBroken(video: HTMLVideoElement): 'green' | 'blank' | null {
  if (!video.videoWidth) return 'blank';
  const c = document.createElement('canvas');
  c.width = 64; c.height = 36;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, 64, 36);
  const d = ctx.getImageData(0, 0, 64, 36).data;
  let green = 0, dark = 0, min = 255, max = 0;
  const n = d.length / 4;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    if (g > 60 && g > r * 1.8 && g > b * 1.8) green++;
    if (r + g + b < 24) dark++;
    const l = r + g + b;
    if (l < min) min = l;
    if (l > max) max = l;
  }
  if (green / n > 0.85) return 'green';
  if (dark / n > 0.97 || max - min < 6) return 'blank';
  return null;
}

async function waitForFrames(video: HTMLVideoElement, ms: number) {
  await new Promise(r => setTimeout(r, ms));
}

function errName(err: unknown) {
  return (err as { name?: string } | null)?.name ?? 'Error';
}

function friendlyError(err: unknown): string {
  const name = errName(err);
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Camera permission was blocked. Tap the lock icon next to the web address, allow Camera, then tap refresh. If you opened this inside the Lovable editor, open the published app link directly instead.';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError') {
    return 'The camera is busy. Close any other camera app or browser tab (e.g. webcamtests.com), unplug and replug the USB camera, then tap refresh.';
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return 'The selected camera could not be opened. Unplug and replug the USB camera, then tap refresh.';
  }
  return (err as { message?: string } | null)?.message || 'The camera could not be started.';
}

function isExternal(label: string) {
  return /usb|arducam|uvc|external|webcam|hd camera|camera \d{2,}/i.test(label) &&
    !/front|back|rear|facing/i.test(label);
}

function stopStream(s: MediaStream | null) {
  s?.getTracks().forEach(t => t.stop());
}

export default function OTGCameraCapture({ onCapture, onFallbackFile, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const openSeq = useRef(0);

  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [error, setError] = useState('');
  const [res, setRes] = useState('');
  const [frameRate, setFrameRate] = useState('');
  const [started, setStarted] = useState(false);
  const [busy, setBusy] = useState(true);
  const [minMode, setMinMode] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const [showLog, setShowLog] = useState(false);

  const addLog = useCallback((line: string) => {
    setLog(prev => [...prev.slice(-40), `${new Date().toLocaleTimeString()}  ${line}`]);
  }, []);

  const attach = useCallback(async (stream: MediaStream) => {
    stopStream(streamRef.current);
    streamRef.current = stream;
    const video = videoRef.current;
    if (video) {
      video.srcObject = stream;
      await video.play().catch(() => {});
      // Wait for real frame dimensions.
      if (!video.videoWidth) {
        await new Promise<void>(r => {
          const done = () => r();
          video.addEventListener('loadedmetadata', done, { once: true });
          setTimeout(done, 2500);
        });
      }
    }
    const track = stream.getVideoTracks()[0];
    const s = track?.getSettings() ?? {};
    const w = videoRef.current?.videoWidth || s.width;
    const h = videoRef.current?.videoHeight || s.height;
    setRes(w && h ? `${w} × ${h}` : '');
    setFrameRate(s.frameRate ? `${Math.round(s.frameRate)} fps` : '');
    setStarted(true);
    setError('');
    addLog(`Streaming "${track?.label || 'camera'}" at ${w}×${h}`);
    track?.addEventListener('ended', () => {
      addLog('Camera disconnected');
      setStarted(false);
      setError('The camera stopped. Check the USB cable and tap refresh.');
    });
  }, [addLog]);

  const [photoMax, setPhotoMax] = useState('');
  const [sensorMax, setSensorMax] = useState('');

  /**
   * Push the open stream to the highest resolution the camera reports.
   * Android Chrome often starts USB cameras at 640×480 even when asked for
   * more, so we read the real capabilities and step through exact sizes.
   */
  const upgradeResolution = useCallback(async (stream: MediaStream) => {
    const track = stream.getVideoTracks()[0];
    if (!track) return;
    const caps = (track.getCapabilities?.() ?? {}) as MediaTrackCapabilities;
    const maxW = caps.width?.max ?? 0;
    const maxH = caps.height?.max ?? 0;
    if (maxW && maxH) setSensorMax(`${maxW} × ${maxH}`);
    addLog(`Camera reports max ${maxW || '?'}×${maxH || '?'}, fps ${caps.frameRate?.min ?? '?'}–${caps.frameRate?.max ?? '?'}`);

    // Still-photo resolution (often higher than the live preview).
    try {
      const IC = (window as unknown as { ImageCapture?: new (t: MediaStreamTrack) => { getPhotoCapabilities(): Promise<{ imageWidth?: { max?: number }; imageHeight?: { max?: number } }> } }).ImageCapture;
      if (IC) {
        const pc = await new IC(track).getPhotoCapabilities();
        if (pc.imageWidth?.max && pc.imageHeight?.max) {
          setPhotoMax(`${pc.imageWidth.max} × ${pc.imageHeight.max}`);
          addLog(`Still-photo max ${pc.imageWidth.max}×${pc.imageHeight.max}`);
        }
      }
    } catch (err) {
      addLog(`Photo capabilities unavailable: ${errName(err)}`);
    }

    const st = track.getSettings();
    setRes(st.width && st.height ? `${st.width} × ${st.height}` : '');
    setFrameRate(st.frameRate ? `${Math.round(st.frameRate)} fps` : '');
  }, [addLog]);

  /** Open a specific camera, stepping down the resolution ladder until it works. */
  const openDevice = useCallback(async (deviceId: string, startMode: number) => {
    const seq = ++openSeq.current;
    stopStream(streamRef.current);
    streamRef.current = null;
    setStarted(false);
    setBusy(true);
    setError('');
    let lastErr: unknown = null;
    let sawBroken = false;
    for (let i = startMode; i < MODES.length; i++) {
      const mode = MODES[i];
      try {
        addLog(`Trying ${mode.label}…`);
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { ...modeConstraints(mode), ...(deviceId ? { deviceId: { exact: deviceId } } : {}) },
        });
        if (seq !== openSeq.current) { stopStream(stream); return; }
        await attach(stream);
        const st = stream.getVideoTracks()[0]?.getSettings() ?? {};
        addLog(`Opened ${st.width}×${st.height} @ ${st.frameRate ? Math.round(st.frameRate) : '?'}fps — checking picture…`);
        const video = videoRef.current;
        let verdict: 'green' | 'blank' | null = null;
        if (video) {
          // Give the camera time to warm up: first frames are often green.
          for (let k = 0; k < 4; k++) {
            await waitForFrames(video, 700);
            verdict = frameLooksBroken(video);
            if (!verdict) break;
          }
        }
        if (seq !== openSeq.current) return;
        if (verdict) {
          sawBroken = true;
          addLog(`Picture is ${verdict} at ${mode.label} — trying next mode`);
          stopStream(stream);
          streamRef.current = null;
          setStarted(false);
          await new Promise(r => setTimeout(r, 400));
          continue;
        }
        setMinMode(i);
        addLog(`✓ Good picture at ${mode.label}`);
        if (i === 0) await upgradeResolution(stream);
        setBusy(false);
        return;
      } catch (err) {
        lastErr = err;
        addLog(`Rejected ${mode.label}: ${errName(err)}`);
        if (errName(err) === 'NotAllowedError') break;
        await new Promise(r => setTimeout(r, 400));
      }
    }
    if (sawBroken && seq === openSeq.current && !lastErr) {
      setError('The camera only produced a green or blank picture in every mode. Replug the camera and tap Try again, or use "Attach photo file".');
      setBusy(false);
      return;
    }
    if (seq === openSeq.current) {
      setError(friendlyError(lastErr));
      setBusy(false);
    }
  }, [addLog, attach, upgradeResolution]);

  /** Ask permission (like webcamtests.com does), then list every camera. */
  const refreshDevices = useCallback(async () => {
    if (!window.isSecureContext) {
      setError('Cameras only work on a secure (https) address. Open the published app link.');
      setBusy(false);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('This browser does not allow live camera access. Use "Attach photo file".');
      setBusy(false);
      return;
    }
    setBusy(true);
    setError('');
    addLog('Requesting camera permission…');

    let permStream: MediaStream | null = null;
    try {
      permStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      addLog(`Permission granted (${permStream.getVideoTracks()[0]?.label || 'default camera'})`);
    } catch (err) {
      addLog(`Permission request failed: ${errName(err)}`);
      if (errName(err) === 'NotAllowedError' || errName(err) === 'SecurityError') {
        setError(friendlyError(err));
        setBusy(false);
        return;
      }
    }

    let cams: MediaDeviceInfo[] = [];
    try {
      cams = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput');
    } catch (err) {
      addLog(`Listing cameras failed: ${errName(err)}`);
    }
    addLog(`Found ${cams.length} camera(s): ${cams.map(c => c.label || '(unnamed)').join(', ') || 'none'}`);
    setDevices(cams);

    const permDeviceId = permStream?.getVideoTracks()[0]?.getSettings().deviceId ?? '';
    const external = cams.find(c => isExternal(c.label));
    const pick =
      (selectedDeviceId && cams.some(c => c.deviceId === selectedDeviceId) && selectedDeviceId) ||
      external?.deviceId ||
      (cams.length ? cams[cams.length - 1].deviceId : '') || // USB cameras are usually listed last
      permDeviceId;

    // Release the permission stream before opening the chosen camera so
    // the USB device isn't held twice.
    stopStream(permStream);
    await new Promise(r => setTimeout(r, 300));

    if (cams.length === 0 && !permStream) {
      setError('No camera is visible to the browser yet. Replug the USB camera, accept the "use external device" prompt, then tap refresh.');
      setBusy(false);
      return;
    }
    setSelectedDeviceId(pick);
    setMinMode(0);
    await openDevice(pick, 0);
  }, [addLog, openDevice, selectedDeviceId]);

  useEffect(() => {
    void refreshDevices();
    let t: ReturnType<typeof setTimeout> | undefined;
    const onChange = () => {
      clearTimeout(t);
      t = setTimeout(async () => {
        addLog('Camera plugged in / removed — updating list');
        const cams = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput');
        setDevices(cams);
      }, 600);
    };
    navigator.mediaDevices?.addEventListener?.('devicechange', onChange);
    return () => {
      clearTimeout(t);
      navigator.mediaDevices?.removeEventListener?.('devicechange', onChange);
      openSeq.current++;
      stopStream(streamRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chooseDevice = (id: string) => {
    setSelectedDeviceId(id);
    setMinMode(0);
    void openDevice(id, 0);
  };

  const lowerResolution = () => {
    const next = Math.min(MODES.length - 1, minMode + 1);
    setMinMode(next);
    void openDevice(selectedDeviceId, next);
  };

  const finish = (full: string, width: number, height: number, source: CanvasImageSource) => {
    const scale = Math.min(1, 1000 / Math.max(width, height));
    const pc = document.createElement('canvas');
    pc.width = Math.round(width * scale);
    pc.height = Math.round(height * scale);
    const pctx = pc.getContext('2d');
    if (!pctx) return;
    pctx.drawImage(source, 0, 0, pc.width, pc.height);
    onCapture({ full, preview: pc.toDataURL('image/jpeg', 0.62), width, height });
    onClose();
  };

  const captureFromVideo = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const width = video.videoWidth;
    const height = video.videoHeight;
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, width, height);
    finish(c.toDataURL('image/jpeg', 0.92), width, height, c);
  };

  const [capturing, setCapturing] = useState(false);

  /** Prefer the browser's still-photo API (full sensor resolution), fall back to a video frame. */
  const capture = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    const video = videoRef.current;
    const IC = (window as unknown as { ImageCapture?: new (t: MediaStreamTrack) => { getPhotoCapabilities(): Promise<{ imageWidth?: { max?: number }; imageHeight?: { max?: number } }>; takePhoto(o?: { imageWidth?: number; imageHeight?: number }): Promise<Blob> } }).ImageCapture;
    if (track && IC && video) {
      setCapturing(true);
      try {
        const ic = new IC(track);
        const pc = await ic.getPhotoCapabilities().catch(() => null);
        const opts = pc?.imageWidth?.max && pc?.imageHeight?.max
          ? { imageWidth: pc.imageWidth.max, imageHeight: pc.imageHeight.max }
          : undefined;
        const blob = await ic.takePhoto(opts);
        const bmp = await createImageBitmap(blob);
        addLog(`Still photo ${bmp.width}×${bmp.height}`);
        if (bmp.width * bmp.height >= video.videoWidth * video.videoHeight) {
          const full = await new Promise<string>((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(String(r.result));
            r.onerror = reject;
            r.readAsDataURL(blob);
          });
          finish(full, bmp.width, bmp.height, bmp);
          return;
        }
      } catch (err) {
        addLog(`Still photo failed (${errName(err)}), using video frame`);
      } finally {
        setCapturing(false);
      }
    }
    captureFromVideo();
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col" role="dialog" aria-label="Camera capture">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface flex-shrink-0">
        <div>
          <div className="font-display text-lg text-ct-accent">Camera</div>
          <div className="font-mono-ibm text-[10px] text-ct-text3 uppercase mt-0.5">
            USB / OTG camera supported
          </div>
        </div>
        <button onClick={onClose} className="p-2 text-ct-text2 hover:text-ct-text active:scale-95" aria-label="Close camera">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex items-center gap-2 border-b border-border bg-surface px-4 py-3">
        <select
          value={selectedDeviceId}
          onChange={e => chooseDevice(e.target.value)}
          aria-label="Camera"
          className="h-12 min-w-0 flex-1 rounded-sm border border-border bg-background px-3 font-mono-ibm text-xs text-foreground"
        >
          {devices.length === 0 && <option value={selectedDeviceId}>{busy ? 'Finding cameras…' : 'No cameras listed'}</option>}
          {devices.map((d, i) => (
            <option key={d.deviceId || i} value={d.deviceId}>
              {(d.label || `Camera ${i + 1}`) + (isExternal(d.label) ? '  (USB)' : '')}
            </option>
          ))}
        </select>
        <button
          onClick={() => void refreshDevices()}
          disabled={busy}
          className="flex h-12 w-12 flex-shrink-0 items-center justify-center border border-border text-ct-text2 disabled:opacity-50"
          aria-label="Refresh camera list"
        >
          <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
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
            {busy ? 'Connecting to camera… accept any permission prompts' : 'Choose a camera above'}
          </div>
        )}
        {error && (
          <div className="mx-4 max-w-md text-center">
            <div className="font-mono-ibm text-xs leading-relaxed text-ct-warn">{error}</div>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button
                onClick={() => void refreshDevices()}
                className="inline-flex items-center gap-2 border border-border px-4 py-3 font-mono-ibm text-[11px] uppercase text-ct-text2"
              >
                <RefreshCw className="h-4 w-4" /> Try again
              </button>
              <button
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-2 border border-border px-4 py-3 font-mono-ibm text-[11px] uppercase text-ct-accent"
              >
                <ImagePlus className="h-4 w-4" /> Attach photo file
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-border bg-surface px-4 py-3 flex-shrink-0">
        {started && (
          <>
            <div className="mb-2 flex flex-wrap items-center justify-center gap-2 font-mono-ibm text-[10px] uppercase text-ct-text3">
              <span className="text-ct-accent">Active: {res || 'resolution unknown'}</span>
              {frameRate && <span>· {frameRate}</span>}
              {sensorMax && <span>· camera max {sensorMax}</span>}
              {photoMax && <span>· photo {photoMax}</span>}
              {minMode < MODES.length - 1 && (
                <button onClick={lowerResolution} className="underline text-ct-text2">
                  Picture green or frozen? Try lower resolution
                </button>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => fileRef.current?.click()}
                className="flex items-center justify-center gap-2 border border-border px-4 py-4 font-mono-ibm text-[11px] uppercase text-ct-text2"
              >
                <ImagePlus className="h-4 w-4" />
                <span className="hidden sm:inline">Attach file</span>
              </button>
              <button
                onClick={() => void capture()}
                disabled={capturing || busy}
                className="flex flex-1 items-center justify-center gap-2 rounded-sm bg-ct-accent py-4 font-mono-ibm text-sm font-semibold uppercase text-background active:scale-[.98]"
              >
                <Camera className="h-4 w-4" /> {capturing ? 'Capturing…' : busy ? 'Optimising…' : 'Capture photo'}
              </button>
            </div>
          </>
        )}
        <button
          onClick={() => setShowLog(v => !v)}
          className="mt-2 flex w-full items-center justify-center gap-1 font-mono-ibm text-[10px] uppercase text-ct-text3"
        >
          Camera details {showLog ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
        {showLog && (
          <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap border border-border bg-background p-2 font-mono-ibm text-[10px] text-ct-text2">
            {log.join('\n') || 'No events yet'}
          </pre>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) onFallbackFile(file);
          onClose();
        }}
      />
    </div>
  );
}
