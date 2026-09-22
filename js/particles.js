// Sistema de partículas e efeitos visuais no Canvas

class ParticleSystem {
  constructor() {
    this.particles = [];
    this.shockwaves = [];
    this.slashes = [];
  }

  // Adiciona faíscas de colisão
  spawnSparks(x, y, count = 30, color = '#ffdd44') {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 8;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (Math.random() * 2),
        size: 1.5 + Math.random() * 3,
        alpha: 1,
        decay: 0.02 + Math.random() * 0.04,
        color,
        gravity: 0.15,
        type: 'spark'
      });
    }
  }

  // Adiciona sangue / impacto fatal
  spawnBlood(x, y, count = 40, direction = 1) {
    for (let i = 0; i < count; i++) {
      const angle = (direction > 0 ? 0 : Math.PI) + (Math.random() - 0.5) * 1.5;
      const speed = 3 + Math.random() * 10;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 3,
        size: 2 + Math.random() * 4,
        alpha: 1,
        decay: 0.015 + Math.random() * 0.02,
        color: '#b91c1c',
        gravity: 0.3,
        type: 'blood'
      });
    }
  }

  // Adiciona onda de choque radial
  spawnShockwave(x, y, maxRadius = 150, color = '#ffffff') {
    this.shockwaves.push({
      x,
      y,
      radius: 5,
      maxRadius,
      alpha: 0.9,
      decay: 0.03,
      color,
      lineWidth: 5
    });
  }

  // Adiciona rastro de corte de arma (Slash Arc)
  spawnSlash(x, y, angle, length = 120, color = '#38bdf8') {
    this.slashes.push({
      x,
      y,
      angle,
      length,
      color,
      alpha: 1,
      decay: 0.06,
      curviness: (Math.random() - 0.5) * 40
    });
  }

  update(dt = 1) {
    // Atualiza partículas normais
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
      p.alpha -= p.decay * dt;
      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // Atualiza ondas de choque
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const s = this.shockwaves[i];
      s.radius += (s.maxRadius - s.radius) * 0.15 * dt;
      s.alpha -= s.decay * dt;
      if (s.alpha <= 0 || s.radius >= s.maxRadius * 0.95) {
        this.shockwaves.splice(i, 1);
      }
    }

    // Atualiza slashes
    for (let i = this.slashes.length - 1; i >= 0; i--) {
      const sl = this.slashes[i];
      sl.alpha -= sl.decay * dt;
      if (sl.alpha <= 0) {
        this.slashes.splice(i, 1);
      }
    }
  }

  draw(ctx) {
    ctx.save();

    // Desenha ondas de choque
    for (const s of this.shockwaves) {
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
      ctx.strokeStyle = s.color;
      ctx.globalAlpha = Math.max(0, s.alpha);
      ctx.lineWidth = s.lineWidth * s.alpha;
      ctx.shadowBlur = 15;
      ctx.shadowColor = s.color;
      ctx.stroke();
    }

    // Desenha slashes
    for (const sl of this.slashes) {
      ctx.save();
      ctx.translate(sl.x, sl.y);
      ctx.rotate(sl.angle);
      ctx.beginPath();
      ctx.moveTo(-sl.length / 2, 0);
      ctx.quadraticCurveTo(0, sl.curviness, sl.length / 2, 0);
      ctx.strokeStyle = sl.color;
      ctx.globalAlpha = Math.max(0, sl.alpha);
      ctx.lineWidth = 6 * sl.alpha;
      ctx.shadowBlur = 20;
      ctx.shadowColor = sl.color;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.restore();
    }

    // Desenha partículas
    for (const p of this.particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, p.alpha);
      if (p.type === 'spark') {
        ctx.shadowBlur = 8;
        ctx.shadowColor = p.color;
      }
      ctx.fill();
    }

    ctx.restore();
  }

  clear() {
    this.particles = [];
    this.shockwaves = [];
    this.slashes = [];
  }
}

window.Particles = new ParticleSystem();
