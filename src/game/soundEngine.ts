import { SettingsData, SurfaceMaterialType } from '../types/game';

class ProceduralSoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private windSource: AudioBufferSourceNode | null = null;
  private initialized = false;
  private noiseBuffer: AudioBuffer | null = null;
  private lastTapTime = 0;

  private masterVol = 0.85;
  private sfxVol = 0.9;
  private windVol = 0.6;
  private muted = false;

  public init(): void {
    if (this.initialized) {
      if (this.ctx && this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return;
    }

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    try {
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.windGain = this.ctx.createGain();

      this.sfxGain.connect(this.masterGain);
      this.windGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      const length = this.ctx.sampleRate * 2;
      this.noiseBuffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      let b0 = 0;
      let b1 = 0;
      let b2 = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99765 * b0 + white * 0.099046;
        b1 = 0.963 * b1 + white * 0.2965164;
        b2 = 0.57 * b2 + white * 1.0526913;
        data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.14;
      }

      this.windFilter = this.ctx.createBiquadFilter();
      this.windFilter.type = 'bandpass';
      this.windFilter.frequency.value = 320;
      this.windFilter.Q.value = 1.1;

      this.windSource = this.ctx.createBufferSource();
      this.windSource.buffer = this.noiseBuffer;
      this.windSource.loop = true;
      this.windSource.connect(this.windFilter);
      this.windFilter.connect(this.windGain);
      this.windSource.start();

      this.windGain.gain.value = 0;
      this.syncGains();
      this.initialized = true;
    } catch {
      // Audio unavailable
    }
  }

  public applySettings(settings: SettingsData): void {
    this.masterVol = settings.masterVolume;
    this.sfxVol = settings.sfxVolume;
    this.windVol = settings.windVolume;
    this.muted = settings.muted;
    this.syncGains();
  }

  private syncGains(): void {
    if (!this.ctx || !this.masterGain || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const effectiveMaster = this.muted ? 0 : this.masterVol;
    this.masterGain.gain.setTargetAtTime(effectiveMaster, now, 0.04);
    this.sfxGain.gain.setTargetAtTime(this.sfxVol, now, 0.04);
  }

  public updateWind(altitude: number, vy: number, isPlaying: boolean): void {
    if (!this.ctx || !this.windGain || !this.windFilter) return;
    const now = this.ctx.currentTime;
    if (!isPlaying || this.muted) {
      this.windGain.gain.setTargetAtTime(0, now, 0.12);
      return;
    }
    const altRatio = Math.min(1, Math.max(0, altitude / 1000));
    const fallPanic = Math.min(1, Math.max(0, (-vy - 6) / 22));
    const targetGain = this.windVol * (0.04 + altRatio * 0.16 + fallPanic * 0.34);
    const targetFreq = 260 + altRatio * 520 + fallPanic * 820;
    this.windGain.gain.setTargetAtTime(targetGain, now, 0.08);
    this.windFilter.frequency.setTargetAtTime(targetFreq, now, 0.08);
  }

  public playSurfaceStep(surface: SurfaceMaterialType, intensity = 1): void {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    const now = this.ctx.currentTime;
    if (now - this.lastTapTime < 0.062) return;
    this.lastTapTime = now;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    if (surface === 'glass') {
      // High crystalline glass tap
      osc.type = 'sine';
      const f = 1480 + Math.random() * 320;
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.exponentialRampToValueAtTime(620, now + 0.055);
      gain.gain.setValueAtTime(0.09 * intensity, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    } else if (surface === 'stone' || surface === 'wood') {
      // Low organic thud
      osc.type = 'sine';
      const f = surface === 'stone' ? 195 + Math.random() * 45 : 260 + Math.random() * 60;
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.exponentialRampToValueAtTime(75, now + 0.055);
      gain.gain.setValueAtTime(0.14 * intensity, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    } else {
      // Metallic container / steel clank
      osc.type = 'triangle';
      const f = 680 + Math.random() * 240;
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.exponentialRampToValueAtTime(210, now + 0.045);
      gain.gain.setValueAtTime(0.11 * intensity, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    }

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.065);
  }

  public playHeavyImpact(): void {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(36, now + 0.32);
    gain.gain.setValueAtTime(0.42, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.36);
  }

  public playJump(): void {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const mod = this.ctx.createOscillator();
    const modGain = this.ctx.createGain();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(185, now);
    osc.frequency.exponentialRampToValueAtTime(540, now + 0.16);

    mod.type = 'sine';
    mod.frequency.setValueAtTime(42, now);
    modGain.gain.setValueAtTime(28, now);
    mod.connect(modGain);
    modGain.connect(osc.frequency);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1500, now);

    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    mod.start(now);
    osc.stop(now + 0.19);
    mod.stop(now + 0.19);
  }

  public playLedgeGrab(): void {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.setValueAtTime(480, now + 0.05);
    osc.frequency.exponentialRampToValueAtTime(240, now + 0.16);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(900, now);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.19);
  }

  public playGrappleZip(): void {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    const now = this.ctx.currentTime;

    // Magnetic lock-on ping + rising energy tether zip
    const lockOsc = this.ctx.createOscillator();
    const lockGain = this.ctx.createGain();
    lockOsc.type = 'sine';
    lockOsc.frequency.setValueAtTime(1180, now);
    lockOsc.frequency.setValueAtTime(1580, now + 0.04);
    lockGain.gain.setValueAtTime(0.18, now);
    lockGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    lockOsc.connect(lockGain);
    lockGain.connect(this.sfxGain);
    lockOsc.start(now);
    lockOsc.stop(now + 0.15);

    const zipOsc = this.ctx.createOscillator();
    const zipGain = this.ctx.createGain();
    zipOsc.type = 'sawtooth';
    zipOsc.frequency.setValueAtTime(220, now + 0.04);
    zipOsc.frequency.exponentialRampToValueAtTime(920, now + 0.34);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1100, now + 0.04);

    zipGain.gain.setValueAtTime(0.2, now + 0.04);
    zipGain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);

    zipOsc.connect(filter);
    filter.connect(zipGain);
    zipGain.connect(this.sfxGain);
    zipOsc.start(now + 0.04);
    zipOsc.stop(now + 0.37);
  }

  public playDash(): void {
    if (!this.ctx || !this.sfxGain || this.muted || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1200, now);
    filter.frequency.exponentialRampToValueAtTime(320, now + 0.34);
    filter.Q.value = 0.8;

    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.45, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(this.sfxGain);
    noise.start(now);
    noise.stop(now + 0.36);

    const sub = this.ctx.createOscillator();
    const sGain = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(150, now);
    sub.frequency.exponentialRampToValueAtTime(48, now + 0.25);
    sGain.gain.setValueAtTime(0.28, now);
    sGain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
    sub.connect(sGain);
    sGain.connect(this.sfxGain);
    sub.start(now);
    sub.stop(now + 0.27);
  }

  public playBounce(): void {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(170, now);
    osc.frequency.exponentialRampToValueAtTime(640, now + 0.22);
    osc.frequency.exponentialRampToValueAtTime(390, now + 0.34);

    gain.gain.setValueAtTime(0.26, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.37);
  }

  public playMilestone(): void {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    const now = this.ctx.currentTime;
    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      const t = now + idx * 0.08;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.44);
    });
  }

  public playCheckpoint(): void {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      const t = now + idx * 0.07;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.33);
    });
  }

  public playVictory(): void {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98];
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      const t = now + idx * 0.09;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.22, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.56);
    });
  }
}

export const soundEngine = new ProceduralSoundEngine();
