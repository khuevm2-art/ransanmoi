import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { synthEngine } from '../audio/synthEngine';
import { Difficulty, Direction, GameState, GridPoint, Particle } from '../types/app';

interface SnakeArenaProps {
  activeAccentHex: string;
  isMusicPlaying: boolean;
  externalResetSignal: number;
  onStartWithAudioPrompt: () => void;
}

const GRID_SIZE = 20;
const HIGH_SCORE_KEY = 'neonsnake_high_score_v1';

const INITIAL_SNAKE: GridPoint[] = [
  { x: 10, y: 10 },
  { x: 9, y: 10 },
  { x: 8, y: 10 },
];

const DIFFICULTY_CONFIG: Record<Difficulty, { label: string; baseMs: number; minMs: number }> = {
  slow: { label: 'Chậm', baseMs: 165, minMs: 95 },
  normal: { label: 'Vừa', baseMs: 125, minMs: 70 },
  fast: { label: 'Nhanh', baseMs: 92, minMs: 52 },
};

function isOpposite(a: Direction, b: Direction): boolean {
  return (
    (a === 'UP' && b === 'DOWN') ||
    (a === 'DOWN' && b === 'UP') ||
    (a === 'LEFT' && b === 'RIGHT') ||
    (a === 'RIGHT' && b === 'LEFT')
  );
}

function getRandomFreeCell(occupied: GridPoint[]): GridPoint {
  const occupiedSet = new Set(occupied.map((p) => `${p.x},${p.y}`));
  const free: GridPoint[] = [];
  for (let x = 0; x < GRID_SIZE; x++) {
    for (let y = 0; y < GRID_SIZE; y++) {
      if (!occupiedSet.has(`${x},${y}`)) {
        free.push({ x, y });
      }
    }
  }
  if (free.length === 0) return { x: 0, y: 0 };
  return free[Math.floor(Math.random() * free.length)];
}

export const SnakeArena: React.FC<SnakeArenaProps> = ({
  activeAccentHex,
  isMusicPlaying,
  externalResetSignal,
  onStartWithAudioPrompt,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [gameState, setGameState] = useState<GameState>('TITLE_MENU');
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [score, setScore] = useState(0);
  const [applesEaten, setApplesEaten] = useState(0);
  const [snakeLength, setSnakeLength] = useState(INITIAL_SNAKE.length);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [sfxEnabled, setSfxEnabled] = useState(true);
  const [highScore, setHighScore] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(HIGH_SCORE_KEY);
      return saved ? parseInt(saved, 10) || 0 : 0;
    } catch {
      return 0;
    }
  });

  // Mutable simulation refs for crisp 60fps render loop + deterministic step ticks
  const gameStateRef = useRef<GameState>('TITLE_MENU');
  const snakeRef = useRef<GridPoint[]>([...INITIAL_SNAKE]);
  const dirRef = useRef<Direction>('RIGHT');
  const inputQueueRef = useRef<Direction[]>([]);
  const foodRef = useRef<GridPoint>({ x: 15, y: 10 });
  const bonusFoodRef = useRef<{ pos: GridPoint; expiresAt: number } | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const scoreRef = useRef(0);
  const applesRef = useRef(0);
  const highScoreRef = useRef(highScore);
  const difficultyRef = useRef<Difficulty>('normal');
  const lastStepTimeRef = useRef<number>(0);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    difficultyRef.current = difficulty;
  }, [difficulty]);

  useEffect(() => {
    highScoreRef.current = highScore;
  }, [highScore]);

  const toggleSfx = useCallback(() => {
    setSfxEnabled((prev) => {
      const next = !prev;
      synthEngine.setSfxEnabled(next);
      return next;
    });
  }, []);

  const spawnParticles = useCallback((cell: GridPoint, color: string, count = 12) => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const speed = 1.1 + Math.random() * 2.2;
      particlesRef.current.push({
        x: cell.x + 0.5,
        y: cell.y + 0.5,
        vx: Math.cos(angle) * speed * 0.08,
        vy: Math.sin(angle) * speed * 0.08,
        life: 1,
        maxLife: 1,
        color,
        size: 2 + Math.random() * 2.5,
      });
    }
  }, []);

  const startNewGame = useCallback(() => {
    const startSnake = INITIAL_SNAKE.map((p) => ({ ...p }));
    snakeRef.current = startSnake;
    dirRef.current = 'RIGHT';
    inputQueueRef.current = [];
    foodRef.current = getRandomFreeCell(startSnake);
    bonusFoodRef.current = null;
    particlesRef.current = [];
    scoreRef.current = 0;
    applesRef.current = 0;
    lastStepTimeRef.current = performance.now();

    setScore(0);
    setApplesEaten(0);
    setSnakeLength(startSnake.length);
    setIsNewRecord(false);
    setGameState('PLAYING');
    gameStateRef.current = 'PLAYING';
    onStartWithAudioPrompt();
  }, [onStartWithAudioPrompt]);

  // Listen to header "Ván mới" button
  useEffect(() => {
    if (externalResetSignal > 0) {
      startNewGame();
    }
  }, [externalResetSignal, startNewGame]);

  const togglePause = useCallback(() => {
    if (gameStateRef.current === 'PLAYING') {
      setGameState('PAUSED');
      gameStateRef.current = 'PAUSED';
    } else if (gameStateRef.current === 'PAUSED') {
      lastStepTimeRef.current = performance.now();
      setGameState('PLAYING');
      gameStateRef.current = 'PLAYING';
    }
  }, []);

  const queueDirection = useCallback((nextDir: Direction) => {
    if (gameStateRef.current !== 'PLAYING') return;
    const queue = inputQueueRef.current;
    const lastPlannedDir = queue.length > 0 ? queue[queue.length - 1] : dirRef.current;
    if (nextDir !== lastPlannedDir && !isOpposite(nextDir, lastPlannedDir) && queue.length < 3) {
      queue.push(nextDir);
    }
  }, []);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

      const key = e.key;
      const lower = key.toLowerCase();

      if (key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight' || key === ' ') {
        e.preventDefault();
      }

      if (key === 'ArrowUp' || lower === 'w') {
        queueDirection('UP');
      } else if (key === 'ArrowDown' || lower === 's') {
        queueDirection('DOWN');
      } else if (key === 'ArrowLeft' || lower === 'a') {
        queueDirection('LEFT');
      } else if (key === 'ArrowRight' || lower === 'd') {
        queueDirection('RIGHT');
      } else if (key === ' ' || lower === 'p') {
        if (gameStateRef.current === 'PLAYING' || gameStateRef.current === 'PAUSED') {
          togglePause();
        } else if (gameStateRef.current === 'TITLE_MENU' || gameStateRef.current === 'GAME_OVER') {
          startNewGame();
        }
      } else if (key === 'Enter') {
        if (gameStateRef.current === 'TITLE_MENU' || gameStateRef.current === 'GAME_OVER') {
          startNewGame();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [queueDirection, startNewGame, togglePause]);

  // Main Game Loop (60fps render + dynamic tick interval)
  useEffect(() => {
    let animationFrameId = 0;

    const getTickIntervalMs = () => {
      const cfg = DIFFICULTY_CONFIG[difficultyRef.current];
      const speedReduction = Math.min(cfg.baseMs - cfg.minMs, applesRef.current * 1.8);
      return cfg.baseMs - speedReduction;
    };

    const stepSimulation = (now: number) => {
      const snake = snakeRef.current;

      if (inputQueueRef.current.length > 0) {
        const next = inputQueueRef.current.shift()!;
        if (!isOpposite(next, dirRef.current)) {
          dirRef.current = next;
        }
      }

      const head = snake[0];
      const nextHead: GridPoint = { x: head.x, y: head.y };
      if (dirRef.current === 'UP') nextHead.y -= 1;
      else if (dirRef.current === 'DOWN') nextHead.y += 1;
      else if (dirRef.current === 'LEFT') nextHead.x -= 1;
      else if (dirRef.current === 'RIGHT') nextHead.x += 1;

      // Wall collision
      if (
        nextHead.x < 0 ||
        nextHead.x >= GRID_SIZE ||
        nextHead.y < 0 ||
        nextHead.y >= GRID_SIZE
      ) {
        triggerGameOver();
        return;
      }

      const willEatFood =
        nextHead.x === foodRef.current.x && nextHead.y === foodRef.current.y;
      const willEatBonus =
        bonusFoodRef.current !== null &&
        nextHead.x === bonusFoodRef.current.pos.x &&
        nextHead.y === bonusFoodRef.current.pos.y;

      // Self collision (ignore tail tip if not growing)
      const bodyToCheck = willEatFood || willEatBonus ? snake : snake.slice(0, -1);
      if (bodyToCheck.some((seg) => seg.x === nextHead.x && seg.y === nextHead.y)) {
        triggerGameOver();
        return;
      }

      const nextSnake = [nextHead, ...snake];
      if (!willEatFood && !willEatBonus) {
        nextSnake.pop();
      }
      snakeRef.current = nextSnake;
      setSnakeLength(nextSnake.length);

      if (willEatFood) {
        applesRef.current += 1;
        scoreRef.current += 10;
        setApplesEaten(applesRef.current);
        setScore(scoreRef.current);
        spawnParticles(foodRef.current, '#FF2A85', 14);
        synthEngine.playEatSfx(false);

        const occupied = [...nextSnake];
        if (bonusFoodRef.current) occupied.push(bonusFoodRef.current.pos);
        foodRef.current = getRandomFreeCell(occupied);

        // Spawn bonus orb every 5 apples
        if (applesRef.current % 5 === 0 && !bonusFoodRef.current) {
          const bonusPos = getRandomFreeCell([...nextSnake, foodRef.current]);
          bonusFoodRef.current = {
            pos: bonusPos,
            expiresAt: now + 7500,
          };
        }

        if (scoreRef.current > highScoreRef.current) {
          highScoreRef.current = scoreRef.current;
          setHighScore(scoreRef.current);
          setIsNewRecord(true);
          try {
            localStorage.setItem(HIGH_SCORE_KEY, String(scoreRef.current));
          } catch {
            // ignore storage errors
          }
        }
      }

      if (willEatBonus && bonusFoodRef.current) {
        scoreRef.current += 25;
        setScore(scoreRef.current);
        spawnParticles(bonusFoodRef.current.pos, '#FFB800', 18);
        synthEngine.playEatSfx(true);
        bonusFoodRef.current = null;

        if (scoreRef.current > highScoreRef.current) {
          highScoreRef.current = scoreRef.current;
          setHighScore(scoreRef.current);
          setIsNewRecord(true);
          try {
            localStorage.setItem(HIGH_SCORE_KEY, String(scoreRef.current));
          } catch {
            // ignore storage errors
          }
        }
      }

      if (bonusFoodRef.current && now > bonusFoodRef.current.expiresAt) {
        bonusFoodRef.current = null;
      }
    };

    const triggerGameOver = () => {
      synthEngine.playGameOverSfx();
      spawnParticles(snakeRef.current[0], '#00F0FF', 20);
      setGameState('GAME_OVER');
      gameStateRef.current = 'GAME_OVER';
    };

    const drawCanvas = (now: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const targetWidth = Math.round(rect.width * dpr);
      const targetHeight = Math.round(rect.height * dpr);

      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
      }

      const w = rect.width;
      const h = rect.height;
      if (w === 0 || h === 0) return;

      ctx.save();
      ctx.scale(dpr, dpr);

      // Deep dark arena backdrop
      ctx.fillStyle = '#090D16';
      ctx.fillRect(0, 0, w, h);

      const cellW = w / GRID_SIZE;
      const cellH = h / GRID_SIZE;

      // Subtle neon grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 1; i < GRID_SIZE; i++) {
        const x = Math.round(i * cellW) + 0.5;
        const y = Math.round(i * cellH) + 0.5;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
      }
      ctx.stroke();

      // Update & draw particles
      if (particlesRef.current.length > 0) {
        const nextParticles: Particle[] = [];
        for (const p of particlesRef.current) {
          p.x += p.vx;
          p.y += p.vy;
          p.life -= 0.035;
          if (p.life > 0) {
            nextParticles.push(p);
            ctx.save();
            ctx.globalAlpha = Math.max(0, p.life);
            ctx.fillStyle = p.color;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(p.x * cellW, p.y * cellH, p.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        }
        particlesRef.current = nextParticles;
      }

      // Draw regular neon food
      const food = foodRef.current;
      const pulse = 0.88 + 0.12 * Math.sin(now * 0.006);
      const fx = (food.x + 0.5) * cellW;
      const fy = (food.y + 0.5) * cellH;
      const foodRadius = Math.min(cellW, cellH) * 0.34 * pulse;

      ctx.save();
      ctx.shadowColor = '#FF2A85';
      ctx.shadowBlur = 16;
      ctx.fillStyle = '#FF2A85';
      ctx.beginPath();
      ctx.arc(fx, fy, foodRadius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FFE4F0';
      ctx.beginPath();
      ctx.arc(fx - foodRadius * 0.25, fy - foodRadius * 0.25, foodRadius * 0.28, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Draw bonus golden orb if active
      if (bonusFoodRef.current) {
        const b = bonusFoodRef.current.pos;
        const bx = (b.x + 0.5) * cellW;
        const by = (b.y + 0.5) * cellH;
        const bPulse = 0.86 + 0.16 * Math.sin(now * 0.01);
        const bRadius = Math.min(cellW, cellH) * 0.38 * bPulse;

        ctx.save();
        ctx.shadowColor = '#FFB800';
        ctx.shadowBlur = 18;
        ctx.fillStyle = '#FFB800';
        ctx.beginPath();
        ctx.moveTo(bx, by - bRadius);
        ctx.lineTo(bx + bRadius, by);
        ctx.lineTo(bx, by + bRadius);
        ctx.lineTo(bx - bRadius, by);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // Draw neon snake segments (tail to head)
      const snake = snakeRef.current;
      for (let i = snake.length - 1; i >= 0; i--) {
        const seg = snake[i];
        const isHead = i === 0;
        const ratio = snake.length > 1 ? i / (snake.length - 1) : 0;

        // Smooth cyan (#00F0FF) -> emerald (#00FFA3) gradient along body
        const r = Math.round(0);
        const g = Math.round(240 + ratio * 15);
        const b = Math.round(255 - ratio * 92);
        const fill = isHead ? '#33F5FF' : `rgb(${r}, ${g}, ${b})`;

        const pad = isHead ? cellW * 0.08 : cellW * (0.11 + ratio * 0.05);
        const sx = seg.x * cellW + pad;
        const sy = seg.y * cellH + pad;
        const sw = cellW - pad * 2;
        const sh = cellH - pad * 2;
        const rad = Math.min(sw, sh) * (isHead ? 0.32 : 0.26);

        ctx.save();
        ctx.fillStyle = fill;
        if (isHead) {
          ctx.shadowColor = '#00F0FF';
          ctx.shadowBlur = 14;
        } else if (i < 4) {
          ctx.shadowColor = 'rgba(0, 240, 255, 0.35)';
          ctx.shadowBlur = 8;
        }

        ctx.beginPath();
        ctx.roundRect(sx, sy, sw, sh, rad);
        ctx.fill();

        // Draw crisp eyes on snake head
        if (isHead) {
          ctx.shadowBlur = 0;
          ctx.fillStyle = '#07090E';
          const eyeSize = Math.max(1.8, sw * 0.14);
          let ex1 = sx + sw * 0.68;
          let ey1 = sy + sh * 0.28;
          let ex2 = sx + sw * 0.68;
          let ey2 = sy + sh * 0.72;

          if (dirRef.current === 'LEFT') {
            ex1 = sx + sw * 0.32;
            ex2 = sx + sw * 0.32;
          } else if (dirRef.current === 'UP') {
            ex1 = sx + sw * 0.28;
            ey1 = sy + sh * 0.32;
            ex2 = sx + sw * 0.72;
            ey2 = sy + sh * 0.32;
          } else if (dirRef.current === 'DOWN') {
            ex1 = sx + sw * 0.28;
            ey1 = sy + sh * 0.68;
            ex2 = sx + sw * 0.72;
            ey2 = sy + sh * 0.68;
          }

          ctx.beginPath();
          ctx.arc(ex1, ey1, eyeSize, 0, Math.PI * 2);
          ctx.arc(ex2, ey2, eyeSize, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }

      ctx.restore();
    };

    const loop = (now: number) => {
      if (gameStateRef.current === 'PLAYING') {
        const interval = getTickIntervalMs();
        if (now - lastStepTimeRef.current >= interval) {
          lastStepTimeRef.current = now;
          stepSimulation(now);
        }
      }
      drawCanvas(now);
      animationFrameId = window.requestAnimationFrame(loop);
    };

    animationFrameId = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(animationFrameId);
  }, [spawnParticles]);

  const speedLevel = Math.min(10, 1 + Math.floor(applesEaten / 4));

  return (
    <section
      id="arena"
      aria-label="Cửa sổ trò chơi Rắn"
      className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-[#0E121B] p-4 sm:p-6"
    >
      {/* Top Score Counter & Game HUD */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/8 pb-4">
        <div className="flex flex-wrap items-baseline gap-6 sm:gap-8">
          <div>
            <p className="text-xs font-medium text-slate-400">Điểm hiện tại</p>
            <p className="font-mono text-3xl font-bold tracking-tight text-cyan-300 tabular-nums">
              {score}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400">Kỷ lục</p>
            <p className="font-mono text-2xl font-semibold tracking-tight text-emerald-300 tabular-nums">
              {highScore}
            </p>
          </div>
          <div className="hidden sm:block">
            <p className="text-xs font-medium text-slate-400">Độ dài · Cấp</p>
            <p className="font-mono text-base font-medium text-slate-200 tabular-nums">
              {snakeLength} đốt · Cấp {speedLevel}
            </p>
          </div>
        </div>

        {/* Game Action Controls */}
        <div className="flex items-center gap-2">
          {(gameState === 'PLAYING' || gameState === 'PAUSED') && (
            <button
              type="button"
              onClick={togglePause}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-white/12 bg-white/5 px-3.5 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-cyan-400 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {gameState === 'PLAYING' ? (
                <>
                  <Pause className="h-4 w-4 text-cyan-300" aria-hidden="true" />
                  <span>Tạm dừng</span>
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 text-cyan-300" aria-hidden="true" />
                  <span>Tiếp tục</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={startNewGame}
            aria-label="Chơi lại từ đầu"
            className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-white/12 bg-white/5 px-3.5 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-cyan-400 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RotateCcw className="h-4 w-4 text-slate-300" aria-hidden="true" />
            <span>Chơi lại</span>
          </button>

          <button
            type="button"
            onClick={toggleSfx}
            aria-label={sfxEnabled ? 'Tắt âm thanh hiệu ứng' : 'Bật âm thanh hiệu ứng'}
            title={sfxEnabled ? 'Tắt âm thanh hiệu ứng' : 'Bật âm thanh hiệu ứng'}
            className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg border border-white/12 bg-white/5 text-slate-300 transition-colors hover:bg-white/10 hover:text-cyan-300 focus-visible:outline-2 focus-visible:outline-cyan-400 shrink-0 cursor-pointer"
          >
            {sfxEnabled ? (
              <Volume2 className="h-4 w-4 text-cyan-300" aria-hidden="true" />
            ) : (
              <VolumeX className="h-4 w-4 text-slate-500" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Central Snake Game Window */}
      <div className="relative mx-auto w-full max-w-[540px]">
        <div
          className="relative aspect-square w-full overflow-hidden rounded-xl border border-white/12 bg-[#090D16] transition-shadow duration-300"
          style={{
            boxShadow: isMusicPlaying
              ? `0 0 36px -8px ${activeAccentHex}40, inset 0 0 24px rgba(0, 240, 255, 0.05)`
              : '0 0 28px -12px rgba(0, 240, 255, 0.2)',
          }}
        >
          <canvas ref={canvasRef} className="block h-full w-full" />

          {/* Title Menu Overlay */}
          {gameState === 'TITLE_MENU' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#07090E]/82 p-6 text-center backdrop-blur-sm">
              <h1 className="font-display text-3xl font-bold tracking-tight text-slate-50 sm:text-4xl text-balance">
                Rắn Săn Mồi Neon
              </h1>
              <p className="mt-2.5 max-w-sm text-sm leading-relaxed text-slate-300">
                Điều khiển rắn ăn mồi hồng để ghi điểm và tránh đâm vào tường hoặc thân rắn. Nhạc nền AI sẽ đồng hành trong suốt màn chơi.
              </p>

              {/* Difficulty Segmented Control */}
              <div className="mt-6 flex flex-col items-center gap-2">
                <span className="text-xs font-medium text-slate-400">Chọn tốc độ khởi đầu</span>
                <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-[#0E121B] p-1">
                  {(['slow', 'normal', 'fast'] as Difficulty[]).map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setDifficulty(level)}
                      className={`min-h-[36px] rounded-md px-4 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        difficulty === level
                          ? 'bg-cyan-400 text-slate-950'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      {DIFFICULTY_CONFIG[level].label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={startNewGame}
                className="mt-6 inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-cyan-400 px-6 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_0_24px_rgba(0,240,255,0.35)] transition-all duration-150 hover:bg-cyan-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                <span>Bắt đầu chơi</span>
              </button>
            </div>
          )}

          {/* Paused Overlay */}
          {gameState === 'PAUSED' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#07090E]/78 p-6 text-center backdrop-blur-sm">
              <h2 className="font-display text-2xl font-bold text-slate-50">Đang tạm dừng</h2>
              <p className="mt-1.5 text-sm text-slate-300">
                Nhấn phím Space hoặc nút bên dưới để tiếp tục.
              </p>
              <div className="mt-5 flex items-center gap-3">
                <button
                  type="button"
                  onClick={togglePause}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-cyan-400 px-5 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-300 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                  <span>Tiếp tục</span>
                </button>
                <button
                  type="button"
                  onClick={startNewGame}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold text-slate-100 transition-colors hover:bg-white/10 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  <span>Chơi lại</span>
                </button>
              </div>
            </div>
          )}

          {/* Game Over Overlay */}
          {gameState === 'GAME_OVER' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#07090E]/85 p-6 text-center backdrop-blur-sm">
              <h2 className="font-display text-3xl font-bold text-slate-50">Trò chơi kết thúc</h2>
              {isNewRecord && (
                <p className="mt-2 text-sm font-semibold text-emerald-300">
                  Chúc mừng! Bạn vừa lập kỷ lục mới
                </p>
              )}

              <div className="mt-4 flex items-center gap-6 text-sm text-slate-300">
                <div>
                  <span className="text-slate-400">Điểm đạt được: </span>
                  <span className="font-mono text-lg font-bold text-cyan-300 tabular-nums">{score}</span>
                </div>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <div>
                  <span className="text-slate-400">Mồi đã ăn: </span>
                  <span className="font-mono text-lg font-bold text-pink-400 tabular-nums">{applesEaten}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={startNewGame}
                className="mt-6 inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-cyan-400 px-6 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_0_24px_rgba(0,240,255,0.35)] transition-all duration-150 hover:bg-cyan-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                <span>Chơi lại</span>
              </button>
            </div>
          )}
        </div>

        {/* Touch D-Pad for mobile / tablet screens */}
        <div className="mt-4 flex flex-col items-center gap-2 md:hidden" aria-label="Phím điều hướng cảm ứng">
          <button
            type="button"
            onClick={() => queueDirection('UP')}
            aria-label="Đi lên"
            className="flex h-12 w-12 items-center justify-center rounded-lg border border-white/12 bg-[#131926] text-slate-100 active:bg-cyan-400/20"
          >
            <ArrowUp className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => queueDirection('LEFT')}
              aria-label="Sang trái"
              className="flex h-12 w-12 items-center justify-center rounded-lg border border-white/12 bg-[#131926] text-slate-100 active:bg-cyan-400/20"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => queueDirection('DOWN')}
              aria-label="Đi xuống"
              className="flex h-12 w-12 items-center justify-center rounded-lg border border-white/12 bg-[#131926] text-slate-100 active:bg-cyan-400/20"
            >
              <ArrowDown className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => queueDirection('RIGHT')}
              aria-label="Sang phải"
              className="flex h-12 w-12 items-center justify-center rounded-lg border border-white/12 bg-[#131926] text-slate-100 active:bg-cyan-400/20"
            >
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom concise rules & stats strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-slate-400">
        <span>Mồi hồng +10 điểm · Ngọc vàng +25 điểm</span>
        <span>Hỗ trợ phím mũi tên hoặc W A S D</span>
      </div>
    </section>
  );
};
