/**
 * 効果音：MP3素材 + Web Audio（合成）のハイブリッド
 */
const SOUND_FILES = {
  coinLow: "sounds/coin-low.mp3",
  coinHigh: "sounds/coin-high.mp3",
  cardFlip: "sounds/card-flip.mp3",
  zawazawaClip: "sounds/zawazawa.mp4",
  cutinWhoosh: "sounds/cutin-whoosh.mp3",
  voiceBlackjack: "sounds/voice-blackjack.mp3",
  voiceBust: "sounds/voice-bust.mp3",
  voiceWin: "sounds/voice-win.mp3",
  voiceLose: "sounds/voice-lose.mp3",
  voiceEven: "sounds/voice-even.mp3",
};

const KEY_VOLUME = "bugging_volume";
const DEFAULT_VOLUME = 0.8;
const DEFAULT_BGM_VIDEO_ID = "0is4q9mlFHU";
const VOICE_VOLUME = 1.0;

const Sound = {
  ctx: null,
  master: null,
  volume: DEFAULT_VOLUME,
  presetGain: 0.9,
  preset: "real",
  clips: {},
  _baseUrl: null,
  _preloaded: false,
  bgmPlayer: null,
  bgmStarted: false,
  bgmVideoId: DEFAULT_BGM_VIDEO_ID,

  get enabled() {
    return this.volume > 0.001;
  },

  /** GitHub Pages 等でも正しく解決するベースURL */
  assetUrl(relativePath) {
    if (!this._baseUrl) {
      const script = [...document.scripts].find((s) =>
        (s.src || "").includes("sounds.js"),
      );
      if (script?.src) {
        this._baseUrl = script.src.replace(/[^/]+$/, "");
      } else {
        const path = window.location.pathname;
        const slash = path.lastIndexOf("/");
        this._baseUrl =
          slash >= 0
            ? path.slice(0, slash + 1)
            : "/";
        if (!this._baseUrl.startsWith("http")) {
          this._baseUrl = window.location.origin + this._baseUrl;
        }
      }
    }
    try {
      return new URL(relativePath, this._baseUrl).href;
    } catch {
      return relativePath;
    }
  },

  loadVolume() {
    try {
      const raw = localStorage.getItem(KEY_VOLUME);
      if (raw === null) return;
      const v = parseFloat(raw);
      if (Number.isFinite(v)) {
        this.volume = Math.min(1, Math.max(0, v));
      }
    } catch {
      /* プライベートモード等 */
    }
  },

  saveVolume() {
    try {
      localStorage.setItem(KEY_VOLUME, String(this.volume));
    } catch {
      /* プライベートモード等 */
    }
  },

  _applyMasterGain() {
    if (this.master) {
      this.master.gain.value = this.volume * this.presetGain;
    }
    this._applyBgmVolume();
  },

  _applyBgmVolume() {
    const player = this.bgmPlayer;
    if (!player || typeof player.setVolume !== "function") return;
    try {
      const vol = Math.round(this.volume * 100);
      if (this.volume <= 0.001) {
        player.mute();
      } else {
        player.unMute();
        player.setVolume(vol);
      }
    } catch {
      /* プレイヤー未準備 */
    }
  },

  setVolume(value) {
    this.volume = Math.min(1, Math.max(0, value));
    this.saveVolume();
    this._applyMasterGain();
    this.updateVolumeUI();
  },

  updateVolumeUI() {
    const slider =
      typeof els !== "undefined" && els.volumeSlider
        ? els.volumeSlider
        : document.getElementById("volume-slider");
    const icon =
      typeof els !== "undefined" && els.volumeIcon
        ? els.volumeIcon
        : document.getElementById("volume-icon");

    if (slider) {
      slider.value = String(Math.round(this.volume * 100));
      slider.setAttribute("aria-valuenow", slider.value);
    }
    if (icon) {
      if (this.volume <= 0) icon.textContent = "🔇";
      else if (this.volume <= 0.35) icon.textContent = "🔈";
      else if (this.volume <= 0.7) icon.textContent = "🔉";
      else icon.textContent = "🔊";
    }
  },

  /** ユーザー操作後に Web Audio を確実に起動 */
  unlockAudio() {
    this.init();
    if (this.ctx?.state === "suspended") {
      void this.ctx.resume();
    }
  },

  unlockAndPlayBgm() {
    this.unlockAudio();
    this.playBgm();
  },

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this._applyMasterGain();
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
      const audio = new Audio(this.assetUrl(src));
      audio.preload = "auto";
      this.clips[key] = audio;
    });
  },

  setPreset(id) {
    const useA = id === "A";
    this.preset = useA ? "A" : "real";
    this.presetGain = useA ? 0.62 : 0.9;
    this._applyMasterGain();
    if (typeof els !== "undefined") {
      if (els.btnPresetA) els.btnPresetA.classList.toggle("active", useA);
      if (els.btnPresetE) els.btnPresetE.classList.toggle("active", !useA);
    }
  },

  now() {
    return this.ctx.currentTime;
  },

  /** MP3/MP4を再生（HTML5 Audio・GitHub Pagesでも安定） */
  playFile(key, volume = 1) {
    if (!this.enabled) return Promise.resolve();
    this.unlockAudio();

    const rel = SOUND_FILES[key];
    if (!rel) return Promise.resolve();

    const template = this.clips[key];
    const src = template?.src || this.assetUrl(rel);
    const audio = new Audio(src);
    audio.volume = Math.min(1, Math.max(0, volume * this.volume));

    return audio.play().catch(() => {
      if (key === "zawazawaClip") {
        this._playZawazawaSynth();
      }
    });
  },

  /** ボイス再生（コイン音と同じ経路で確実に鳴らす） */
  playVoice(key, volume = VOICE_VOLUME, delayMs = 0) {
    const run = () => void this.playFile(key, volume);
    if (delayMs > 0) setTimeout(run, delayMs);
    else run();
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
    this.unlockAudio();
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
    this.unlockAudio();
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
    this.playVoice("voiceBlackjack", VOICE_VOLUME, 280);
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
    this.playVoice("voiceBust", VOICE_VOLUME, 200);
  },

  playOutcomeWin(tier) {
    this.playWin(tier);
    this.playVoice("voiceWin", VOICE_VOLUME, 120);
  },

  playOutcomeLose() {
    this.cardPlace(0);
    void this.playFile("coinLow", 0.32);
    this.playVoice("voiceLose", VOICE_VOLUME, 160);
  },

  playOutcomeEven() {
    this.cardPlace(0);
    this.playVoice("voiceEven", VOICE_VOLUME, 100);
  },

  _playZawazawaSynth() {
    if (!this.enabled || !this.ctx) return;
    this.unlockAudio();
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

  playZawazawa() {
    void this.playFile("zawazawaClip", 0.92);
  },

  playCutinZawazawa() {
    void this.playFile("zawazawaClip", 0.96);
  },

  play(name, opts = {}) {
    if (!this.enabled) return;
    this.unlockAudio();
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
      case "cutinZawazawa":
        this.playCutinZawazawa();
        break;
      case "cutinWhoosh":
        void this.playFile("cutinWhoosh", opts.volume ?? 0.9);
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
        this.playOutcomeLose();
        break;
      case "voiceWin":
        this.playVoice("voiceWin", opts.volume ?? VOICE_VOLUME, opts.delayMs ?? 0);
        break;
      case "voiceLose":
        this.playVoice("voiceLose", opts.volume ?? VOICE_VOLUME, opts.delayMs ?? 0);
        break;
      case "voiceEven":
        this.playVoice("voiceEven", opts.volume ?? VOICE_VOLUME, opts.delayMs ?? 0);
        break;
      default:
        break;
    }
  },

  toggle() {
    this.setVolume(this.volume > 0 ? 0 : DEFAULT_VOLUME);
  },

  playBgm() {
    const player = this.bgmPlayer;
    if (!player || typeof player.playVideo !== "function") return;
    try {
      this._applyBgmVolume();
      player.playVideo();
      this.bgmStarted = true;
    } catch {
      /* 自動再生ブロック等 */
    }
  },

  _createYoutubeBgm() {
    if (this.bgmPlayer) return;

    let host = document.getElementById("bgm-player");
    if (!host) {
      host = document.createElement("div");
      host.id = "bgm-player";
      host.className = "bgm-player-host";
      host.setAttribute("aria-hidden", "true");
      document.body.appendChild(host);
    }

    const videoId =
      document.body?.dataset?.bgmVideoId || DEFAULT_BGM_VIDEO_ID;

    this.bgmPlayer = new YT.Player("bgm-player", {
      height: "0",
      width: "0",
      videoId,
      playerVars: {
        autoplay: 0,
        playsinline: 1,
        loop: 1,
        playlist: videoId,
        controls: 0,
        disablekb: 1,
        fs: 0,
        modestbranding: 1,
        rel: 0,
      },
      events: {
        onReady: () => {
          this._applyBgmVolume();
        },
      },
    });
  },

  _loadYoutubeAPI() {
    if (window.YT && window.YT.Player) {
      this._createYoutubeBgm();
      return;
    }

    const prevReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prevReady === "function") prevReady();
      this._createYoutubeBgm();
    };

    if (document.getElementById("youtube-iframe-api")) return;

    const tag = document.createElement("script");
    tag.id = "youtube-iframe-api";
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScript = document.getElementsByTagName("script")[0];
    firstScript.parentNode.insertBefore(tag, firstScript);
  },

  initBgm() {
    this.bgmVideoId =
      document.body?.dataset?.bgmVideoId || DEFAULT_BGM_VIDEO_ID;

    this.loadVolume();
    this._applyMasterGain();
    this.updateVolumeUI();
    this._loadYoutubeAPI();

    const unlock = () => {
      this.unlockAndPlayBgm();
    };

    document.body.addEventListener("click", unlock, { once: true });
    document.body.addEventListener("touchstart", unlock, { once: true, passive: true });
  },
};
