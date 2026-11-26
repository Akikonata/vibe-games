(function () {
  window.KOF = window.KOF || {};

  class SoundEngine {
    constructor() {
      this.ctx = null;
      this.sfxEnabled = true;
      this.bgmEnabled = true;
      this.bgmTimer = null;
      this.bgmStep = 0;
    }

    ensureContext() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    }

    playTone(freq, endFreq, duration, type = 'square', volume = 0.16) {
      if (!this.sfxEnabled) return;
      const ctx = this.ensureContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (endFreq !== freq) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
      }

      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + duration);
    }

    playNoise(duration, volume = 0.2, filterFreq = 1200, filterType = 'bandpass') {
      if (!this.sfxEnabled) return;
      const ctx = this.ensureContext();
      if (!ctx) return;

      const bufferSize = Math.floor(ctx.sampleRate * duration);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = filterType;
      filter.frequency.value = filterFreq;

      const gain = ctx.createGain();
      const now = ctx.currentTime;
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start(now);
      noise.stop(now + duration);
    }

    uiSelect() {
      this.playTone(540, 820, 0.07, 'triangle', 0.12);
    }

    uiConfirm() {
      this.playTone(440, 880, 0.12, 'square', 0.13);
      setTimeout(() => this.playTone(660, 1100, 0.14, 'triangle', 0.12), 55);
    }

    whiff(heavy = false) {
      this.playNoise(heavy ? 0.11 : 0.07, heavy ? 0.14 : 0.09, heavy ? 700 : 1500, 'bandpass');
    }

    hit(heavy = false) {
      if (heavy) {
        // 3-layer arcade heavy impact: sub-bass thump + meaty mid crunch + high slap
        this.playTone(135, 34, 0.19, 'sine', 0.34);
        this.playTone(230, 58, 0.14, 'sawtooth', 0.22);
        this.playNoise(0.13, 0.28, 1250, 'bandpass');
      } else {
        this.playTone(290, 92, 0.08, 'triangle', 0.22);
        this.playNoise(0.065, 0.2, 1850, 'bandpass');
      }
    }

    counterHit() {
      this.playTone(150, 38, 0.22, 'sine', 0.36);
      this.playTone(620, 1240, 0.11, 'triangle', 0.18);
      this.playNoise(0.15, 0.3, 1600, 'bandpass');
    }

    groundSlam() {
      this.playTone(105, 28, 0.2, 'sine', 0.3);
      this.playNoise(0.14, 0.22, 420, 'lowpass');
    }

    block() {
      this.playTone(720, 320, 0.08, 'triangle', 0.18);
      this.playNoise(0.06, 0.15, 2400, 'highpass');
    }

    guardBreak() {
      this.playTone(300, 60, 0.35, 'sawtooth', 0.28);
      this.playNoise(0.32, 0.3, 1800, 'bandpass');
    }

    fireball() {
      this.playTone(320, 780, 0.18, 'sawtooth', 0.16);
      this.playNoise(0.22, 0.2, 1100, 'bandpass');
    }

    uppercut() {
      this.playTone(200, 960, 0.22, 'sawtooth', 0.2);
      this.playNoise(0.2, 0.22, 1600, 'bandpass');
    }

    roll() {
      this.playNoise(0.12, 0.12, 1900, 'highpass');
      this.playTone(360, 220, 0.1, 'sine', 0.09);
    }

    superFlash() {
      this.playTone(320, 1480, 0.32, 'sawtooth', 0.22);
      setTimeout(() => this.playTone(980, 1960, 0.28, 'triangle', 0.2), 80);
      this.playNoise(0.3, 0.18, 2200, 'highpass');
    }

    ko() {
      this.playTone(160, 32, 0.65, 'sawtooth', 0.32);
      this.playNoise(0.55, 0.34, 650, 'lowpass');
    }

    roundAnnounce() {
      this.playTone(392, 587, 0.18, 'triangle', 0.16);
      setTimeout(() => this.playTone(587, 784, 0.22, 'triangle', 0.16), 140);
    }

    startBgm() {
      this.stopBgm();
      if (!this.bgmEnabled) return;
      const ctx = this.ensureContext();
      if (!ctx) return;

      // Energetic 142 BPM arcade fighting bassline + lead riff
      const bass = [110, 110, 130.8, 146.8, 110, 110, 164.8, 146.8, 98, 98, 110, 130.8, 146.8, 130.8, 110, 98];
      const lead = [440, 0, 523.2, 587.3, 659.2, 0, 587.3, 523.2, 493.8, 0, 440, 392, 440, 523.2, 587.3, 0];

      this.bgmStep = 0;
      this.bgmTimer = setInterval(() => {
        if (!this.bgmEnabled || !this.ctx || this.ctx.state !== 'running') return;
        const step = this.bgmStep % bass.length;
        this.bgmStep++;

        const now = this.ctx.currentTime;
        // Bass pulse
        const bOsc = this.ctx.createOscillator();
        const bGain = this.ctx.createGain();
        bOsc.type = 'sawtooth';
        bOsc.frequency.setValueAtTime(bass[step], now);
        bGain.gain.setValueAtTime(0.042, now);
        bGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
        bOsc.connect(bGain);
        bGain.connect(this.ctx.destination);
        bOsc.start(now);
        bOsc.stop(now + 0.17);

        // Synth lead accent
        const note = lead[step];
        if (note > 0) {
          const lOsc = this.ctx.createOscillator();
          const lGain = this.ctx.createGain();
          lOsc.type = 'square';
          lOsc.frequency.setValueAtTime(note, now);
          lGain.gain.setValueAtTime(0.026, now);
          lGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
          lOsc.connect(lGain);
          lGain.connect(this.ctx.destination);
          lOsc.start(now);
          lOsc.stop(now + 0.16);
        }
      }, 190);
    }

    stopBgm() {
      if (this.bgmTimer) {
        clearInterval(this.bgmTimer);
        this.bgmTimer = null;
      }
    }
  }

  window.KOF.audio = new SoundEngine();
})();
