import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause, Mic } from "lucide-react";
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
    Array.from({ length: 40 }, () => Math.random() * 0.7 + 0.3)
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

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const val = parseFloat(e.target.value);
    audio.currentTime = val;
    setCurrentTime(val);
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const formatTime = (s: number) => {
    if (!s || isNaN(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const speedLabel = SPEEDS[speedIdx] === 1.5 ? "1,5x" : `${SPEEDS[speedIdx]}x`;

  // Colors based on direction
  const playedColor = isOutbound ? "rgba(255,255,255,0.8)" : "#00a884";
  const unplayedColor = isOutbound ? "rgba(255,255,255,0.25)" : "rgba(134,150,160,0.5)";
  const dotColor = "#53bdeb";

  // Build gradient for the range track
  const sliderBackground = `linear-gradient(to right, ${playedColor} 0%, ${playedColor} ${progress}%, ${unplayedColor} ${progress}%, ${unplayedColor} 100%)`;

  return (
    <div className="wa-audio-player" style={{ minWidth: 280, maxWidth: 400 }}>
      <audio ref={audioRef} src={src} preload="metadata" />

      <div className="wa-audio-player__top">
        {/* Play/Pause */}
        <button
          onClick={togglePlay}
          className="wa-audio-player__play-btn"
          style={{ color: isOutbound ? "rgba(255,255,255,0.85)" : "#00a884" }}
        >
          {playing ? (
            <Pause className="h-7 w-7" />
          ) : (
            <Play className="h-7 w-7 ml-0.5" fill="currentColor" />
          )}
        </button>

        {/* Waveform + Slider */}
        <div className="wa-audio-player__waveform-container">
          {/* Visual waveform bars */}
          <div className="wa-audio-player__waveform">
            {waveform.map((h, i) => {
              const barPos = (i / waveform.length) * 100;
              const isPlayed = barPos < progress;
              return (
                <div
                  key={i}
                  className="wa-audio-player__bar"
                  style={{
                    height: `${h * 26}px`,
                    backgroundColor: isPlayed ? playedColor : unplayedColor,
                  }}
                />
              );
            })}
          </div>

          {/* Range slider overlay */}
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.01}
            value={currentTime}
            onChange={handleSeek}
            className="wa-audio-player__slider"
            style={{
              background: "transparent",
              // Thumb color via CSS variable
              ["--thumb-color" as any]: dotColor,
            }}
          />
        </div>

        {/* Avatar / Speed button */}
        <div className="wa-audio-player__avatar-area">
          {playing ? (
            <button
              onClick={cycleSpeed}
              className="wa-audio-player__speed-btn"
              style={{
                backgroundColor: isOutbound ? "rgba(255,255,255,0.15)" : "rgba(0,168,132,0.15)",
                color: isOutbound ? "rgba(255,255,255,0.85)" : "#00a884",
              }}
            >
              {speedLabel}
            </button>
          ) : !isOutbound ? (
            <div className="wa-audio-player__contact-photo">
              <ContactAvatar
                photoUrl={contactPhoto}
                name={contactName}
                size="sm"
                className="h-[42px] w-[42px]"
              />
              <div className="wa-audio-player__mic-badge">
                <Mic className="h-2.5 w-2.5 text-white" />
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Bottom: duration + timestamp */}
      <div className="wa-audio-player__bottom">
        <span
          className="wa-audio-player__time"
          style={{ color: isOutbound ? "rgba(255,255,255,0.45)" : "#8696a0" }}
        >
          {formatTime(playing ? currentTime : duration)}
        </span>
        {timestamp && (
          <span
            className="wa-audio-player__timestamp"
            style={{ color: isOutbound ? "rgba(255,255,255,0.45)" : "#8696a0" }}
          >
            {timestamp}
          </span>
        )}
      </div>
    </div>
  );
}
