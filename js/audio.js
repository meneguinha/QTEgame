// Design de Áudio Cinematográfico Profissional via Web Audio API
// Sem bips agudos ou sintetizadores retrô: camadas de sub-grave, texturas acústicas de metal e impacto cinematográfico

class SoundSystem {
  constructor() {
    this.ctx = null;
    this.initialized = false;
    this.masterGain = null;

    // Nós de áudio do efeito de Hold (tensão cinematográfica)
    this.holdSubOsc = null;
    this.holdNoiseSource = null;
    this.holdNoiseFilter = null;
    this.holdGain = null;

    this.heartbeatInterval = null;

    // Barramento de reverb compartilhado (criado sob demanda)
    this.reverbInput = null;

    // Trilha sonora (elemento <audio> independente do grafo Web Audio)
    this.music = null;
    this.musicFadeInterval = null;
    this.musicVolume = 0.32;   // Volume de cruzeiro: fica atrás dos impactos e do vídeo
    this.musicDucked = false;
  }

  init() {
    if (this.initialized) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.85, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
      this.initialized = true;

      const hint = document.getElementById('audio-hint');
      if (hint) hint.style.display = 'none';
    } catch (e) {
      console.warn('Web Audio API não suportada:', e);
    }
  }

  ensureContext() {
    if (!this.initialized) this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Cria um buffer de ruído rosa (mais aveludado e natural que ruído branco)
  createPinkNoiseBuffer(duration = 0.5) {
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
    return buffer;
  }

  // Impulso de reverb: cauda de ruído com decaimento exponencial (sala grande de datacenter)
  createImpulseResponse(duration = 2.8, decay = 2.8) {
    const rate = this.ctx.sampleRate;
    const length = Math.floor(rate * duration);
    const impulse = this.ctx.createBuffer(2, length, rate);

    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }
    return impulse;
  }

  // Entrada do reverb: conecte qualquer nó aqui para mandá-lo ao espaço reverberante
  getReverbBus() {
    if (!this.reverbInput) {
      const convolver = this.ctx.createConvolver();
      convolver.buffer = this.createImpulseResponse();

      const wetGain = this.ctx.createGain();
      wetGain.gain.setValueAtTime(0.55, this.ctx.currentTime);

      this.reverbInput = this.ctx.createGain();
      this.reverbInput.connect(convolver);
      convolver.connect(wetGain);
      wetGain.connect(this.masterGain);
    }
    return this.reverbInput;
  }

  // 1. IMPACTO DE ESPADA / CLASH (3 Camadas: Transiente de Aço + Ressonância de Lâmina + Sub-Bass Boom)
  playClash() {
    this.ensureContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;

    // Camada 1: Transiente de impacto de metal duro (estalo de choque)
    const noiseBuffer = this.createPinkNoiseBuffer(0.06);
    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(3200, now);
    noiseFilter.Q.setValueAtTime(4.0, now);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.7, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain);
    noise.start(now);

    // Camada 2: Ressonância Metálica da Lâmina (Harmônicos reais de vibração de espada)
    const bladeFrequencies = [920, 1420, 2180];
    bladeFrequencies.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.92, now + 0.35);

      const vol = 0.18 / (idx + 1);
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.35);
    });

    // Camada 3: Sub-Bass Cinematográfico (Peso do golpe no peito)
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(115, now);
    subOsc.frequency.exponentialRampToValueAtTime(32, now + 0.28);

    subGain.gain.setValueAtTime(0.75, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    subOsc.connect(subGain);
    subGain.connect(this.masterGain);
    subOsc.start(now);
    subOsc.stop(now + 0.28);
  }

  // 2. CORTE RÁPIDO NO AR (Whoosh Dinâmico e Pesado)
  playWhoosh() {
    this.ensureContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const duration = 0.28;
    const noiseBuffer = this.createPinkNoiseBuffer(duration);
    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(180, now);
    filter.frequency.exponentialRampToValueAtTime(1200, now + duration * 0.45);
    filter.frequency.exponentialRampToValueAtTime(140, now + duration);
    filter.Q.setValueAtTime(2.2, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.45, now + duration * 0.35);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    noise.start(now);
  }

  // 3. TENSÃO CINEMATOGRÁFICA AO SEGURAR A TECLA (Hold Tone)
  // Substitui completamente o apito estridente por um rumble de tensão visceral
  startHoldTone(baseTone = 60) {
    this.ensureContext();
    if (!this.ctx) return;
    this.stopHoldTone();

    const now = this.ctx.currentTime;

    // Sub-bass contínuo encorpado
    this.holdSubOsc = this.ctx.createOscillator();
    this.holdSubOsc.type = 'sine';
    this.holdSubOsc.frequency.setValueAtTime(baseTone, now);

    // Camada de ruído de atrito e energia contida
    const noiseBuffer = this.createPinkNoiseBuffer(2.5);
    this.holdNoiseSource = this.ctx.createBufferSource();
    this.holdNoiseSource.buffer = noiseBuffer;
    this.holdNoiseSource.loop = true;

    this.holdNoiseFilter = this.ctx.createBiquadFilter();
    this.holdNoiseFilter.type = 'lowpass';
    this.holdNoiseFilter.frequency.setValueAtTime(220, now);

    this.holdGain = this.ctx.createGain();
    this.holdGain.gain.setValueAtTime(0.01, now);
    this.holdGain.gain.linearRampToValueAtTime(0.4, now + 0.1);

    this.holdSubOsc.connect(this.holdGain);
    this.holdNoiseSource.connect(this.holdNoiseFilter);
    this.holdNoiseFilter.connect(this.holdGain);
    this.holdGain.connect(this.masterGain);

    this.holdSubOsc.start(now);
    this.holdNoiseSource.start(now);
  }

  updateHoldTonePitch(ratio) {
    if (!this.ctx || !this.holdSubOsc || !this.holdNoiseFilter) return;
    const clamped = Math.max(0, Math.min(1.4, ratio));
    const now = this.ctx.currentTime;

    // Sobe suavemente o subgrave de 60Hz para 85Hz (pressão crescendo)
    const targetFreq = 58 + clamped * 28;
    this.holdSubOsc.frequency.setTargetAtTime(targetFreq, now, 0.05);

    // O filtro de ar abre levemente de 220Hz até 550Hz
    const targetFilter = 220 + clamped * 320;
    this.holdNoiseFilter.frequency.setTargetAtTime(targetFilter, now, 0.05);
  }

  stopHoldTone() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    if (this.holdGain) {
      try {
        this.holdGain.gain.linearRampToValueAtTime(0.001, now + 0.05);
      } catch (e) {}
    }

    setTimeout(() => {
      if (this.holdSubOsc) {
        try { this.holdSubOsc.stop(); } catch (e) {}
        this.holdSubOsc = null;
      }
      if (this.holdNoiseSource) {
        try { this.holdNoiseSource.stop(); } catch (e) {}
        this.holdNoiseSource = null;
      }
      this.holdNoiseFilter = null;
      this.holdGain = null;
    }, 60);
  }

  // 4. ACERTO PERFEITO (Parry Decisivo / Cinematic Heavy Impact)
  playPerfect() {
    this.stopHoldTone();
    this.ensureContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;

    // Impacto seco triunfante
    this.playClash();

    // Ressonância harmônica expansiva de sino de impacto
    [587.33, 880.00].forEach((freq) => {
      const bell = this.ctx.createOscillator();
      const bellGain = this.ctx.createGain();
      bell.type = 'sine';
      bell.frequency.setValueAtTime(freq, now + 0.02);

      bellGain.gain.setValueAtTime(0.2, now + 0.02);
      bellGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

      bell.connect(bellGain);
      bellGain.connect(this.masterGain);
      bell.start(now + 0.02);
      bell.stop(now + 0.45);
    });
  }

  // 5. ERRO: SOLTOU CEDO DEMAIS (Golpe em falso / Desarme)
  playTooEarly() {
    this.stopHoldTone();
    this.ensureContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;

    // Baque abafado
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.22);

    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.22);
  }

  // 6. ERRO: SEGUROU DEMAIS (Guarda Quebrada / Rompimento de Defesa)
  playTooLate() {
    this.stopHoldTone();
    this.ensureContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;

    // Estalo de impacto excessivo
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.35);

    gain.gain.setValueAtTime(0.65, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.35);

    // Pequeno estrondo de metal raspando
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createPinkNoiseBuffer(0.2);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1600, now);
    filter.Q.setValueAtTime(3.0, now);

    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.35, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(this.masterGain);
    noise.start(now);
  }

  playWrongKey() {
    this.playTooEarly();
  }

  // 7. GOLPE FATAL / MORTE DO PROTAGONISTA
  // Cena sonora em 5 atos: impacto metálico -> glitch digital -> power-down da
  // máquina -> dois últimos batimentos -> flatline no vazio reverberante.
  playDeath() {
    this.stopHeartbeat();
    this.stopHoldTone();
    this.ensureContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const reverb = this.getReverbBus();

    // Roteia um nó para o master e, opcionalmente, para o reverb
    const out = (node, wet = 0) => {
      node.connect(this.masterGain);
      if (wet > 0) {
        const send = this.ctx.createGain();
        send.gain.setValueAtTime(wet, now);
        node.connect(send);
        send.connect(reverb);
      }
    };

    // ---- ATO 1: O IMPACTO (servo-motor acertando o peito) ----

    // 1a. Transiente de metal: ruído varrendo do agudo ao grave
    const crunch = this.ctx.createBufferSource();
    crunch.buffer = this.createPinkNoiseBuffer(0.5);
    const crunchFilter = this.ctx.createBiquadFilter();
    crunchFilter.type = 'bandpass';
    crunchFilter.Q.setValueAtTime(1.1, now);
    crunchFilter.frequency.setValueAtTime(3200, now);
    crunchFilter.frequency.exponentialRampToValueAtTime(220, now + 0.4);

    const crunchGain = this.ctx.createGain();
    crunchGain.gain.setValueAtTime(0.75, now);
    crunchGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

    crunch.connect(crunchFilter);
    crunchFilter.connect(crunchGain);
    out(crunchGain, 0.4);
    crunch.start(now);

    // 1b. Ressonância inarmônica de chapa metálica golpeada
    const partials = [131, 289, 437, 733, 1103];
    partials.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = i < 2 ? 'triangle' : 'sine';

      // Leve desafinação por parcial = timbre metálico, não musical
      const detuned = freq * (1 + (Math.random() * 0.012 - 0.006));
      osc.frequency.setValueAtTime(detuned, now);
      osc.frequency.exponentialRampToValueAtTime(detuned * 0.98, now + 1.5);

      const peak = 0.3 / (i + 1.4);
      const tail = 1.0 + i * 0.14;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(peak, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + tail);

      osc.connect(gain);
      out(gain, 0.45);
      osc.start(now);
      osc.stop(now + tail + 0.05);
    });

    // 1c. Sub-bass sísmico: o chão do impacto
    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(110, now);
    sub.frequency.exponentialRampToValueAtTime(26, now + 1.1);
    subGain.gain.setValueAtTime(0.9, now);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
    sub.connect(subGain);
    out(subGain);
    sub.start(now);
    sub.stop(now + 1.25);

    // ---- ATO 2: GLITCH DIGITAL (a percepção falhando, quadros perdidos) ----
    for (let i = 0; i < 6; i++) {
      const t = now + 0.22 + i * 0.07 + i * i * 0.012;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(1500 * Math.pow(0.68, i), t);

      // Blips curtíssimos e cortados a seco: som de dado corrompido
      const len = 0.035 - i * 0.003;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.085 - i * 0.008, t + 0.004);
      gain.gain.setValueAtTime(0.085 - i * 0.008, t + len);
      gain.gain.linearRampToValueAtTime(0.0001, t + len + 0.006);

      osc.connect(gain);
      out(gain, 0.3);
      osc.start(t);
      osc.stop(t + len + 0.02);
    }

    // ---- ATO 3: POWER-DOWN (a máquina — e você — perdendo energia) ----
    const powerFilter = this.ctx.createBiquadFilter();
    powerFilter.type = 'lowpass';
    powerFilter.frequency.setValueAtTime(1800, now + 0.55);
    powerFilter.frequency.exponentialRampToValueAtTime(160, now + 3.0);

    const powerGain = this.ctx.createGain();
    powerGain.gain.setValueAtTime(0.0001, now + 0.55);
    powerGain.gain.exponentialRampToValueAtTime(0.24, now + 0.8);
    // Sustenta o motor agonizando antes de apagar (decaimento exponencial puro sumiria rápido demais)
    powerGain.gain.linearRampToValueAtTime(0.17, now + 2.3);
    powerGain.gain.exponentialRampToValueAtTime(0.0001, now + 3.2);

    powerFilter.connect(powerGain);
    out(powerGain, 0.5);

    // Duas serras desafinadas = batimento grave e instável, como um motor morrendo
    [0, 3.5].forEach((detune) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.detune.setValueAtTime(detune, now + 0.55);
      osc.frequency.setValueAtTime(210, now + 0.55);
      // Para em 42 Hz: ainda audível como rosnado, em vez de virar subsônico inaudível
      osc.frequency.exponentialRampToValueAtTime(42, now + 3.0);
      osc.connect(powerFilter);
      osc.start(now + 0.55);
      osc.stop(now + 3.15);
    });

    // ---- ATO 4: OS DOIS ÚLTIMOS BATIMENTOS (desacelerando até parar) ----
    const lastBeat = (offset, freq, vol) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = now + offset;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.55, t + 0.3);

      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(vol, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);

      osc.connect(gain);
      out(gain, 0.35);
      osc.start(t);
      osc.stop(t + 0.45);
    };

    lastBeat(1.15, 64, 0.5);
    lastBeat(1.30, 48, 0.34);
    lastBeat(2.25, 58, 0.3);   // Já mais fraco e mais espaçado
    lastBeat(2.42, 44, 0.18);

    // ---- ATO 5: O ZUMBIDO DA SALA (tudo desligado, só a energia parada no ar) ----
    // Um drone grave e escuro, sem nada de estridente: filtro fechado em 320 Hz
    const droneFilter = this.ctx.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.setValueAtTime(320, now + 3.0);
    droneFilter.Q.setValueAtTime(0.7, now + 3.0);

    const droneGain = this.ctx.createGain();
    droneGain.gain.setValueAtTime(0.0001, now + 3.0);
    droneGain.gain.exponentialRampToValueAtTime(0.16, now + 3.6);
    droneGain.gain.setValueAtTime(0.16, now + 5.2);
    droneGain.gain.exponentialRampToValueAtTime(0.0001, now + 6.8);

    droneFilter.connect(droneGain);
    out(droneGain, 0.3);

    // Sub + fundamental + quinta bem discreta: peso e desconforto, sem agudo
    [[49, 0.7], [98, 0.9], [147, 0.22]].forEach(([freq, level]) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + 3.0);
      // Desafinação mínima faz o drone "respirar" em vez de soar sintético e parado
      osc.detune.setValueAtTime(Math.random() * 8 - 4, now + 3.0);
      gain.gain.setValueAtTime(level, now + 3.0);
      osc.connect(gain);
      gain.connect(droneFilter);
      osc.start(now + 3.0);
      osc.stop(now + 6.9);
    });
  }

  // 8. ENTRADA EM SLOW-MOTION COM BATIMENTO CARDÍACO REALISTA
  playSlowmoEnter() {
    this.ensureContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.8);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.8);

    this.startHeartbeat();
  }

  startHeartbeat() {
    this.stopHeartbeat();
    const beat = () => {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      const playThud = (offset, freq, vol) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + offset);
        osc.frequency.exponentialRampToValueAtTime(24, now + offset + 0.12);
        gain.gain.setValueAtTime(vol, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.14);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now + offset);
        osc.stop(now + offset + 0.15);
      };

      playThud(0, 68, 0.45);
      playThud(0.12, 52, 0.32);
    };

    beat();
    this.heartbeatInterval = setInterval(beat, 900);
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // 9. FANFARRA DE VITÓRIA (Acordes épicos aveludados)
  playVictoryFanfare() {
    this.stopHeartbeat();
    this.stopHoldTone();
    this.ensureContext();
    if (!this.ctx) return;

    const chords = [
      [196.00, 246.94, 293.66], // G
      [220.00, 261.63, 329.63], // Am
      [261.63, 329.63, 392.00], // C
      [329.63, 392.00, 523.25]  // E / C high
    ];

    chords.forEach((chord, step) => {
      const stepTime = this.ctx.currentTime + step * 0.24;
      chord.forEach(freq => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, stepTime);
        const duration = step === 3 ? 0.9 : 0.26;
        gain.gain.setValueAtTime(0.18, stepTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, stepTime + duration);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(stepTime);
        osc.stop(stepTime + duration);
      });
    });
  }

  // ==========================================================
  // TRILHA SONORA (BGM)
  // ==========================================================

  getMusicElement() {
    if (!this.music) {
      this.music = document.getElementById('bgm');
    }
    return this.music;
  }

  // Interpola o volume da trilha suavemente ao longo de durationMs
  fadeMusicTo(targetVolume, durationMs = 800, onDone = null) {
    const el = this.getMusicElement();
    if (!el) return;

    if (this.musicFadeInterval) {
      clearInterval(this.musicFadeInterval);
      this.musicFadeInterval = null;
    }

    const startVolume = el.volume;
    const delta = targetVolume - startVolume;
    if (Math.abs(delta) < 0.001 || durationMs <= 0) {
      el.volume = Math.max(0, Math.min(1, targetVolume));
      if (onDone) onDone();
      return;
    }

    const startTime = performance.now();
    this.musicFadeInterval = setInterval(() => {
      const ratio = Math.min(1, (performance.now() - startTime) / durationMs);
      el.volume = Math.max(0, Math.min(1, startVolume + delta * ratio));
      if (ratio >= 1) {
        clearInterval(this.musicFadeInterval);
        this.musicFadeInterval = null;
        if (onDone) onDone();
      }
    }, 40);
  }

  // Inicia a trilha com fade-in. Só reinicia do zero se restart = true.
  startMusic(restart = false) {
    const el = this.getMusicElement();
    if (!el) return;

    this.musicDucked = false;

    if (restart || el.ended) {
      el.currentTime = 0;
    }

    if (el.paused) {
      el.volume = 0;
      const playPromise = el.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => this.fadeMusicTo(this.musicVolume, 1800))
          .catch(() => {
            // Navegador bloqueou o autoplay: toca no próximo gesto do usuário
          });
      } else {
        this.fadeMusicTo(this.musicVolume, 1800);
      }
    } else {
      this.fadeMusicTo(this.musicVolume, 600);
    }
  }

  // Abaixa a trilha para deixar um momento dramático respirar
  duckMusic(level = 0.12, durationMs = 400) {
    if (this.musicDucked) return;
    this.musicDucked = true;
    this.fadeMusicTo(level, durationMs);
  }

  // Devolve a trilha ao volume de cruzeiro
  unduckMusic(durationMs = 700) {
    if (!this.musicDucked) return;
    this.musicDucked = false;
    this.fadeMusicTo(this.musicVolume, durationMs);
  }

  // Fade-out completo e pausa (morte / vitória)
  stopMusic(durationMs = 900) {
    const el = this.getMusicElement();
    if (!el || el.paused) return;

    this.musicDucked = false;
    this.fadeMusicTo(0, durationMs, () => {
      el.pause();
      el.currentTime = 0;
    });
  }
}

window.Sound = new SoundSystem();
