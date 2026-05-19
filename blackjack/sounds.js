/**
 * 効果音：MP3素材 + Web Audio（合成）のハイブリッド
 */
const SOUND_FILES = {
  coinLow: "sounds/coin-low.mp3",
  coinHigh: "sounds/coin-high.mp3",
  cardFlip: "sounds/card-flip.mp3",
  voiceBlackjack: "sounds/voice-blackjack.mp3",
  voiceBust: "sounds/voice-bust.mp3",
};

const Sound = {
  ctx: null,
  master: null,
  enabled: true,
  preset: "real",
  clips: {},

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
    this.preload();
  },

  preload() {
    if (this._preloaded) return;
    this._preloaded = true;
    Object.entries(SOUND_FILES).forEach(([key, src]) => {
      const audio = new Audio(src);
      audio.preload = "auto";
      this.clips[key] = audio;
    });
  },

  setPreset(id) {
    const useA = id === "A";
    this.preset = useA ? "A" : "real";
    if (this.master) {
      this.master.gain.value = useA ? 0.62 : 0.9;
    }
    if (typeof els !== "undefined") {
      if (els.btnPresetA) els.btnPresetA.classList.toggle("active", useA);
      if (els.btnPresetE) els.btnPresetE.classList.toggle("active", !useA);
    }
  },

  now() {
    return this.ctx.currentTime;
  },

  /** MP3を再生（都度クローンして重ね再生可能に） */
  playFile(key, volume = 1) {
    if (!this.enabled) return Promise.resolve();
    this.init();
    const template = this.clips[key];
    if (!template) return Promise.resolve();

    const audio = template.cloneNode();
    audio.volume = Math.min(1, Math.max(0, volume));
    return audio.play().catch(() => {});
  },

  isHighTier(tier) {
    return tier === "high" || tier === "ultra" || tier === "allin";
  },

  playCoinFile(tier, mode = "bet") {
    const high = this.isHighTier(tier);
    const vol = high ? 0.85 : 0.7;
    if (mode === "win") {
      void this.playFile(high ? "coinHigh" : "coinLow", vol);
      if (high) {
        setTimeout(() => void this.playFile("coinLow", 0.35), 180);
      }
      return;
    }
    void this.playFile(high ? "coinHigh" : "coinLow", vol);
    if (tier === "mid" && !high) {
      setTimeout(() => void this.playFile("coinLow", 0.45), 120);
    }
  },

  // --- 以下 Web Audio 合成（素材がない音用） ---

  noiseBurst(duration, when, opts = {}) {
    if (!this.enabled || !this.ctx) return;
    const {
      volume = 0.08,
      filterType = "bandpass",
      freqStart = 800,
      freqEnd = 3000,
      Q = 1.2,
    } = opts;
    const sr = this.ctx.sampleRate;
    const len = Math.max(1, Math.floor(sr * duration));
    const buffer = this.ctx.createBuffer(1, len, sr);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const env = 1 - i / len;
      data[i] = (Math.random() * 2 - 1) * env * env;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.Q.value = Q;
    const t0 = this.now() + when;
    filter.frequency.setValueAtTime(freqStart, t0);
    if (freqEnd !== freqStart) {
      filter.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), t0 + duration);
    }
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t0);
    src.stop(t0 + duration + 0.02);
  },

  feltTap(when, volume = 0.12) {
    if (!this.enabled || !this.ctx) return;
    const t0 = this.now() + when;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    osc.type = "sine";
    osc.frequency.setValueAtTime(180, t0);
    osc.frequency.exponentialRampToValueAtTime(70, t0 + 0.08);
    filter.type = "lowpass";
    filter.frequency.value = 320;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(volume, t0 + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.1);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + 0.12);
  },

  cardFlipSynth(when = 0, intensity = 1) {
    if (!this.enabled || !this.ctx) return;
    const vol = 0.09 * intensity;
    this.noiseBurst(0.045 + intensity * 0.02, when, {
      volume: vol,
      freqStart: 350,
      freqEnd: 4800,
      Q: 1.8,
    });
    this.feltTap(when + 0.03, 0.06 * intensity);
  },

  cardDeal(when = 0) {
    if (!this.enabled || !this.ctx) return;
    this.noiseBurst(0.07, when, {
      volume: 0.055,
      freqStart: 500,
      freqEnd: 2200,
      Q: 1.4,
    });
    this.feltTap(when + 0.05, 0.05);
  },

  cardPlace(when = 0) {
    if (!this.enabled || !this.ctx) return;
    this.noiseBurst(0.02, when, {
      volume: 0.035,
      freqStart: 800,
      freqEnd: 1800,
      Q: 1,
    });
    this.feltTap(when + 0.01, 0.08);
  },

  playBet(tier) {
    this.playCoinFile(tier, "bet");
  },

  playWin(tier) {
    this.playCoinFile(tier, "win");
  },

  playCardFlip(intensity = 1) {
    void this.playFile("cardFlip", Math.min(1, 0.55 + intensity * 0.2));
  },

  playBlackjack() {
    this.cardFlipSynth(0, 0.85);
    setTimeout(() => void this.playFile("voiceBlackjack", 0.95), 280);
  },

  playBust() {
    this.cardPlace(0);
    this.noiseBurst(0.08, 0.04, {
      volume: 0.07,
      freqStart: 600,
      freqEnd: 150,
      Q: 0.8,
    });
    this.feltTap(0.06, 0.14);
    setTimeout(() => void this.playFile("voiceBust", 0.95), 200);
  },

  playZawazawa() {
    if (!this.enabled || !this.ctx) return;
    const t0 = this.now();
    const dur = 1.4;
    const bufferSize = Math.floor(this.ctx.sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const t = i / bufferSize;
      const mod = 0.5 + 0.5 * Math.sin(t * 40 * Math.PI);
      data[i] = (Math.random() * 2 - 1) * mod * (1 - t * 0.3);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 280;
    filter.Q.value = 0.6;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(0.09, t0 + 0.2);
    gain.gain.linearRampToValueAtTime(0.07, t0 + dur - 0.3);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t0);
    src.stop(t0 + dur);
  },

  play(name, opts = {}) {
    if (!this.enabled) return;
    this.init();
    const tier = opts.tier || (typeof lastBetTier !== "undefined" ? lastBetTier : "mid");

    switch (name) {
      case "bet":
        this.playBet(tier);
        break;
      case "win":
        this.playWin(tier);
        break;
      case "zawazawa":
        this.playZawazawa();
        break;
      case "deal":
        this.cardDeal(opts.when || 0);
        break;
      case "hit":
      case "double":
        this.playCardFlip(name === "double" ? 1.1 : 1);
        break;
      case "dealerHit":
        this.playCardFlip(0.85);
        break;
      case "stand":
        this.cardPlace();
        break;
      case "bust":
        this.playBust();
        break;
      case "blackjack":
        this.playBlackjack();
        break;
      case "lose":
        this.cardPlace();
        void this.playFile("coinLow", 0.35);
        break;
      default:
        break;
    }
  },

  toggle() {
    this.enabled = !this.enabled;
    if (typeof els !== "undefined" && els.btnSound) {
      els.btnSound.textContent = this.enabled ? "🔊" : "🔇";
      els.btnSound.classList.toggle("muted", !this.enabled);
      els.btnSound.setAttribute("aria-pressed", String(this.enabled));
    }
  },
};
