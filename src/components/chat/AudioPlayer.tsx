import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  src: string;
  mine: boolean;
  transcription?: string | null;
}

const SPEEDS = [1, 1.5, 2] as const;
const BAR_COUNT = 38;

// Deterministic pseudo-random waveform for a stable visual without decoding the audio.
function useWaveform(seed: string): number[] {
  return useMemo(() => {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
    const bars: number[] = [];
    for (let i = 0; i < BAR_COUNT; i++) {
      h = (h * 1103515245 + 12345) & 0x7fffffff;
      // map to 0.25 - 1.0
      const v = 0.25 + ((h % 1000) / 1000) * 0.75;
      bars.push(v);
    }
    return bars;
  }, [seed]);
}

function formatTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function AudioPlayer({ src, mine, transcription }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const barsRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [speedIdx, setSpeedIdx] = useState(0);
  const [showTranscript, setShowTranscript] = useState(false);
  const waveform = useWaveform(src);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setCurrent(a.currentTime);
    const onMeta = () => setDuration(a.duration);
    const onEnd = () => {
      setPlaying(false);
      setCurrent(0);
    };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("durationchange", onMeta);
    a.addEventListener("ended", onEnd);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("durationchange", onMeta);
      a.removeEventListener("ended", onEnd);
    };
  }, []);

  useEffect(() => {
    const a = audioRef.current;
    if (a) a.playbackRate = SPEEDS[speedIdx];
  }, [speedIdx]);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      a.play();
      setPlaying(true);
    } else {
      a.pause();
      setPlaying(false);
    }
  };

  const cycleSpeed = () => setSpeedIdx((i) => (i + 1) % SPEEDS.length);

  const progress = duration > 0 ? current / duration : 0;

  const handleBarsClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = barsRef.current;
    const a = audioRef.current;
    if (!el || !a || !duration) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    a.currentTime = ratio * duration;
    setCurrent(a.currentTime);
  };

  const hasTranscript = !!(transcription && transcription.trim());

  return (
    <div className="flex flex-col gap-1.5 min-w-[260px] max-w-[320px]">
      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />

      <div className="flex items-center gap-2.5">
        {/* Play / Pause */}
        <button
          onClick={toggle}
          className={cn(
            "h-9 w-9 shrink-0 rounded-full flex items-center justify-center transition-colors",
            mine
              ? "bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground"
              : "bg-primary text-primary-foreground hover:bg-primary/90"
          )}
          aria-label={playing ? "Pausar" : "Reproduzir"}
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
        </button>

        {/* Waveform */}
        <div className="flex-1 flex flex-col gap-1 min-w-0">
          <div
            ref={barsRef}
            onClick={handleBarsClick}
            className="h-7 flex items-center gap-[2px] cursor-pointer select-none"
          >
            {waveform.map((h, i) => {
              const filled = i / BAR_COUNT <= progress;
              return (
                <span
                  key={i}
                  className={cn(
                    "w-[2px] rounded-full transition-colors",
                    mine
                      ? filled
                        ? "bg-primary-foreground"
                        : "bg-primary-foreground/40"
                      : filled
                      ? "bg-primary"
                      : "bg-muted-foreground/40"
                  )}
                  style={{ height: `${Math.round(h * 100)}%` }}
                />
              );
            })}
          </div>
          <div className={cn(
            "flex items-center justify-between text-[10px] tabular-nums",
            mine ? "text-primary-foreground/70" : "text-muted-foreground"
          )}>
            <span>{formatTime(playing || current > 0 ? current : duration)}</span>
            {hasTranscript && (
              <button
                onClick={() => setShowTranscript((v) => !v)}
                className={cn(
                  "inline-flex items-center gap-1 px-1.5 py-0.5 rounded hover:opacity-100 transition",
                  showTranscript ? "opacity-100" : "opacity-70",
                  mine ? "hover:bg-primary-foreground/15" : "hover:bg-foreground/10"
                )}
                title="Ver transcrição"
              >
                <FileText className="h-3 w-3" />
                {showTranscript ? "Ocultar" : "Transcrever"}
              </button>
            )}
          </div>
        </div>

        {/* Speed toggle */}
        <button
          onClick={cycleSpeed}
          className={cn(
            "h-7 w-10 shrink-0 rounded-full text-[10px] font-bold tabular-nums transition-colors",
            mine
              ? "bg-primary-foreground/15 text-primary-foreground hover:bg-primary-foreground/25"
              : "bg-muted text-foreground hover:bg-muted/70"
          )}
          title="Velocidade de reprodução"
        >
          {SPEEDS[speedIdx]}x
        </button>
      </div>

      {hasTranscript && showTranscript && (
        <div
          className={cn(
            "text-[11px] leading-relaxed rounded-md px-2.5 py-1.5 border-l-2 whitespace-pre-wrap break-words",
            mine
              ? "bg-primary-foreground/10 border-primary-foreground/40 text-primary-foreground/90"
              : "bg-background/60 border-primary/50 text-foreground/90"
          )}
        >
          <div className={cn(
            "text-[9px] uppercase tracking-wider font-semibold mb-0.5 opacity-70 flex items-center gap-1"
          )}>
            <FileText className="h-2.5 w-2.5" />
            Transcrição
          </div>
          {transcription}
        </div>
      )}
    </div>
  );
}
