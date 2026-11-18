"use client";

import React, { useEffect, useRef, useState } from "react";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";

interface AudioBubblePlayerProps {
  src: string;
  durationSeconds?: number;
}

const SPEEDS = [1, 1.5, 2] as const;

function formatAudioTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const rounded = Math.floor(seconds);
  const mins = Math.floor(rounded / 60);
  const secs = rounded % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

export function AudioBubblePlayer({ src, durationSeconds }: AudioBubblePlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [speedIdx, setSpeedIdx] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [measuredDuration, setMeasuredDuration] = useState<number | null>(null);

  useEffect(() => {
    setPlaying(false);
    setCurrentTime(0);
    setMeasuredDuration(null);
  }, [src]);

  const effectiveDuration =
    measuredDuration && Number.isFinite(measuredDuration) && measuredDuration > 0
      ? measuredDuration
      : typeof durationSeconds === "number" && Number.isFinite(durationSeconds) && durationSeconds > 0
        ? durationSeconds
        : 0;

  const progressPct =
    effectiveDuration > 0 ? Math.min(100, Math.max(0, (currentTime / effectiveDuration) * 100)) : 0;

  const syncDurationFromEl = (el: HTMLAudioElement) => {
    if (Number.isFinite(el.duration) && el.duration > 0) {
      setMeasuredDuration(el.duration);
    }
  };

  const togglePlay = async () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      return;
    }
    try {
      el.playbackRate = SPEEDS[speedIdx];
      await el.play();
    } catch {
      setPlaying(false);
    }
  };

  const toggleMute = () => {
    const el = audioRef.current;
    if (!el) return;
    el.muted = !el.muted;
    setMuted(el.muted);
  };

  const cycleSpeed = () => {
    const nextIdx = (speedIdx + 1) % SPEEDS.length;
    setSpeedIdx(nextIdx);
    if (audioRef.current) {
      audioRef.current.playbackRate = SPEEDS[nextIdx];
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextTime = Number(e.target.value);
    if (!Number.isFinite(nextTime)) return;
    setCurrentTime(nextTime);
    if (audioRef.current) {
      audioRef.current.currentTime = nextTime;
    }
  };

  return (
    <div className="flex min-w-[232px] max-w-[280px] items-center gap-2.5 bg-transparent py-0.5">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(e) => syncDurationFromEl(e.currentTarget)}
        onDurationChange={(e) => syncDurationFromEl(e.currentTarget)}
        onTimeUpdate={(e) => {
          setCurrentTime(e.currentTarget.currentTime);
          syncDurationFromEl(e.currentTarget);
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setCurrentTime(0);
        }}
      />

      <button
        type="button"
        onClick={togglePlay}
        aria-label={playing ? "Pausar áudio" : "Reproduzir áudio"}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#16A34A] text-white shadow-sm transition hover:bg-emerald-700"
      >
        {playing ? (
          <Pause className="h-3.5 w-3.5 fill-current" />
        ) : (
          <Play className="ml-0.5 h-3.5 w-3.5 fill-current" />
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div className="relative flex h-4 items-center">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-900/10">
            <div
              className="h-full rounded-full bg-[#16A34A] transition-[width] duration-75"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span
            className="pointer-events-none absolute h-3 w-3 rounded-full bg-[#16A34A] shadow-sm ring-2 ring-white/90"
            style={{ left: `clamp(0px, calc(${progressPct}% - 6px), calc(100% - 12px))` }}
          />
          <input
            type="range"
            aria-label="Progresso do áudio"
            min={0}
            max={effectiveDuration || 100}
            step={0.1}
            value={Math.min(currentTime, effectiveDuration || 100)}
            disabled={effectiveDuration <= 0}
            onChange={handleSeek}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-default"
          />
        </div>
        <div className="mt-0.5 flex items-center justify-between text-[10px] font-medium tabular-nums text-slate-500">
          <span>{formatAudioTime(currentTime)}</span>
          <span>{formatAudioTime(effectiveDuration)}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={cycleSpeed}
        title="Alterar velocidade de reprodução"
        className="shrink-0 rounded-md bg-slate-900/5 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-slate-600 transition hover:bg-slate-900/10"
      >
        {SPEEDS[speedIdx]}x
      </button>

      <button
        type="button"
        onClick={toggleMute}
        aria-label={muted ? "Ativar som" : "Silenciar"}
        className="shrink-0 rounded-lg p-1 text-slate-500 transition hover:bg-slate-900/5 hover:text-slate-800"
      >
        {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}
