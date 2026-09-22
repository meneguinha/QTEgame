// Orquestrador do Jogo Cinematográfico Interativo (FMV + QTE)
// Cenário: O Pesquisador vs Robô de IA no Datacenter

class VideoController {
  constructor() {
    this.videoA = document.getElementById('videoA');
    this.videoB = document.getElementById('videoB');
    this.activeVideo = this.videoA;
    this.inactiveVideo = this.videoB;

    this.onClimaxCallback = null;
    this.onEndedCallback = null;
    this.climaxFired = false;

    this.videoA.addEventListener('timeupdate', () => this.handleTimeUpdate(this.videoA));
    this.videoB.addEventListener('timeupdate', () => this.handleTimeUpdate(this.videoB));

    this.videoA.addEventListener('ended', () => this.handleEnded(this.videoA));
    this.videoB.addEventListener('ended', () => this.handleEnded(this.videoB));
  }

  play(src, onClimax = null, onEnded = null, freezeAtClimax = true) {
    this.onClimaxCallback = onClimax;
    this.onEndedCallback = onEnded;
    this.freezeAtClimax = freezeAtClimax;
    this.climaxFired = false;

    const next = (this.activeVideo === this.videoA) ? this.videoB : this.videoA;
    const prev = this.activeVideo;

    next.src = src;
    next.currentTime = 0;
    next.muted = false;

    const playPromise = next.play();
    if (playPromise !== undefined) {
      playPromise.then(() => {
        next.classList.add('active');
        prev.classList.remove('active');
        this.activeVideo = next;
        this.inactiveVideo = prev;
        prev.pause();
      }).catch(() => {
        // Fallback para autoplay com som restrito pelo navegador
        next.muted = true;
        next.play().then(() => {
          next.classList.add('active');
          prev.classList.remove('active');
          this.activeVideo = next;
          this.inactiveVideo = prev;
          prev.pause();
        });
      });
    }
  }

  handleTimeUpdate(video) {
    if (video !== this.activeVideo) return;
    if (this.onClimaxCallback && !this.climaxFired && video.duration) {
      // Dispara o clímax/QTE nos momentos finais do clipe
      const threshold = Math.max(0.1, video.duration - 0.7);
      if (video.currentTime >= threshold) {
        this.climaxFired = true;
        if (this.freezeAtClimax) {
          video.pause();
        }
        this.onClimaxCallback();
      }
    }
  }

  handleEnded(video) {
    if (video !== this.activeVideo) return;
    if (this.onEndedCallback) {
      this.onEndedCallback();
    }
  }

  pause() {
    if (this.activeVideo) this.activeVideo.pause();
  }

  resume() {
    if (this.activeVideo) this.activeVideo.play();
  }
}

class Game {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');

    this.container = document.getElementById('game-container');
    this.flashOverlay = document.getElementById('flash-overlay');
    this.deathOverlay = document.getElementById('death-overlay');

    // Telas de Overlay
    this.startScreen = document.getElementById('start-screen');
    this.gameoverScreen = document.getElementById('gameover-screen');
    this.victoryScreen = document.getElementById('victory-screen');

    // Botões
    this.btnStart = document.getElementById('btn-start');
    this.btnRetry = document.getElementById('btn-retry');
    this.btnRestart = document.getElementById('btn-restart');

    // Textos informativos
    this.deathReason = document.getElementById('death-reason');
    this.deathDetails = document.getElementById('death-details');
    this.statsPanel = document.getElementById('stats-panel');

    // Gerenciador QTE e Player de Vídeo
    this.qte = new window.QTEManager();
    this.video = new VideoController();

    // Vídeos do confronto
    this.videoClips = {
      intro: 'videos/01_intro.mp4',
      step_w: 'videos/02_step_w.mp4',
      step_d: 'videos/03_step_d.mp4',
      step_s: 'videos/04_step_s.mp4',
      victory: 'videos/05_victory.mp4',
      death: 'videos/06_death.mp4'
    };

    // Estado do jogo
    this.state = 'START_SCREEN';
    this.lastFrameTime = performance.now();

    this.resizeCanvas();
    this.bindEvents();
    this.setupQTECallbacks();

    // Loop de partículas e efeitos
    requestAnimationFrame((t) => this.gameLoop(t));
  }

  resizeCanvas() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
  }

  bindEvents() {
    window.addEventListener('resize', () => this.resizeCanvas());

    this.btnStart.addEventListener('click', () => {
      window.Sound.init();
      this.startFight();
    });

    this.btnRetry.addEventListener('click', () => {
      this.startFight();
    });

    this.btnRestart.addEventListener('click', () => {
      this.startFight();
    });

    // Primeiro gesto do usuário libera o áudio e já sobe a trilha na tela inicial
    const unlockAudio = () => {
      window.Sound.init();
      if (this.state === 'START_SCREEN') window.Sound.startMusic();
    };
    window.addEventListener('keydown', unlockAudio, { once: true });
    window.addEventListener('mousedown', unlockAudio, { once: true });
  }

  setupQTECallbacks() {
    // Acerto de cada passo do QTE
    this.qte.onStepSuccess = (stepIndex, stepData) => {
      this.pulseHit(0.2);
      window.Sound.unduckMusic();
      const centerX = this.width * 0.5;
      const centerY = this.height * 0.5;

      switch (stepIndex) {
        case 0: // W acertado -> Bloqueio e Empurrão
          window.Particles.spawnSparks(centerX, centerY, 35, '#38bdf8');
          window.Particles.spawnShockwave(centerX, centerY, 140, '#38bdf8');

          // Toca o vídeo do resultado do W e prepara o D no final
          this.video.play(
            this.videoClips.step_w,
            () => {
              // Ao atingir o clímax da cena W: desacelera e ativa a tecla D!
              window.Sound.playSlowmoEnter();
              window.Sound.duckMusic();
              this.qte.isActive = true;
              this.qte.loadStep(1);
              this.qte.hudElement.classList.remove('hidden');
            },
            null,
            true
          );
          break;

        case 1: // D acertado -> Esquiva Ágil Deslizando
          window.Particles.spawnSlash(centerX, centerY, 0.4, 180, '#38bdf8');
          window.Sound.playWhoosh();

          // Toca o vídeo da esquiva D e prepara o S no final
          this.video.play(
            this.videoClips.step_d,
            () => {
              // Ao atingir o clímax da cena D: ativa a tecla S!
              window.Sound.playSlowmoEnter();
              window.Sound.duckMusic();
              this.qte.isActive = true;
              this.qte.loadStep(2);
              this.qte.hudElement.classList.remove('hidden');
            },
            null,
            true
          );
          break;

        case 2: // S acertado -> Rasteira / Ataque no Joelho Hidráulico
          window.Particles.spawnSparks(centerX, centerY + 80, 40, '#f59e0b');
          window.Particles.spawnShockwave(centerX, centerY + 80, 150, '#f59e0b');

          // Toca o vídeo da rasteira S e prepara o A no final
          this.video.play(
            this.videoClips.step_s,
            () => {
              // Ao atingir o clímax da cena S: ativa o golpe finalizador A!
              window.Sound.playSlowmoEnter();
              window.Sound.duckMusic();
              this.qte.isActive = true;
              this.qte.loadStep(3);
              this.qte.hudElement.classList.remove('hidden');
            },
            null,
            true
          );
          break;

        case 3: // A acertado -> Desativação e Vitória!
          window.Particles.spawnSlash(centerX, centerY, -0.6, 260, '#00ffaa');
          window.Particles.spawnShockwave(centerX, centerY, 240, '#00ffaa');
          window.Sound.playClash();

          // Toca o vídeo da vitória final (05_victory.mp4)
          this.video.play(
            this.videoClips.victory,
            null,
            () => {
              // Quando o vídeo da vitória termina: exibe a tela de vitória
              this.handleVictory();
            },
            false
          );
          break;
      }
    };

    // Acerto de UMA das teclas de um golpe duplo: só o impacto, sem aviso escrito
    this.qte.onLaneSuccess = () => {
      this.pulseHit(0.12);
    };

    // Erro em qualquer momento -> Vídeo de Derrota e Morte
    this.qte.onFail = (stepIndex, reason, details) => {
      this.handlePlayerDeath(stepIndex, reason, details);
    };

    // Sucesso em todos os 4 passos
    this.qte.onComplete = (results) => {
      this.victoryResults = results;
    };
  }

  startFight() {
    this.startScreen.classList.add('hidden');
    this.gameoverScreen.classList.add('hidden');
    this.victoryScreen.classList.add('hidden');
    this.deathOverlay.style.opacity = '0';
    this.qte.stop();
    window.Particles.clear();

    this.state = 'PLAYING_VIDEO';
    window.Sound.startMusic(true);

    // Inicia reproduzindo o vídeo de introdução da luta (01_intro.mp4)
    this.video.play(
      this.videoClips.intro,
      () => {
        // Ao atingir o clímax do choque inicial: pausa no frame dramático e ativa o QTE (tecla W)!
        window.Sound.playSlowmoEnter();
        window.Sound.duckMusic();
        this.state = 'QTE_ACTIVE';
        this.qte.start();
      },
      null,
      true // Congela no clímax do confronto
    );
  }

  handlePlayerDeath(stepIndex, reason, details) {
    this.state = 'DEATH_SCENE';
    this.deathOverlay.style.opacity = '0.9';
    window.Sound.playDeath();
    window.Sound.stopMusic(1400);  // Dissolve na cena de morte em vez de cortar seco

    const centerX = this.width * 0.5;
    const centerY = this.height * 0.5;
    window.Particles.spawnBlood(centerX, centerY, 60, -1);
    window.Particles.spawnShockwave(centerX, centerY, 240, '#ef4444');

    this.deathReason.textContent = reason;
    this.deathDetails.textContent = details;

    // Toca imediatamente o vídeo da derrota (06_death.mp4)
    this.video.play(
      this.videoClips.death,
      null,
      () => {
        // Ao finalizar a animação do robô vencendo: exibe a tela de Game Over
        setTimeout(() => {
          this.gameoverScreen.classList.remove('hidden');
        }, 500);
      },
      false
    );
  }

  handleVictory() {
    this.state = 'VICTORY_SCENE';
    window.Sound.stopMusic(800);
    window.Sound.playVictoryFanfare();

    // Preenche estatísticas
    this.statsPanel.innerHTML = '';
    const results = this.victoryResults || this.qte.results || [];
    results.forEach((res) => {
      const card = document.createElement('div');
      card.className = 'stat-card';
      card.innerHTML = `
        <span class="stat-key">[${res.key}]</span>
        <span class="stat-timing">${res.actualMs}ms / ${res.targetMs}ms</span>
        <span class="stat-badge">${res.rating} (±${res.deviationMs}ms)</span>
      `;
      this.statsPanel.appendChild(card);
    });

    setTimeout(() => {
      this.victoryScreen.classList.remove('hidden');
    }, 600);
  }

  // Impacto de acerto: um brilho curto e uma tremida, sem texto na tela
  pulseHit(intensity = 0.18) {
    this.flashScreen(intensity);

    this.container.classList.remove('hit-shake');
    // Força o reinício da animação quando dois acertos vêm em sequência
    void this.container.offsetWidth;
    this.container.classList.add('hit-shake');

    setTimeout(() => {
      this.container.classList.remove('hit-shake');
    }, 220);
  }

  flashScreen(intensity = 0.4) {
    this.flashOverlay.style.opacity = intensity;
    setTimeout(() => {
      this.flashOverlay.style.opacity = '0';
    }, 90);
  }

  update(dt, now) {
    window.Particles.update(dt);

    if (this.state === 'QTE_ACTIVE' || this.qte.isActive) {
      this.qte.update(now);
    }
  }

  render() {
    // O Canvas fica transparente desenhando apenas as partículas e faíscas sobre o vídeo
    this.ctx.clearRect(0, 0, this.width, this.height);
    window.Particles.draw(this.ctx);
  }

  gameLoop(timestamp) {
    const elapsedMs = timestamp - this.lastFrameTime;
    this.lastFrameTime = timestamp;

    const dt = Math.min(2.0, elapsedMs / 16.666);

    this.update(dt, timestamp);
    this.render();

    requestAnimationFrame((t) => this.gameLoop(t));
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.gameInstance = new Game();
});
