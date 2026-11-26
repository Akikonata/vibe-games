(function () {
  window.KOF = window.KOF || {};

  class EffectsManager {
    constructor() {
      this.particles = [];
      this.sparks = [];
      this.shockwaves = [];
      this.floatTexts = [];
      this.superCutIn = null;
      this.shakeTime = 0;
      this.shakeMag = 0;
      this.shakeDirX = 0;
      this.impactFlash = 0;
      this.impactFlashColor = '#ffffff';
    }

    clear() {
      this.particles = [];
      this.sparks = [];
      this.shockwaves = [];
      this.floatTexts = [];
      this.superCutIn = null;
      this.shakeTime = 0;
      this.shakeMag = 0;
      this.shakeDirX = 0;
      this.impactFlash = 0;
    }

    addShake(frames, magnitude, dirX = 0) {
      this.shakeTime = Math.max(this.shakeTime, frames);
      this.shakeMag = Math.max(this.shakeMag, magnitude);
      this.shakeDirX = dirX;
    }

    triggerFlash(frames = 4, color = '#ffffff') {
      this.impactFlash = Math.max(this.impactFlash, frames);
      this.impactFlashColor = color;
    }

    spawnShockwave(x, y, color = '#fde047', maxRadius = 85, life = 14) {
      this.shockwaves.push({ x, y, color, maxRadius, life, maxLife: life });
    }

    spawnHitSpark(x, y, color = '#fbbf24', heavy = false, pushDir = 1) {
      this.sparks.push({
        x,
        y,
        color,
        life: heavy ? 15 : 10,
        maxLife: heavy ? 15 : 10,
        radius: heavy ? 58 : 34,
        heavy,
        type: 'hit'
      });

      if (heavy) {
        this.spawnShockwave(x, y, color, 92, 13);
        this.spawnShockwave(x, y, '#ffffff', 58, 9);
      }

      const count = heavy ? 22 : 11;
      for (let i = 0; i < count; i++) {
        // Bias sparks to burst dramatically in the direction of the blow!
        const spread = (Math.random() - 0.5) * (heavy ? 1.8 : 2.4);
        const baseAngle = pushDir >= 0 ? 0 : Math.PI;
        const angle = i < count * 0.65 ? baseAngle + spread : Math.random() * Math.PI * 2;
        const speed = (heavy ? 8 : 5) + Math.random() * (heavy ? 10 : 6);
        this.particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - (heavy ? 2 : 0.8),
          size: (heavy ? 5.5 : 3.5) + Math.random() * 3.5,
          color: i % 3 === 0 ? '#ffffff' : i % 3 === 1 ? '#fef08a' : color,
          life: 12 + Math.floor(Math.random() * 12),
          maxLife: 24,
          gravity: 0.22,
          streak: true
        });
      }
    }

    spawnBlockSpark(x, y) {
      this.sparks.push({
        x,
        y,
        color: '#38bdf8',
        life: 10,
        maxLife: 10,
        radius: 34,
        heavy: false,
        type: 'block'
      });
      for (let i = 0; i < 8; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 3 + Math.random() * 4;
        this.particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: 3.5,
          color: i % 2 === 0 ? '#e0f2fe' : '#38bdf8',
          life: 12,
          maxLife: 12,
          gravity: 0.05
        });
      }
    }

    spawnDust(x, y, dir = 1, count = 6) {
      for (let i = 0; i < count; i++) {
        this.particles.push({
          x: x + (Math.random() - 0.5) * 24,
          y: y - Math.random() * 8,
          vx: -dir * (1 + Math.random() * 3) + (Math.random() - 0.5) * 2,
          vy: -1 - Math.random() * 2.5,
          size: 5 + Math.random() * 5,
          color: 'rgba(226, 232, 240, 0.55)',
          life: 16 + Math.floor(Math.random() * 10),
          maxLife: 26,
          gravity: -0.02
        });
      }
    }

    spawnFlameTrail(x, y, color, coreColor = '#fef08a') {
      for (let i = 0; i < 3; i++) {
        this.particles.push({
          x: x + (Math.random() - 0.5) * 20,
          y: y + (Math.random() - 0.5) * 20,
          vx: (Math.random() - 0.5) * 2.5,
          vy: -1.5 - Math.random() * 2.5,
          size: 7 + Math.random() * 6,
          color: i === 0 ? coreColor : color,
          life: 14 + Math.floor(Math.random() * 8),
          maxLife: 22,
          gravity: -0.05
        });
      }
    }

    spawnFloatText(x, y, text, color = '#fde047') {
      this.floatTexts.push({
        x,
        y,
        text,
        color,
        life: 38,
        maxLife: 38
      });
    }

    triggerSuperCutIn(fighter, moveName) {
      let img = window.KOF.PORTRAITS && window.KOF.PORTRAITS[fighter.config.id];
      if (!img && fighter.config.portrait) {
        img = new Image();
        img.src = fighter.config.portrait;
      }
      this.superCutIn = {
        name: fighter.config.name,
        moveName,
        badge: fighter.config.badge,
        color: fighter.config.colors.primary,
        side: fighter.playerIndex,
        img,
        life: 38,
        maxLife: 38
      };
    }

    update() {
      if (this.shakeTime > 0) {
        this.shakeTime--;
        if (this.shakeTime === 0) {
          this.shakeMag = 0;
          this.shakeDirX = 0;
        }
      }
      if (this.impactFlash > 0) this.impactFlash--;

      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.gravity;
        p.vx *= 0.96;
        p.life--;
        if (p.life <= 0) this.particles.splice(i, 1);
      }

      for (let i = this.sparks.length - 1; i >= 0; i--) {
        this.sparks[i].life--;
        if (this.sparks[i].life <= 0) this.sparks.splice(i, 1);
      }

      for (let i = this.shockwaves.length - 1; i >= 0; i--) {
        this.shockwaves[i].life--;
        if (this.shockwaves[i].life <= 0) this.shockwaves.splice(i, 1);
      }

      for (let i = this.floatTexts.length - 1; i >= 0; i--) {
        const ft = this.floatTexts[i];
        ft.y -= 1.35;
        ft.life--;
        if (ft.life <= 0) this.floatTexts.splice(i, 1);
      }

      if (this.superCutIn) {
        this.superCutIn.life--;
        if (this.superCutIn.life <= 0) this.superCutIn = null;
      }
    }

    getShakeOffset() {
      if (this.shakeTime <= 0) return { x: 0, y: 0 };
      const factor = this.shakeMag * Math.min(1.4, this.shakeTime / 9);
      const recoil = this.shakeDirX * factor * 0.55;
      return {
        x: (Math.random() - 0.5) * 2 * factor + recoil,
        y: (Math.random() - 0.5) * 1.7 * factor
      };
    }

    drawWorld(ctx) {
      // Expanding Shockwave Rings
      for (const sw of this.shockwaves) {
        const prog = 1 - sw.life / sw.maxLife;
        const r = 12 + sw.maxRadius * (1 - Math.pow(1 - prog, 2.2));
        ctx.save();
        ctx.globalAlpha = (1 - prog) * 0.85;
        ctx.strokeStyle = sw.color;
        ctx.lineWidth = Math.max(1.5, 7 * (1 - prog));
        ctx.shadowColor = sw.color;
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Particles (stretched motion streaks for impact sparks!)
      for (const p of this.particles) {
        const alpha = Math.max(0, p.life / p.maxLife);
        ctx.save();
        ctx.globalAlpha = alpha;
        if (p.streak) {
          ctx.strokeStyle = p.color;
          ctx.lineWidth = Math.max(1.5, p.size * 0.6 * alpha);
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 2.2, p.y - p.vy * 2.2);
          ctx.stroke();
        } else {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (0.4 + alpha * 0.6), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // Sparks
      for (const s of this.sparks) {
        const progress = 1 - s.life / s.maxLife;
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.globalAlpha = 1 - progress;
        if (s.type === 'block') {
          ctx.strokeStyle = s.color;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(0, 0, s.radius * (0.4 + progress * 0.8), 0, Math.PI * 2);
          ctx.stroke();
        } else {
          // Arcade starburst
          ctx.strokeStyle = s.color;
          ctx.lineWidth = s.heavy ? 4 : 2.5;
          const rays = s.heavy ? 10 : 7;
          for (let i = 0; i < rays; i++) {
            const ang = (Math.PI * 2 * i) / rays + progress * 0.4;
            const r1 = s.radius * 0.2;
            const r2 = s.radius * (0.6 + progress * 0.8);
            ctx.beginPath();
            ctx.moveTo(Math.cos(ang) * r1, Math.sin(ang) * r1);
            ctx.lineTo(Math.cos(ang) * r2, Math.sin(ang) * r2);
            ctx.stroke();
          }
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(0, 0, (s.heavy ? 14 : 9) * (1 - progress), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // Floating texts
      for (const ft of this.floatTexts) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, ft.life / 12);
        ctx.font = '900 18px "PingFang SC", sans-serif';
        ctx.textAlign = 'center';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 4;
        ctx.strokeText(ft.text, ft.x, ft.y);
        ctx.fillStyle = ft.color;
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.restore();
      }
    }

    drawScreenOverlay(ctx, w, h) {
      // Brief screen impact flash on heavy/counter/KO blows
      if (this.impactFlash > 0) {
        ctx.save();
        ctx.globalAlpha = Math.min(0.28, this.impactFlash * 0.06);
        ctx.fillStyle = this.impactFlashColor;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
      }

      if (!this.superCutIn) return;
      const c = this.superCutIn;
      const alpha = Math.min(1, c.life / 10);

      ctx.save();
      ctx.fillStyle = `rgba(4, 6, 16, ${0.58 * alpha})`;
      ctx.fillRect(0, 0, w, h);

      // Dramatic diagonal speed banner
      const bandY = h * 0.36;
      ctx.globalAlpha = alpha;
      const grad = ctx.createLinearGradient(0, bandY, w, bandY + 120);
      grad.addColorStop(0, 'rgba(0,0,0,0.92)');
      grad.addColorStop(0.5, c.color);
      grad.addColorStop(1, 'rgba(0,0,0,0.92)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, bandY, w, 118);

      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, bandY);
      ctx.lineTo(w, bandY);
      ctx.moveTo(0, bandY + 118);
      ctx.lineTo(w, bandY + 118);
      ctx.stroke();

      // Draw character portrait cut-in inside the Super banner!
      if (c.img && c.img.complete && c.img.naturalWidth > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, bandY, w, 118);
        ctx.clip();
        const px = c.side === 0 ? 70 : w - 250;
        ctx.drawImage(c.img, px, bandY - 24, 180, 180);
        ctx.restore();
      }

      ctx.fillStyle = '#fff';
      ctx.font = 'italic 900 20px "PingFang SC", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`MAX DESPERATION MOVE — ${c.name}`, w / 2, bandY + 38);

      ctx.font = 'italic 900 44px "PingFang SC", sans-serif';
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#fef08a';
      ctx.fillText(c.moveName, w / 2, bandY + 92);
      ctx.restore();
    }
  }

  window.KOF.EffectsManager = EffectsManager;
})();
