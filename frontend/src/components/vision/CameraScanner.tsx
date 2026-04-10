"use client";

import { useEffect, useRef, useState } from 'react';

interface CameraScannerProps {
  onClose?: () => void;
  userLocation?: [number, number];
  onHazardDetected?: () => void;
}

export function CameraScanner({ onClose, userLocation, onHazardDetected }: CameraScannerProps) {
  const [isMounted, setIsMounted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const userLocationRef = useRef<[number, number] | undefined>(userLocation);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const [status, setStatus] = useState<'loading' | 'active' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [lastAlert, setLastAlert] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => { setIsMounted(true); }, []);

  useEffect(() => { userLocationRef.current = userLocation; }, [userLocation]);

  const captureAndAnalyze = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = video.videoWidth || 320;
    canvas.height = video.videoHeight || 240;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const image_base64 = canvas.toDataURL('image/jpeg', 0.5);
    const currentLocation = userLocationRef.current;
    const body: Record<string, any> = { image_base64 };

    if (currentLocation) {
      body.lon = currentLocation[0];
      body.lat = currentLocation[1];
    }

    try {
      const response = await fetch(`${API_URL}/api/vision/analyze`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });
      if (response.ok) {
        const result = await response.json();
        if (result.hazard_detected && result.message) {
          setLastAlert(result.message);
          if (onHazardDetected) onHazardDetected();
        }
      }
    } catch (err) { } finally { setIsSending(false); }
  };

  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setStatus('active');
        intervalRef.current = setInterval(captureAndAnalyze, 60000);
      } catch (err: any) {
        setStatus('error');
        setErrorMessage(err.name === 'NotAllowedError' ? 'Доступ запрещён' : 'Камера не найдена');
      }
    };

    startCamera();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
    };
  }, []);

  return (
    <div className={`absolute bottom-6 right-6 z-30 pointer-events-auto transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] ${isMounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      <div className="relative bg-black/70 backdrop-blur-md rounded-2xl border border-white/20 shadow-2xl overflow-hidden" style={{ width: '240px' }}>
        <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${status === 'active' ? 'bg-emerald-400 animate-pulse' : status === 'loading' ? 'bg-amber-400 animate-pulse' : 'bg-red-400'}`}></span>
            <span className="text-xs font-bold tracking-wider uppercase text-white/80">
              {status === 'active' ? 'AI-Зрение ON' : status === 'loading' ? 'Инициализация...' : 'Ошибка'}
            </span>
          </div>
          {onClose && (
            <button onClick={onClose} className="text-white/50 hover:text-white/90 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
            </button>
          )}
        </div>

        {status !== 'error' ? (
          <div className="relative">
            <video ref={videoRef} autoPlay playsInline muted className="w-full" style={{ height: '135px', objectFit: 'cover', display: 'block' }} />
            {status === 'active' && (
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-emerald-400 rounded-tl-sm"></div>
                <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-emerald-400 rounded-tr-sm"></div>
                <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-emerald-400 rounded-bl-sm"></div>
                <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-emerald-400 rounded-br-sm"></div>
                <div className="absolute left-4 right-4 top-1/2 h-px bg-emerald-400/40"></div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center px-4 py-5 gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" /><circle cx="12" cy="13" r="3" /></svg>
            <p className="text-xs text-red-300 text-center leading-relaxed">{errorMessage}</p>
          </div>
        )}

        <div className="px-3 py-2">
          {lastAlert ? (
            <div className="bg-red-500/20 border border-red-400/30 rounded-lg px-2 py-1.5 flex items-start gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-300 mt-0.5 shrink-0"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
              <p className="text-xs text-red-300 leading-snug">{lastAlert}</p>
            </div>
          ) : (
            <p className="text-xs text-white/40 tracking-wide text-center">
              {status === 'active' ? 'Анализ пространства...' : ''}
            </p>
          )}
        </div>

        <div className="px-3 pb-3 flex flex-col gap-2">
          {userLocationRef.current ? (
            <p className="text-[10px] text-emerald-400/70 text-center tracking-wide flex items-center justify-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
              Геопривязка активна
            </p>
          ) : (
            <p className="text-[10px] text-white/30 text-center">Нет точной геопривязки</p>
          )}

          <button
            onClick={async () => {
              setIsSending(true);
              const loc = userLocationRef.current || [49.1088, 55.7963]; // fallback to Kazan
              try {
                const res = await fetch(`${API_URL}/api/vision/analyze`, {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ image_base64: 'manual_report', lat: loc[1], lon: loc[0], force_hazard: true })
                });
                const data = await res.json();
                if (data.hazard_detected) {
                  setLastAlert(data.message || 'Сигнал успешно отправлен');
                  if (onHazardDetected) onHazardDetected();
                }
              } catch (e) { } finally { setIsSending(false); }
            }}
            disabled={isSending}
            className="w-full py-2.5 flex items-center justify-center gap-2 bg-[#1c3044] hover:bg-[#304356] disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-lg border border-white/10 active:scale-95 transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
            {isSending ? 'Отправка...' : 'Отправить Угрозу'}
          </button>
        </div>
      </div>
    </div>
  );
}
