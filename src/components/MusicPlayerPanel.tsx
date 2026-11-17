import React, { useEffect, useRef, useState } from 'react';
import {
  Disc3,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { synthEngine } from '../audio/synthEngine';
import { DemoTrack } from '../types/app';

interface MusicPlayerPanelProps {
  tracks: DemoTrack[];
  currentTrackIndex: number;
  isPlaying: boolean;
  elapsedSec: number;
  volume: number;
  isMuted: boolean;
  onTogglePlay: () => void;
  onPrevTrack: () => void;
  onNextTrack: () => void;
  onSelectTrack: (index: number) => void;
  onSeek: (sec: number) => void;
  onVolumeChange: (vol: number) => void;
  onToggleMute: () => void;
}

function formatTime(totalSec: number): string {
  const clamped = Math.max(0, Math.floor(totalSec));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const MusicPlayerPanel: React.FC<MusicPlayerPanelProps> = ({
  tracks,
  currentTrackIndex,
  isPlaying,
  elapsedSec,
  volume,
  isMuted,
  onTogglePlay,
  onPrevTrack,
  onNextTrack,
  onSelectTrack,
  onSeek,
  onVolumeChange,
  onToggleMute,
}) => {
  const currentTrack = tracks[currentTrackIndex];
  const [imgErrorMap, setImgErrorMap] = useState<Record<string, boolean>>({});
  const [spectrumBars, setSpectrumBars] = useState<number[]>(() => new Array(18).fill(0.1));
  const rafRef = useRef<number>(0);

  // Live audio visualizer driven by Web Audio AnalyserNode
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!isPlaying || prefersReducedMotion) {
      setSpectrumBars(new Array(18).fill(isPlaying ? 0.35 : 0.1));
      return;
    }

    const updateSpectrum = () => {
      const bins = synthEngine.getFrequencyBins(18);
      setSpectrumBars(bins);
      rafRef.current = window.requestAnimationFrame(updateSpectrum);
    };
    rafRef.current = window.requestAnimationFrame(updateSpectrum);

    return () => window.cancelAnimationFrame(rafRef.current);
  }, [isPlaying]);

  const progressPercent = currentTrack.durationSec > 0
    ? Math.min(100, (elapsedSec / currentTrack.durationSec) * 100)
    : 0;

  return (
    <aside
      id="player"
      aria-label="Trình phát nhạc nền AI"
      className="flex flex-1 flex-col justify-between gap-6 rounded-2xl border border-white/10 bg-[#0E121B] p-5 sm:p-6"
    >
      {/* Now Playing Header + Artwork */}
      <div>
        <div className="flex items-center justify-between gap-3 pb-4 border-b border-white/8">
          <h2 className="font-display text-lg font-semibold tracking-tight text-slate-50">
            Trình phát nhạc nền
          </h2>
          <span className="text-xs font-medium text-slate-400 tabular-nums">
            {isPlaying ? 'Đang phát' : 'Đang tạm dừng'} · {currentTrack.bpm} BPM
          </span>
        </div>

        {/* Cover + Track Metadata */}
        <div className="mt-5 flex items-center gap-4">
          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-white/12 bg-[#131926]">
            {!imgErrorMap[currentTrack.id] ? (
              <img
                src={currentTrack.coverUrl}
                alt={`Ảnh bìa bản nhạc ${currentTrack.title}`}
                referrerPolicy="no-referrer"
                onError={() =>
                  setImgErrorMap((prev) => ({ ...prev, [currentTrack.id]: true }))
                }
                className="h-full w-full object-cover"
              />
            ) : (
              <div
                className="flex h-full w-full flex-col items-center justify-center p-2 text-center"
                style={{
                  background: `radial-gradient(circle at 30% 30%, ${currentTrack.accentHex}33, #0B0F17 75%)`,
                }}
              >
                <Disc3 className="h-7 w-7 text-cyan-300" aria-hidden="true" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="truncate font-display text-xl font-bold text-slate-50">
              {currentTrack.title}
            </h3>
            <p className="mt-0.5 truncate text-xs text-slate-400">
              {currentTrack.artist} · {currentTrack.genre}
            </p>
            <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-300">
              {currentTrack.description}
            </p>
          </div>
        </div>

        {/* Neon Spectrum Visualizer */}
        <div
          className="mt-5 flex h-12 items-end justify-between gap-1 rounded-lg bg-[#090D16] px-3 py-2 border border-white/8"
          aria-hidden="true"
        >
          {spectrumBars.map((val, idx) => (
            <div
              key={idx}
              className="w-full rounded-sm transition-transform duration-75"
              style={{
                height: '100%',
                transform: `scaleY(${Math.max(0.12, val)})`,
                transformOrigin: 'bottom',
                backgroundColor: currentTrack.accentHex,
                opacity: isPlaying ? 0.5 + val * 0.5 : 0.25,
              }}
            />
          ))}
        </div>

        {/* Progress Bar & Scrubber */}
        <div className="mt-5">
          <div className="relative flex items-center">
            <input
              type="range"
              aria-label="Thanh tiến trình bài hát"
              min={0}
              max={currentTrack.durationSec}
              value={Math.floor(elapsedSec)}
              onChange={(e) => onSeek(Number(e.target.value))}
              className="neon-range w-full"
              style={{
                background: `linear-gradient(to right, ${currentTrack.accentHex} ${progressPercent}%, rgba(255,255,255,0.12) ${progressPercent}%)`,
                height: '4px',
                borderRadius: '9999px',
              }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between font-mono text-xs text-slate-400 tabular-nums">
            <span>{formatTime(elapsedSec)}</span>
            <span>{formatTime(currentTrack.durationSec)}</span>
          </div>
        </div>

        {/* Primary Playback Controls */}
        <div className="mt-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onPrevTrack}
              aria-label="Bài trước"
              title="Bài trước"
              className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-200 transition-colors hover:bg-white/10 hover:text-cyan-300 focus-visible:outline-2 focus-visible:outline-cyan-400 cursor-pointer"
            >
              <SkipBack className="h-4 w-4" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={onTogglePlay}
              aria-label={isPlaying ? 'Tạm dừng nhạc' : 'Phát nhạc'}
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-cyan-400 px-5 text-sm font-semibold text-slate-950 shadow-[0_0_20px_rgba(0,240,255,0.28)] transition-all duration-150 hover:bg-cyan-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isPlaying ? (
                <>
                  <Pause className="h-4 w-4 fill-current" aria-hidden="true" />
                  <span>Tạm dừng</span>
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                  <span>Phát nhạc</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onNextTrack}
              aria-label="Bài tiếp theo"
              title="Bài tiếp theo"
              className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-200 transition-colors hover:bg-white/10 hover:text-cyan-300 focus-visible:outline-2 focus-visible:outline-cyan-400 cursor-pointer"
            >
              <SkipForward className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {/* Volume Control */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleMute}
              aria-label={isMuted ? 'Bỏ tắt tiếng nhạc' : 'Tắt tiếng nhạc'}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-white/8 hover:text-cyan-300 cursor-pointer"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="h-4 w-4 text-slate-500" aria-hidden="true" />
              ) : (
                <Volume2 className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
            <input
              type="range"
              aria-label="Âm lượng nhạc nền"
              min={0}
              max={1}
              step={0.02}
              value={isMuted ? 0 : volume}
              onChange={(e) => onVolumeChange(Number(e.target.value))}
              className="neon-range w-20"
              style={{
                background: `linear-gradient(to right, #00F0FF ${(isMuted ? 0 : volume) * 100}%, rgba(255,255,255,0.12) ${(isMuted ? 0 : volume) * 100}%)`,
                height: '4px',
                borderRadius: '9999px',
              }}
            />
          </div>
        </div>
      </div>

      {/* 3 AI-Generated Demo Tracks List */}
      <div className="border-t border-white/8 pt-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-200">
            Danh sách 3 bản nhạc demo AI
          </h3>
          <span className="text-xs text-slate-400 tabular-nums">3 bài</span>
        </div>

        <div className="flex flex-col gap-2">
          {tracks.map((track, idx) => {
            const active = idx === currentTrackIndex;
            return (
              <button
                key={track.id}
                type="button"
                onClick={() => onSelectTrack(idx)}
                className={`flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-cyan-400 cursor-pointer ${
                  active
                    ? 'border-cyan-400/45 bg-cyan-400/8'
                    : 'border-white/6 bg-[#090D16]/70 hover:border-white/15 hover:bg-white/5'
                }`}
              >
                <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-[#131926]">
                  {!imgErrorMap[track.id] ? (
                    <img
                      src={track.coverUrl}
                      alt={track.title}
                      referrerPolicy="no-referrer"
                      onError={() =>
                        setImgErrorMap((prev) => ({ ...prev, [track.id]: true }))
                      }
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div
                      className="flex h-full w-full items-center justify-center"
                      style={{ backgroundColor: `${track.accentHex}22` }}
                    >
                      <Disc3 className="h-5 w-5 text-cyan-300" aria-hidden="true" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`truncate text-sm font-semibold ${
                        active ? 'text-cyan-300' : 'text-slate-100'
                      }`}
                    >
                      0{idx + 1}. {track.title}
                    </span>
                    <span className="font-mono text-xs text-slate-400 tabular-nums shrink-0">
                      {formatTime(track.durationSec)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-400 tabular-nums">
                    {track.genre} · {track.bpm} BPM
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
};
