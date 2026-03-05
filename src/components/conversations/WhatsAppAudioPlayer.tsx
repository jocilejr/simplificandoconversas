import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause } from "lucide-react";
import { cn } from "@/lib/utils";
import { ContactAvatar } from "./ContactAvatar";

interface WhatsAppAudioPlayerProps {
  src: string;
  isOutbound: boolean;
  contactPhoto?: string | null;
  contactName?: string | null;
}

export function WhatsAppAudioPlayer({ src, isOutbound, contactPhoto, contactName }: WhatsAppAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [waveform] = useState(() =>
    Array.from({ length: 40 }, () => Math.random() * 0.7 + 0.3)
  );

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onLoaded = () => setDuration(audio.duration || 0);
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onEnded = () => { setPlaying(false); setCurrentTime(0); };
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
    if (playing) audio.pause(); else audio.play();
    setPlaying(!playing);
  }, [playing]);

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

  return (
    <div className="flex items-center gap-2 min-w-[200px] max-w-[300px] py-1">
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Play/Pause */}
      <button
        onClick={togglePlay}
        className="shrink-0 flex items-center justify-center h-8 w-8"
      >
        {playing ? (
          <Pause className={cn("h-5 w-5", isOutbound ? "text-white/80" : "text-[#00a884]")} />
        ) : (
          <Play className={cn("h-5 w-5 ml-0.5", isOutbound ? "text-white/80" : "text-[#00a884]")} fill="currentColor" />
        )}
      </button>

      {/* Waveform + time */}
      <div className="flex-1 min-w-0">
        <div
          className="relative flex items-center gap-[1.5px] h-7 cursor-pointer"
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
                style={{ height: `${h * 24}px` }}
              />
            );
          })}
          {/* Blue progress dot */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-[#53bdeb] shadow-sm border-[1.5px] border-white/30 pointer-events-none z-10"
            style={{ left: `${progress * 100}%`, marginLeft: "-6px" }}
          />
        </div>
        <span className={cn(
          "text-[10px] leading-none mt-0.5 block",
          isOutbound ? "text-white/45" : "text-[#8696a0]"
        )}>
          {formatTime(playing ? currentTime : duration)}
        </span>
      </div>

      {/* Contact avatar for inbound */}
      {!isOutbound && (
        <ContactAvatar
          photoUrl={contactPhoto}
          name={contactName}
          size="sm"
          className="h-[34px] w-[34px] shrink-0"
        />
      )}
    </div>
  );
}
