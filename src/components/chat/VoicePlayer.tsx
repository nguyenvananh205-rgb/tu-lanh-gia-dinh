import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { formatDuration } from "../../utils/chatFormat";

interface Props {
  src: string;
  durationMs?: number;
  waveform?: number[];
  mine: boolean;
}

const FALLBACK_WAVE = [18, 42, 26, 58, 34, 70, 44, 30, 62, 38, 24, 52, 30, 46, 22];

/** Trình phát tin nhắn thoại: nút play + cột sóng âm bấm được để tua */
export default function VoicePlayer({ src, durationMs, waveform, mine }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0–1
  const [currentMs, setCurrentMs] = useState(0);

  const bars = waveform && waveform.length > 0 ? waveform : FALLBACK_WAVE;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTime = () => {
      const total = Number.isFinite(audio.duration) && audio.duration > 0
        ? audio.duration
        : (durationMs ?? 0) / 1000;
      setCurrentMs(audio.currentTime * 1000);
      setProgress(total > 0 ? Math.min(1, audio.currentTime / total) : 0);
    };
    const onEnded = () => {
      setPlaying(false);
      setProgress(0);
      setCurrentMs(0);
    };

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnded);
    };
  }, [durationMs]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      void audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    }
  };

  const seek = (ratio: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const total = Number.isFinite(audio.duration) && audio.duration > 0
      ? audio.duration
      : (durationMs ?? 0) / 1000;
    if (total <= 0) return;
    audio.currentTime = total * ratio;
    setProgress(ratio);
  };

  const playedBars = Math.round(progress * bars.length);

  return (
    <div className="flex items-center gap-2.5 min-w-[190px]">
      <audio ref={audioRef} src={src} preload="metadata" />

      <button
        onClick={toggle}
        className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
          mine ? "bg-white/25 hover:bg-white/35 text-white" : "bg-emerald-500 hover:bg-emerald-600 text-white"
        }`}
        title={playing ? "Tạm dừng" : "Phát"}
      >
        {playing ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
      </button>

      <div className="flex-1">
        <div
          className="flex items-end gap-[2px] h-7 cursor-pointer"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            seek(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)));
          }}
        >
          {bars.map((level, index) => (
            <span
              key={index}
              className={`flex-1 min-w-[2px] rounded-full transition-colors ${
                index < playedBars
                  ? mine ? "bg-white" : "bg-emerald-500"
                  : mine ? "bg-white/40" : "bg-slate-300"
              }`}
              style={{ height: `${Math.max(12, Math.min(100, level))}%` }}
            />
          ))}
        </div>
        <span className={`text-[11px] ${mine ? "text-white/80" : "text-slate-400"}`}>
          {formatDuration(playing || progress > 0 ? currentMs : durationMs)}
        </span>
      </div>
    </div>
  );
}
