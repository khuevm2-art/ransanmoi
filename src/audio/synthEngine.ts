import { DemoTrack } from '../types/app';

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

class NeonSynthEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private isPlaying = false;
  private currentTrack: DemoTrack | null = null;
  private volume = 0.65;
  private isMuted = false;
  private sfxEnabled = true;

  private stepIndex = 0;
  private barIndex = 0;
  private nextStepTime = 0;
  private schedulerId: number | null = null;
  private freqData: Uint8Array<ArrayBuffer> = new Uint8Array(new ArrayBuffer(32));

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;

    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;

      this.ctx = new AudioCtx();

      const compressor = this.ctx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-14, this.ctx.currentTime);
      compressor.knee.setValueAtTime(18, this.ctx.currentTime);
      compressor.ratio.setValueAtTime(6, this.ctx.currentTime);
      compressor.attack.setValueAtTime(0.005, this.ctx.currentTime);
      compressor.release.setValueAtTime(0.15, this.ctx.currentTime);

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.setValueAtTime(0.75, this.ctx.currentTime);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(0.65, this.ctx.currentTime);

      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 64;
      this.analyser.smoothingTimeConstant = 0.78;
      this.freqData = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));

      this.musicGain.connect(compressor);
      this.sfxGain.connect(compressor);
      compressor.connect(this.masterGain);
      this.masterGain.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);

      this.noiseBuffer = this.createNoiseBuffer(this.ctx);
    }

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }

    return this.ctx;
  }

  private createNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const bufferSize = ctx.sampleRate * 0.5;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.ctx && this.masterGain) {
      const target = this.isMuted ? 0 : this.volume;
      this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.03);
    }
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (this.ctx && this.masterGain) {
      const target = this.isMuted ? 0 : this.volume;
      this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.03);
    }
  }

  public setSfxEnabled(enabled: boolean): void {
    this.sfxEnabled = enabled;
  }

  public startTrack(track: DemoTrack, resetPattern = true): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    this.currentTrack = track;
    if (resetPattern) {
      this.stepIndex = 0;
      this.barIndex = 0;
    }

    this.isPlaying = true;
    this.nextStepTime = ctx.currentTime + 0.04;

    if (this.schedulerId !== null) {
      window.clearInterval(this.schedulerId);
    }

    this.schedulerId = window.setInterval(() => {
      this.scheduleLookahead();
    }, 25);
  }

  public pause(): void {
    this.isPlaying = false;
    if (this.schedulerId !== null) {
      window.clearInterval(this.schedulerId);
      this.schedulerId = null;
    }
  }

  public stop(): void {
    this.pause();
    this.stepIndex = 0;
    this.barIndex = 0;
  }

  public getFrequencyBins(count = 20): number[] {
    if (!this.analyser || !this.isPlaying) {
      return new Array(count).fill(0.08);
    }
    this.analyser.getByteFrequencyData(this.freqData);
    const result: number[] = [];
    const usableBins = Math.min(count, this.freqData.length);
    for (let i = 0; i < count; i++) {
      const idx = Math.floor((i / count) * usableBins);
      const normalized = this.freqData[idx] / 255;
      result.push(Math.max(0.08, normalized));
    }
    return result;
  }

  private scheduleLookahead(): void {
    if (!this.ctx || !this.isPlaying || !this.currentTrack) return;

    const lookaheadSec = 0.12;
    const stepDuration = 60 / this.currentTrack.bpm / 4; // 16th note

    while (this.nextStepTime < this.ctx.currentTime + lookaheadSec) {
      this.triggerStep(this.currentTrack, this.stepIndex, this.barIndex, this.nextStepTime, stepDuration);
      this.nextStepTime += stepDuration;
      this.stepIndex = (this.stepIndex + 1) % 16;
      if (this.stepIndex === 0) {
        this.barIndex = (this.barIndex + 1) % this.currentTrack.chords.length;
      }
    }
  }

  private triggerStep(
    track: DemoTrack,
    step: number,
    bar: number,
    time: number,
    stepDur: number
  ): void {
    if (!this.ctx || !this.musicGain) return;

    const chord = track.chords[bar % track.chords.length];
    const rootMidi = chord[0];

    // 1. Warm Pad Chord on beat 1 of each bar
    if (step === 0) {
      this.playChordPad(chord, time, stepDur * 15.5, track.style);
    }

    // 2. Bassline
    const bassOffset = track.bassPattern[step];
    if (bassOffset !== null && bassOffset !== undefined) {
      const bassMidi = rootMidi - 24 + bassOffset;
      this.playBass(bassMidi, time, stepDur * (track.style === 'lofi' ? 2.4 : 0.85), track.style);
    }

    // 3. Lead / Arpeggio
    const arpIdx = track.arpPattern[step];
    if (arpIdx !== null && arpIdx !== undefined) {
      const noteMidi = chord[arpIdx % chord.length] + (track.style === 'electro' ? 12 : 0);
      this.playArp(noteMidi, time, stepDur * (track.style === 'lofi' ? 1.8 : 0.75), track.style);
    }

    // 4. Drums
    if (track.kickSteps.includes(step)) {
      this.playKick(time, track.style);
    }
    if (track.snareSteps.includes(step)) {
      this.playSnare(time, track.style);
    }
    if (track.hatSteps.includes(step)) {
      this.playHiHat(time, track.style, step % 4 === 2);
    }
  }

  private playChordPad(chord: number[], time: number, duration: number, style: DemoTrack['style']): void {
    if (!this.ctx || !this.musicGain) return;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(style === 'lofi' ? 950 : style === 'synthwave' ? 1500 : 1900, time);
    filter.Q.setValueAtTime(1.2, time);

    const env = this.ctx.createGain();
    const peak = style === 'lofi' ? 0.11 : 0.085;
    env.gain.setValueAtTime(0.0001, time);
    env.gain.linearRampToValueAtTime(peak, time + 0.08);
    env.gain.exponentialRampToValueAtTime(0.001, time + duration);

    filter.connect(env);
    env.connect(this.musicGain);

    chord.forEach((midi, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      osc.type = style === 'lofi' ? 'triangle' : 'sawtooth';
      osc.frequency.setValueAtTime(midiToFreq(midi), time);
      osc.detune.setValueAtTime((idx % 2 === 0 ? 1 : -1) * (style === 'lofi' ? 7 : 5), time);
      osc.connect(filter);
      osc.start(time);
      osc.stop(time + duration + 0.02);
    });
  }

  private playBass(midi: number, time: number, duration: number, style: DemoTrack['style']): void {
    if (!this.ctx || !this.musicGain) return;

    const osc = this.ctx.createOscillator();
    osc.type = style === 'lofi' ? 'sine' : style === 'synthwave' ? 'sawtooth' : 'square';

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(style === 'lofi' ? 380 : 900, time);
    filter.frequency.exponentialRampToValueAtTime(style === 'lofi' ? 180 : 280, time + duration);
    filter.Q.setValueAtTime(style === 'electro' ? 3.5 : 2.0, time);

    const env = this.ctx.createGain();
    const peak = style === 'lofi' ? 0.28 : 0.22;
    env.gain.setValueAtTime(0.0001, time);
    env.gain.linearRampToValueAtTime(peak, time + 0.012);
    env.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.frequency.setValueAtTime(midiToFreq(midi), time);
    osc.connect(filter);
    filter.connect(env);
    env.connect(this.musicGain);

    osc.start(time);
    osc.stop(time + duration + 0.02);
  }

  private playArp(midi: number, time: number, duration: number, style: DemoTrack['style']): void {
    if (!this.ctx || !this.musicGain) return;

    const osc = this.ctx.createOscillator();
    osc.type = style === 'lofi' ? 'sine' : style === 'synthwave' ? 'triangle' : 'sawtooth';

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(style === 'lofi' ? 1600 : 2800, time);
    filter.frequency.exponentialRampToValueAtTime(750, time + duration);

    const env = this.ctx.createGain();
    const peak = style === 'lofi' ? 0.14 : 0.11;
    env.gain.setValueAtTime(0.0001, time);
    env.gain.linearRampToValueAtTime(peak, time + 0.01);
    env.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.frequency.setValueAtTime(midiToFreq(midi), time);
    osc.connect(filter);
    filter.connect(env);
    env.connect(this.musicGain);

    osc.start(time);
    osc.stop(time + duration + 0.02);
  }

  private playKick(time: number, style: DemoTrack['style']): void {
    if (!this.ctx || !this.musicGain) return;

    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();

    osc.type = 'sine';
    const startFreq = style === 'electro' ? 150 : 125;
    osc.frequency.setValueAtTime(startFreq, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.11);

    env.gain.setValueAtTime(0.001, time);
    env.gain.linearRampToValueAtTime(style === 'lofi' ? 0.36 : 0.45, time + 0.005);
    env.gain.exponentialRampToValueAtTime(0.001, time + 0.19);

    osc.connect(env);
    env.connect(this.musicGain);

    osc.start(time);
    osc.stop(time + 0.21);
  }

  private playSnare(time: number, style: DemoTrack['style']): void {
    if (!this.ctx || !this.musicGain || !this.noiseBuffer) return;

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(style === 'lofi' ? 1400 : 2200, time);
    filter.Q.setValueAtTime(0.9, time);

    const env = this.ctx.createGain();
    const peak = style === 'lofi' ? 0.14 : 0.22;
    env.gain.setValueAtTime(0.001, time);
    env.gain.linearRampToValueAtTime(peak, time + 0.004);
    env.gain.exponentialRampToValueAtTime(0.001, time + (style === 'synthwave' ? 0.16 : 0.11));

    noise.connect(filter);
    filter.connect(env);
    env.connect(this.musicGain);

    noise.start(time);
    noise.stop(time + 0.18);
  }

  private playHiHat(time: number, style: DemoTrack['style'], accented: boolean): void {
    if (!this.ctx || !this.musicGain || !this.noiseBuffer) return;

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(style === 'lofi' ? 5200 : 7500, time);

    const env = this.ctx.createGain();
    const peak = accented ? 0.075 : 0.04;
    env.gain.setValueAtTime(0.001, time);
    env.gain.linearRampToValueAtTime(peak, time + 0.002);
    env.gain.exponentialRampToValueAtTime(0.001, time + 0.045);

    noise.connect(filter);
    filter.connect(env);
    env.connect(this.musicGain);

    noise.start(time);
    noise.stop(time + 0.055);
  }

  // Crisp Snake Game SFX
  public playEatSfx(isBonus = false): void {
    if (!this.sfxEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;

    const now = ctx.currentTime;
    const notes = isBonus ? [660, 880, 1174] : [587.33, 880];

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = 'triangle';
      const t = now + idx * 0.045;
      osc.frequency.setValueAtTime(freq, t);
      env.gain.setValueAtTime(0.001, t);
      env.gain.linearRampToValueAtTime(0.22, t + 0.008);
      env.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      osc.connect(env);
      env.connect(this.sfxGain!);
      osc.start(t);
      osc.stop(t + 0.13);
    });
  }

  public playGameOverSfx(): void {
    if (!this.sfxEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;

    const now = ctx.currentTime;
    const notes = [392, 311.13, 246.94, 196];

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = 'sawtooth';
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1100, now);

      const t = now + idx * 0.085;
      osc.frequency.setValueAtTime(freq, t);
      env.gain.setValueAtTime(0.001, t);
      env.gain.linearRampToValueAtTime(0.18, t + 0.01);
      env.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

      osc.connect(filter);
      filter.connect(env);
      env.connect(this.sfxGain!);
      osc.start(t);
      osc.stop(t + 0.24);
    });
  }
}

export const synthEngine = new NeonSynthEngine();
