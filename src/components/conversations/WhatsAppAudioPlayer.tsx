import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause } from "lucide-react";
import { cn } from "@/lib/utils";
import { ContactAvatar } from "./ContactAvatar";

interface WhatsAppAudioPlayerProps {
  src: string;
  isOutbound: boolean;
  contactPhoto?: string | null;
  contactName?: string | null;
  timestamp?: string;
}

const SPEEDS = [1, 1.5, 2];

export function WhatsAppAudioPlayer({ src, isOutbound, contactPhoto, contactName, timestamp }: WhatsAppAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [speedIdx, setSpeedIdx] = useState(0);
  const [waveform] = useState(() =>
    Array.from({ length: 45 }, () => Math.random() * 0.7 + 0.3)
  );

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onLoaded = () => setDuration(audio.duration || 0);
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onEnded = () => { setPlaying(false); setCurrentTime(0); setSpeedIdx(0); };
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) { audio.pause(); } else { audio.play(); }
    setPlaying(!playing);
  }, [playing]);

  const cycleSpeed = useCallback(() => {
    const next = (speedIdx + 1) % SPEEDS.length;
    setSpeedIdx(next);
    if (audioRef.current) audioRef.current.playbackRate = SPEEDS[next];
  }, [speedIdx]);

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * duration;
    setCurrentTime(ratio * duration);
  };

  const progress = duration > 0 ? currentTime / duration : 0;

  const formatTime = (s: number) => {
    if (!s || isNaN(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const speedLabel = SPEEDS[speedIdx] === 1.5 ? "1,5x" : `${SPEEDS[speedIdx]}x`;

  return (
    <div className="flex flex-col min-w-[320px] max-w-[420px]">
      <audio ref={audioRef} src={src} preload="metadata" />

      <div className="flex items-center gap-2">
        {/* Play/Pause */}
        <button onClick={togglePlay} className="shrink-0 flex items-center justify-center h-9 w-9">
          {playing ? (
            <Pause className={cn("h-6 w-6", isOutbound ? "text-white/80" : "text-[#00a884]")} />
          ) : (
            <Play className={cn("h-6 w-6 ml-0.5", isOutbound ? "text-white/80" : "text-[#00a884]")} fill="currentColor" />
          )}
        </button>

        {/* Waveform */}
        <div className="flex-1 min-w-0">
          <div
            className="relative flex items-center gap-[1.5px] h-8 cursor-pointer"
            onClick={handleSeek}
          >
            {waveform.map((h, i) => {
              const barProgress = i / waveform.length;
              const isPlayed = barProgress < progress;
              return (
                <div
                  key={i}
                  className={cn(
                    "w-[2px] rounded-full transition-colors duration-100",
                    isPlayed
                      ? isOutbound ? "bg-white/80" : "bg-[#00a884]"
                      : isOutbound ? "bg-white/25" : "bg-[#8696a0]/50"
                  )}
                  style={{ height: `${h * 28}px` }}
                />
              );
            })}
            {/* Blue progress dot */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-[#53bdeb] shadow-sm border-[1.5px] border-white/30 pointer-events-none z-10"
              style={{ left: `${progress * 100}%`, marginLeft: "-6px" }}
            />
          </div>
        </div>

        {/* Speed button (when playing) or Contact avatar (inbound) */}
        {playing ? (
          <button
            onClick={cycleSpeed}
            className={cn(
              "shrink-0 h-[34px] min-w-[34px] px-1 rounded-full text-[11px] font-bold flex items-center justify-center transition-colors",
              isOutbound
                ? "bg-white/15 text-white/80 hover:bg-white/25"
                : "bg-[#00a884]/15 text-[#00a884] hover:bg-[#00a884]/25"
            )}
          >
            {speedLabel}
          </button>
        ) : !isOutbound ? (
          <ContactAvatar
            photoUrl={contactPhoto}
            name={contactName}
            size="sm"
            className="h-[34px] w-[34px] shrink-0"
          />
        ) : null}
      </div>

      {/* Duration + Timestamp row */}
      <div className="flex items-center justify-between px-1 -mt-0.5">
        <span className={cn(
          "text-[10px] leading-none",
          isOutbound ? "text-white/45" : "text-[#8696a0]"
        )}>
          {formatTime(playing ? currentTime : duration)}
        </span>
        {timestamp && (
          <span className={cn(
            "text-[10px] leading-none",
            isOutbound ? "text-white/45" : "text-[#8696a0]"
          )}>
            {timestamp}
          </span>
        )}
      </div>
    </div>
  );
}
