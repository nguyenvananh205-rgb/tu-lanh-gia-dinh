import { useCallback, useEffect, useRef, useState } from "react";

export interface VoiceRecording {
  blob: Blob;
  durationMs: number;
  /** ~40 mức âm lượng 0–100 để vẽ sóng âm */
  waveform: number[];
  mimeType: string;
  fileName: string;
}

const SAMPLE_INTERVAL_MS = 120;
const MAX_WAVEFORM_POINTS = 40;
/** Giới hạn 3 phút cho một tin nhắn thoại */
const MAX_DURATION_MS = 3 * 60 * 1000;

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

/** Ghi âm tin nhắn thoại bằng MediaRecorder + đo mức âm để vẽ sóng */
export function useVoiceRecorder() {
  const supported =
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia;

  const [recording, setRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [levels, setLevels] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const levelsRef = useRef<number[]>([]);
  const startedAtRef = useRef(0);
  const timersRef = useRef<number[]>([]);
  const cancelledRef = useRef(false);

  const cleanup = useCallback(() => {
    timersRef.current.forEach((id) => window.clearInterval(id));
    timersRef.current = [];
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    analyserRef.current = null;
    void audioCtxRef.current?.close().catch(() => undefined);
    audioCtxRef.current = null;
    recorderRef.current = null;
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const start = useCallback(async () => {
    if (!supported || recording) return;
    setError(null);
    cancelledRef.current = false;
    chunksRef.current = [];
    levelsRef.current = [];
    setLevels([]);
    setElapsedMs(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.start();
      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      setRecording(true);

      // Đo mức âm lượng để vẽ sóng
      const AudioCtx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(analyser);
      analyserRef.current = analyser;

      const buffer = new Uint8Array(analyser.frequencyBinCount);
      const levelTimer = window.setInterval(() => {
        const node = analyserRef.current;
        if (!node) return;
        node.getByteTimeDomainData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
          const deviation = (buffer[i] - 128) / 128;
          sum += deviation * deviation;
        }
        const rms = Math.sqrt(sum / buffer.length);
        const level = Math.max(4, Math.min(100, Math.round(rms * 260)));
        levelsRef.current = [...levelsRef.current, level].slice(-MAX_WAVEFORM_POINTS * 4);
        setLevels(levelsRef.current.slice(-MAX_WAVEFORM_POINTS));
      }, SAMPLE_INTERVAL_MS);

      const clockTimer = window.setInterval(() => {
        const elapsed = Date.now() - startedAtRef.current;
        setElapsedMs(elapsed);
        if (elapsed >= MAX_DURATION_MS && recorderRef.current?.state === "recording") {
          recorderRef.current.stop();
        }
      }, 200);

      timersRef.current = [levelTimer, clockTimer];
    } catch (err) {
      cleanup();
      setRecording(false);
      const name = (err as Error).name;
      setError(
        name === "NotAllowedError"
          ? "Bạn cần cho phép truy cập micro để ghi âm"
          : "Không dùng được micro trên thiết bị này"
      );
    }
  }, [supported, recording, cleanup]);

  /** Dừng và trả về bản ghi (null nếu bị huỷ hoặc không có dữ liệu) */
  const stop = useCallback(async (): Promise<VoiceRecording | null> => {
    const recorder = recorderRef.current;
    if (!recorder) return null;

    const durationMs = Date.now() - startedAtRef.current;
    const mimeType = recorder.mimeType || "audio/webm";

    const blob = await new Promise<Blob | null>((resolve) => {
      recorder.onstop = () => {
        if (cancelledRef.current || chunksRef.current.length === 0) resolve(null);
        else resolve(new Blob(chunksRef.current, { type: mimeType }));
      };
      if (recorder.state !== "inactive") recorder.stop();
      else resolve(null);
    });

    cleanup();
    setRecording(false);

    if (!blob || blob.size === 0 || durationMs < 400) return null;

    // Nén danh sách mức âm về đúng MAX_WAVEFORM_POINTS cột
    const raw = levelsRef.current;
    const step = Math.max(1, Math.ceil(raw.length / MAX_WAVEFORM_POINTS));
    const waveform: number[] = [];
    for (let i = 0; i < raw.length; i += step) {
      const slice = raw.slice(i, i + step);
      waveform.push(Math.round(slice.reduce((a, b) => a + b, 0) / slice.length));
    }

    const ext = mimeType.includes("mp4") ? "m4a" : mimeType.includes("ogg") ? "ogg" : "webm";
    return {
      blob,
      durationMs,
      waveform: waveform.length > 0 ? waveform : [30, 50, 40, 60, 35],
      mimeType,
      fileName: `voice-${Date.now()}.${ext}`,
    };
  }, [cleanup]);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    cleanup();
    setRecording(false);
    setElapsedMs(0);
    setLevels([]);
  }, [cleanup]);

  return { supported, recording, elapsedMs, levels, error, start, stop, cancel };
}
