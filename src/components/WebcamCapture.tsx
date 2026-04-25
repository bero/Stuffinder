import { useEffect, useRef, useState } from 'preact/hooks';
import { useT } from '../lib/i18n';

interface Props {
  onCapture: (file: File) => void;
  onCancel: () => void;
}

type CamError =
  | { kind: 'unavailable' }
  | { kind: 'getUserMedia'; name: string; message: string };

// Full-screen modal that streams the user's webcam (or phone rear camera) into
// a <video> and lets them snap a still frame. Needs HTTPS or localhost.
export function WebcamCapture({ onCapture, onCancel }: Props) {
  const t = useT();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState<CamError | null>(null);
  const [preview, setPreview] = useState<{ blob: Blob; url: string } | null>(null);

  useEffect(() => {
    let localStream: MediaStream | null = null;
    async function start() {
      if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
        setErr({ kind: 'unavailable' });
        return;
      }
      try {
        // "ideal" prefers rear camera on phones but accepts the front/only
        // camera on laptops and single-camera devices.
        localStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
      } catch (firstErr) {
        console.warn('Camera with facingMode ideal failed, retrying any video', firstErr);
        try {
          localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        } catch (e: unknown) {
          console.error('getUserMedia failed', e);
          const name = e instanceof Error ? e.name : 'Error';
          const message = e instanceof Error ? e.message : '';
          setErr({ kind: 'getUserMedia', name, message });
          return;
        }
      }
      if (videoRef.current) {
        videoRef.current.srcObject = localStream;
        await videoRef.current.play().catch(() => {});
      }
      setReady(true);
    }
    start();
    return () => {
      localStream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  function errMessage(e: CamError): string {
    if (e.kind === 'unavailable') {
      return `${t('webcam.error')} (mediaDevices unavailable — need HTTPS)`;
    }
    return `${t('webcam.error')} (${e.name}${e.message ? ': ' + e.message : ''})`;
  }

  // Free the preview URL when it changes or unmounts.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview.url);
    };
  }, [preview]);

  function snap() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        setPreview({ blob, url: URL.createObjectURL(blob) });
      },
      'image/jpeg',
      0.9,
    );
  }

  function usePreview() {
    if (!preview) return;
    const file = new File([preview.blob], `webcam-${Date.now()}.jpg`, { type: 'image/jpeg' });
    URL.revokeObjectURL(preview.url);
    onCapture(file);
  }

  function retake() {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
  }

  return (
    <div class="fixed inset-0 bg-black z-50 flex flex-col safe-top safe-bottom">
      <div class="flex-1 flex items-center justify-center overflow-hidden bg-black">
        {preview ? (
          <img src={preview.url} alt="" class="max-h-full max-w-full object-contain" />
        ) : (
          <video
            ref={videoRef}
            autoplay
            playsinline
            muted
            class="max-h-full max-w-full object-contain"
          />
        )}
      </div>

      {err && (
        <div class="bg-red-900/80 border-t border-red-700 text-red-100 px-4 py-3">
          {errMessage(err)}
        </div>
      )}

      <div class="p-4 flex gap-3 bg-slate-900/95 backdrop-blur">
        <button onClick={onCancel} class="btn-secondary flex-1">
          {t('common.cancel')}
        </button>
        {preview ? (
          <>
            <button onClick={retake} class="btn-secondary flex-1">
              {t('webcam.retake')}
            </button>
            <button onClick={usePreview} class="btn-primary flex-1">
              {t('webcam.use')}
            </button>
          </>
        ) : (
          <button onClick={snap} disabled={!ready || !!err} class="btn-primary flex-1">
            {t('webcam.capture')}
          </button>
        )}
      </div>
    </div>
  );
}
