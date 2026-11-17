export type GameState = 'TITLE_MENU' | 'PLAYING' | 'PAUSED' | 'GAME_OVER';

export type Difficulty = 'slow' | 'normal' | 'fast';

export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

export interface GridPoint {
  x: number;
  y: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export type TrackStyle = 'synthwave' | 'lofi' | 'electro';

export interface DemoTrack {
  id: string;
  title: string;
  artist: string;
  genre: string;
  description: string;
  bpm: number;
  durationSec: number;
  coverUrl: string;
  accentHex: string;
  style: TrackStyle;
  chords: number[][];
  bassPattern: (number | null)[];
  arpPattern: (number | null)[];
  kickSteps: number[];
  snareSteps: number[];
  hatSteps: number[];
}
