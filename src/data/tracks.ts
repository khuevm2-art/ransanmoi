import { DemoTrack } from '../types/app';

// MIDI note helper constants for clear musical composition
// A minor / C major / F major / E minor progressions
export const DEMO_TRACKS: DemoTrack[] = [
  {
    id: 'ai-synthwave-night',
    title: 'Nhịp Điệu Đêm',
    artist: 'AI Studio Synth · Bản 01',
    genre: 'AI Synthwave',
    description: 'Âm bass analog dồn dập kết hợp hợp âm hoài niệm trên lưới neon.',
    bpm: 118,
    durationSec: 160,
    coverUrl: '/src/assets/images/track_cover_synthwave_1794904072787.jpg',
    accentHex: '#00F0FF',
    style: 'synthwave',
    // Am - F - C - G (4 bars, 1 chord per bar of 16 sixteenth-steps)
    chords: [
      [57, 60, 64, 67], // Am7
      [53, 57, 60, 64], // Fmaj7
      [48, 55, 60, 64], // C
      [55, 59, 62, 67], // G
    ],
    // Driving 16-step synthwave bass pattern (offsets from chord root - 24 semitones)
    bassPattern: [
      0, 0, 12, 0, 0, 0, 12, 0,
      0, 0, 12, 0, 0, 7, 12, 7,
    ],
    // Shimmering 16-step arpeggio (indices into current chord)
    arpPattern: [
      0, 1, 2, 3, 2, 1, 2, 3,
      0, 2, 1, 3, 2, 3, 1, 2,
    ],
    kickSteps: [0, 4, 8, 12],
    snareSteps: [4, 12],
    hatSteps: [2, 6, 10, 14, 15],
  },
  {
    id: 'ai-lofi-rain',
    title: 'Mưa Thành Phố',
    artist: 'AI Studio Lo-Fi · Bản 02',
    genre: 'AI Lo-Fi Chill',
    description: 'Tiếng phím điện ấm áp cùng nhịp trống chậm rãi cho những màn chơi thư giãn.',
    bpm: 86,
    durationSec: 188,
    coverUrl: '/src/assets/images/track_cover_lofi_1794904073740.jpg',
    accentHex: '#FF2A85',
    style: 'lofi',
    // Fmaj7 - Em7 - Dm9 - Cmaj7
    chords: [
      [53, 57, 60, 64], // Fmaj7
      [52, 55, 59, 62], // Em7
      [50, 53, 57, 60], // Dm7
      [48, 52, 55, 59], // Cmaj7
    ],
    bassPattern: [
      0, null, null, null, null, null, 7, null,
      0, null, null, null, null, 5, null, null,
    ],
    arpPattern: [
      null, null, 2, null, 3, null, null, 1,
      null, 2, null, 3, null, null, 1, null,
    ],
    kickSteps: [0, 7, 10],
    snareSteps: [4, 12],
    hatSteps: [0, 2, 4, 6, 8, 10, 12, 14],
  },
  {
    id: 'ai-electro-prism',
    title: 'Lăng Kính Số',
    artist: 'AI Studio Electro · Bản 03',
    genre: 'AI Electro Arcade',
    description: 'Giai điệu điện tử tốc độ cao tiếp năng lượng cho những pha bứt phá kỷ lục.',
    bpm: 132,
    durationSec: 144,
    coverUrl: '/src/assets/images/track_cover_electro_1794904073312.jpg',
    accentHex: '#00FFA3',
    style: 'electro',
    // Em - C - D - Bm
    chords: [
      [52, 55, 59, 64], // Em
      [48, 52, 55, 60], // C
      [50, 54, 57, 62], // D
      [47, 50, 54, 59], // Bm
    ],
    bassPattern: [
      0, 12, 0, 12, 0, 12, 7, 12,
      0, 12, 0, 12, 3, 12, 7, 10,
    ],
    arpPattern: [
      0, 2, 3, 2, 1, 2, 3, 0,
      1, 3, 2, 3, 0, 2, 3, 1,
    ],
    kickSteps: [0, 4, 8, 12, 14],
    snareSteps: [4, 12],
    hatSteps: [1, 2, 3, 5, 6, 7, 9, 10, 11, 13, 15],
  },
];
