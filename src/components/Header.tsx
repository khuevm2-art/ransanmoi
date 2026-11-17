import React from 'react';

interface HeaderProps {
  onNewGame: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onNewGame }) => {
  return (
    <header className="w-full border-b border-white/10 bg-[#07090E]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-8 px-4 py-3.5 sm:px-6">
        <a
          href="#arena"
          className="font-display text-xl font-bold tracking-tight text-slate-50 whitespace-nowrap shrink-0"
        >
          NeonSnake <span className="text-cyan-400">&amp; Beats</span>
        </a>

        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-400">
          <a
            href="#arena"
            className="hover:text-cyan-300 hover:underline underline-offset-8 decoration-cyan-400/60 transition-colors whitespace-nowrap shrink-0"
          >
            Trò chơi
          </a>
          <a
            href="#player"
            className="hover:text-cyan-300 hover:underline underline-offset-8 decoration-cyan-400/60 transition-colors whitespace-nowrap shrink-0"
          >
            Trình phát nhạc
          </a>
          <a
            href="#controls"
            className="hover:text-cyan-300 hover:underline underline-offset-8 decoration-cyan-400/60 transition-colors whitespace-nowrap shrink-0"
          >
            Phím tắt
          </a>
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onNewGame}
            className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 shadow-[0_0_20px_rgba(0,240,255,0.28)] transition-all duration-150 hover:bg-cyan-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Ván mới
          </button>
        </div>
      </div>
    </header>
  );
};
