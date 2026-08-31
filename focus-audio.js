/* ══════════════════════════════════════════════════════════════
   FocusAid — DEHB İşitsel Destek & Odak Müziği Motoru (Web Audio API)
   Sıfır harici bağımlılık, sıfır gecikme, sınırsız döngü.
   ══════════════════════════════════════════════════════════════ */

class FocusAudioManager {
  constructor() {
    this.audioCtx = null;
    this.currentMode = 'silence';
    this.isPlaying = false;
    this.volume = 0.5;
    this.gainNode = null;
    this.activeNodes = [];
    this.lofiTimer = null;
    
    // localStorage'dan son ses seviyesi ve durumunu geri yükle
    try {
      const savedVol = localStorage.getItem('focusaid_audio_vol');
      if (savedVol !== null) this.volume = parseFloat(savedVol);
      const savedMode = localStorage.getItem('focusaid_audio_mode');
      if (savedMode) this.currentMode = savedMode;
    } catch (e) {}
  }

  _initContext() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  setVolume(val) {
    this.volume = Math.max(0, Math.min(1, parseFloat(val)));
    try {
      localStorage.setItem('focusaid_audio_vol', this.volume.toString());
    } catch (e) {}
    if (this.gainNode && this.audioCtx) {
      this.gainNode.gain.setValueAtTime(this.volume, this.audioCtx.currentTime);
    }
  }

  setMode(mode, autoPlay = false) {
    this.currentMode = mode || 'silence';
    try {
      localStorage.setItem('focusaid_audio_mode', this.currentMode);
    } catch (e) {}

    if (this.isPlaying) {
      this._stopActiveNodes();
      if (this.currentMode !== 'silence') {
        this._startCurrentSound();
      } else {
        this.isPlaying = false;
      }
    } else if (autoPlay && this.currentMode !== 'silence') {
      this.play();
    }
    this.updateUI();
  }

  toggle() {
    if (this.isPlaying) {
      this.stop();
    } else {
      this.play();
    }
  }

  play() {
    this._initContext();
    if (!this.audioCtx) return;
    if (this.currentMode === 'silence') {
      this.currentMode = 'brown-noise';
    }
    this._stopActiveNodes();
    this._startCurrentSound();
    this.isPlaying = true;
    this.updateUI();
  }

  stop() {
    this._stopActiveNodes();
    this.isPlaying = false;
    this.updateUI();
  }

  _stopActiveNodes() {
    if (this.lofiTimer) {
      clearInterval(this.lofiTimer);
      this.lofiTimer = null;
    }
    this.activeNodes.forEach(n => {
      try {
        if (n.stop) n.stop();
        if (n.disconnect) n.disconnect();
      } catch (e) {}
    });
    this.activeNodes = [];
  }

  _startCurrentSound() {
    if (!this.audioCtx) return;
    const ctx = this.audioCtx;

    // Master Gain
    this.gainNode = ctx.createGain();
    this.gainNode.gain.setValueAtTime(0.01, ctx.currentTime);
    this.gainNode.gain.exponentialRampToValueAtTime(Math.max(0.01, this.volume), ctx.currentTime + 0.5);
    this.gainNode.connect(ctx.destination);
    this.activeNodes.push(this.gainNode);

    switch (this.currentMode) {
      case 'brown-noise':
        this._createBrownNoise(ctx, this.gainNode);
        break;
      case 'white-noise':
        this._createWhiteNoise(ctx, this.gainNode);
        break;
      case 'binaural':
        this._createBinauralBeats(ctx, this.gainNode);
        break;
      case 'rain':
        this._createRainSound(ctx, this.gainNode);
        break;
      case 'lofi':
        this._createLofiChords(ctx, this.gainNode);
        break;
      default:
        break;
    }
  }

  // 🌊 Brown Noise (Kahverengi Gürültü - Derin, sıcak, DEHB odak dostu)
  _createBrownNoise(ctx, output) {
    const bufferSize = ctx.sampleRate * 2;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const outputData = noiseBuffer.getChannelData(0);
    let lastOut = 0.0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      outputData[i] = (lastOut + (0.02 * white)) / 1.02;
      lastOut = outputData[i];
      outputData[i] *= 3.5;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 450;

    noise.connect(filter);
    filter.connect(output);
    noise.start();
    this.activeNodes.push(noise, filter);
  }

  // 📺 White Noise (Yumuşatılmış Beyaz Gürültü)
  _createWhiteNoise(ctx, output) {
    const bufferSize = ctx.sampleRate * 2;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const outputData = noiseBuffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      outputData[i] = (Math.random() * 2 - 1) * 0.25;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1000;
    filter.Q.value = 0.5;

    noise.connect(filter);
    filter.connect(output);
    noise.start();
    this.activeNodes.push(noise, filter);
  }

  // 🎶 40Hz Gamma Binaural Beats (Sol: 200Hz, Sağ: 240Hz = 40Hz Odak Frekansı)
  _createBinauralBeats(ctx, output) {
    const oscL = ctx.createOscillator();
    const panL = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    oscL.type = 'sine';
    oscL.frequency.value = 200;

    const oscR = ctx.createOscillator();
    const panR = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    oscR.type = 'sine';
    oscR.frequency.value = 240;

    const subGain = ctx.createGain();
    subGain.gain.value = 0.35;

    if (panL && panR) {
      panL.pan.value = -1;
      panR.pan.value = 1;
      oscL.connect(panL);
      oscR.connect(panR);
      panL.connect(subGain);
      panR.connect(subGain);
    } else {
      oscL.connect(subGain);
      oscR.connect(subGain);
    }

    this._createBrownNoise(ctx, subGain);

    subGain.connect(output);
    oscL.start();
    oscR.start();
    this.activeNodes.push(oscL, oscR, subGain);
  }

  // 🌧️ Yağmur Ambiyansı
  _createRainSound(ctx, output) {
    const bufferSize = ctx.sampleRate * 2;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const outputData = noiseBuffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      outputData[i] = Math.random() * 2 - 1;
    }

    const rain = ctx.createBufferSource();
    rain.buffer = noiseBuffer;
    rain.loop = true;

    const filter1 = ctx.createBiquadFilter();
    filter1.type = 'lowpass';
    filter1.frequency.value = 800;

    const filter2 = ctx.createBiquadFilter();
    filter2.type = 'highpass';
    filter2.frequency.value = 200;

    rain.connect(filter1);
    filter1.connect(filter2);
    filter2.connect(output);
    rain.start();
    this.activeNodes.push(rain, filter1, filter2);
  }

  // 🎵 Lo-Fi Chill Synth Akorları (7th & 9th Jazz Chords)
  _createLofiChords(ctx, output) {
    const hissBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const hissData = hissBuffer.getChannelData(0);
    for (let i = 0; i < ctx.sampleRate; i++) hissData[i] = (Math.random() * 2 - 1) * 0.03;
    const hiss = ctx.createBufferSource();
    hiss.buffer = hissBuffer;
    hiss.loop = true;
    hiss.connect(output);
    hiss.start();
    this.activeNodes.push(hiss);

    const chords = [
      [146.83, 220.00, 261.63, 329.63], // Dm9
      [196.00, 246.94, 329.63, 392.00], // G13
      [130.81, 196.00, 246.94, 329.63], // Cmaj9
      [220.00, 261.63, 329.63, 392.00]  // Am7
    ];

    let chordIdx = 0;
    const playNextChord = () => {
      if (!this.isPlaying || this.currentMode !== 'lofi') return;
      const notes = chords[chordIdx % chords.length];
      chordIdx++;

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const chordGain = ctx.createGain();
        osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);

        const t = ctx.currentTime;
        chordGain.gain.setValueAtTime(0.001, t);
        chordGain.gain.linearRampToValueAtTime(0.08, t + 0.6);
        chordGain.gain.exponentialRampToValueAtTime(0.001, t + 3.8);

        osc.connect(chordGain);
        chordGain.connect(output);
        osc.start(t);
        osc.stop(t + 4.0);
        this.activeNodes.push(osc, chordGain);
      });
    };

    playNextChord();
    this.lofiTimer = setInterval(playNextChord, 4000);
  }

  updateUI() {
    const playBtn = document.getElementById('focus-audio-toggle');
    const modeSelect = document.getElementById('focus-audio-select');
    const eqBars = document.getElementById('focus-audio-eq');
    const modeLabel = document.getElementById('focus-audio-label');

    if (playBtn) {
      playBtn.innerHTML = this.isPlaying ? '⏸' : '▶';
      playBtn.title = this.isPlaying ? 'Müziği Durdur' : 'Odak Müziğini Başlat';
      playBtn.classList.toggle('bg-indigo-600', this.isPlaying);
      playBtn.classList.toggle('text-white', this.isPlaying);
    }
    if (modeSelect && modeSelect.value !== this.currentMode) {
      modeSelect.value = this.currentMode;
    }
    if (eqBars) {
      eqBars.classList.toggle('opacity-100', this.isPlaying);
      eqBars.classList.toggle('opacity-25', !this.isPlaying);
    }
    if (modeLabel) {
      const modeNames = {
        'silence': 'Sessizlik',
        'brown-noise': 'Brown Noise',
        'white-noise': 'White Noise',
        'binaural': '40Hz Binaural Beats',
        'rain': 'Yağmur Ambiyansı',
        'lofi': 'Lo-Fi Chill Chords'
      };
      modeLabel.textContent = modeNames[this.currentMode] || this.currentMode;
    }
  }
}

// Global Tekil Ses Motoru
window.FocusAudio = new FocusAudioManager();

// Profil değiştiğinde otomatik senkronize et
function syncAudioWithProfile(focusTrigger) {
  if (window.FocusAudio && focusTrigger) {
    window.FocusAudio.setMode(focusTrigger);
  }
}
