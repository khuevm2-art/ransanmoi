import { useCallback, useEffect, useRef, useState } from 'react';
import { synthEngine } from './audio/synthEngine';
import { Header } from './components/Header';
import { MusicPlayerPanel } from './components/MusicPlayerPanel';
import { SnakeArena } from './components/SnakeArena';
import { DEMO_TRACKS } from './data/tracks';

export default function App() {
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [volume, setVolume] = useState(0.65);
  const [isMuted, setIsMuted] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);

  // Track if user manually paused music so auto-start on first game respects user preference
  const userToggledMusicRef = useRef(false);

  const currentTrack = DEMO_TRACKS[currentTrackIndex];

  const playTrackAt = useCallback((index: number, resetTime = true) => {
    const safeIdx = ((index % DEMO_TRACKS.length) + DEMO_TRACKS.length) % DEMO_TRACKS.length;
    const track = DEMO_TRACKS[safeIdx];
    setCurrentTrackIndex(safeIdx);
    if (resetTime) {
      setElapsedSec(0);
    }
    setIsMusicPlaying(true);
    synthEngine.startTrack(track, resetTime);
  }, []);

  const handleTogglePlay = useCallback(() => {
    userToggledMusicRef.current = true;
    setIsMusicPlaying((prev) => {
      if (prev) {
        synthEngine.pause();
        return false;
      } else {
        synthEngine.startTrack(DEMO_TRACKS[currentTrackIndex], false);
        return true;
      }
    });
  }, [currentTrackIndex]);

  const handleNextTrack = useCallback(() => {
    userToggledMusicRef.current = true;
    playTrackAt(currentTrackIndex + 1, true);
  }, [currentTrackIndex, playTrackAt]);

  const handlePrevTrack = useCallback(() => {
    userToggledMusicRef.current = true;
    playTrackAt(currentTrackIndex - 1, true);
  }, [currentTrackIndex, playTrackAt]);

  const handleSelectTrack = useCallback(
    (index: number) => {
      userToggledMusicRef.current = true;
      if (index === currentTrackIndex && isMusicPlaying) {
        handleTogglePlay();
        return;
      }
      playTrackAt(index, true);
    },
    [currentTrackIndex, isMusicPlaying, handleTogglePlay, playTrackAt]
  );

  const handleSeek = useCallback((sec: number) => {
    setElapsedSec(sec);
  }, []);

  const handleVolumeChange = useCallback((vol: number) => {
    setVolume(vol);
    setIsMuted(vol === 0);
    synthEngine.setMuted(vol === 0);
    synthEngine.setVolume(vol);
  }, []);

  const handleToggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      synthEngine.setMuted(next);
      return next;
    });
  }, []);

  // Automatically start background music on first game start unless user manually paused
  const handleStartWithAudioPrompt = useCallback(() => {
    if (!userToggledMusicRef.current && !isMusicPlaying) {
      playTrackAt(currentTrackIndex, false);
    }
  }, [currentTrackIndex, isMusicPlaying, playTrackAt]);

  // Elapsed track timer + auto-advance to next track when current finishes
  useEffect(() => {
    if (!isMusicPlaying) return;
    const timer = window.setInterval(() => {
      setElapsedSec((prev) => {
        if (prev + 1 >= currentTrack.durationSec) {
          const nextIdx = (currentTrackIndex + 1) % DEMO_TRACKS.length;
          setCurrentTrackIndex(nextIdx);
          synthEngine.startTrack(DEMO_TRACKS[nextIdx], true);
          return 0;
        }
        return prev + 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isMusicPlaying, currentTrack.durationSec, currentTrackIndex]);

  // Global keyboard shortcuts for Music Player (M = play/pause, N = next track)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

      const lower = e.key.toLowerCase();
      if (lower === 'm') {
        e.preventDefault();
        handleTogglePlay();
      } else if (lower === 'n') {
        e.preventDefault();
        handleNextTrack();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleNextTrack, handleTogglePlay]);

  // Cleanup Web Audio on unmount
  useEffect(() => {
    return () => {
      synthEngine.stop();
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#07090E] text-slate-100 flex flex-col">
      <Header onNewGame={() => setResetSignal((n) => n + 1)} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-stretch">
          {/* Central Snake Game Window (Primary Focal Anchor) */}
          <div className="lg:col-span-7">
            <SnakeArena
              activeAccentHex={currentTrack.accentHex}
              isMusicPlaying={isMusicPlaying}
              externalResetSignal={resetSignal}
              onStartWithAudioPrompt={handleStartWithAudioPrompt}
            />
          </div>

          {/* Music Player & 3 AI Tracks Deck */}
          <div className="lg:col-span-5 flex flex-col">
            <MusicPlayerPanel
              tracks={DEMO_TRACKS}
              currentTrackIndex={currentTrackIndex}
              isPlaying={isMusicPlaying}
              elapsedSec={elapsedSec}
              volume={volume}
              isMuted={isMuted}
              onTogglePlay={handleTogglePlay}
              onPrevTrack={handlePrevTrack}
              onNextTrack={handleNextTrack}
              onSelectTrack={handleSelectTrack}
              onSeek={handleSeek}
              onVolumeChange={handleVolumeChange}
              onToggleMute={handleToggleMute}
            />
          </div>
        </div>

        {/* Clean Keyboard Shortcuts Strip */}
        <section
          id="controls"
          aria-label="Hướng dẫn phím tắt"
          className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/8 bg-[#0E121B]/70 px-5 py-3.5 text-xs text-slate-400"
        >
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <span>
              <strong className="font-mono text-slate-200">↑ ↓ ← →</strong> hoặc{' '}
              <strong className="font-mono text-slate-200">W A S D</strong> · Điều hướng rắn
            </span>
            <span>
              <strong className="font-mono text-slate-200">Space</strong> · Tạm dừng hoặc tiếp tục
            </span>
            <span>
              <strong className="font-mono text-slate-200">M</strong> · Phát / tạm dừng nhạc
            </span>
            <span>
              <strong className="font-mono text-slate-200">N</strong> · Chuyển bài tiếp theo
            </span>
          </div>
          <span className="text-slate-500">Kỷ lục điểm được lưu tự động trên trình duyệt</span>
        </section>
      </main>
    </div>
  );
}
