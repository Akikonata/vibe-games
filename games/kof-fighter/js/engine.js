(function () {
  window.KOF = window.KOF || {};

  const WORLD_WIDTH = 1440;
  const VIEW_WIDTH = 1120;
  const VIEW_HEIGHT = 580;
  const FLOOR_Y = 505;
  const ROUND_TIME = 99;

  function boxesOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  class GameEngine {
    constructor(canvas, hudCallbacks) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.hud = hudCallbacks;
      this.effects = new window.KOF.EffectsManager();

      this.mode = 'pve'; // 'pve' | 'pvp'
      this.stage = window.KOF.STAGES[0];
      this.fighters = [];
      this.projectiles = [];
      this.ai = new window.KOF.AIController('normal');

      this.running = false;
      this.paused = false;
      this.rafId = null;
      this.lastTimestamp = 0;
      this.accumulator = 0;
      this.fixedDt = 1000 / 60;

      this.frameCount = 0;
      this.roundNumber = 1;
      this.roundTimer = ROUND_TIME;
      this.timerFrames = 0;
      this.phase = 'idle'; // intro, fight, ko, roundEnd, matchEnd
      this.phaseTimer = 0;

      this.hitstopFrames = 0;
      this.superFreezeFrames = 0;
      this.slowMoTimer = 0;
      this.camX = (WORLD_WIDTH - VIEW_WIDTH) / 2;
      this.camZoom = 1.0;
      this.camZoomTarget = 1.0;
      this.zoomFocusX = VIEW_WIDTH / 2;
      this.zoomFocusY = FLOOR_Y - 100;
    }

    triggerCameraPunch(zoomLevel, worldX, worldY) {
      this.camZoom = Math.max(this.camZoom, zoomLevel);
      this.zoomFocusX = Math.max(180, Math.min(VIEW_WIDTH - 180, worldX - this.camX));
      this.zoomFocusY = Math.max(140, Math.min(VIEW_HEIGHT - 120, worldY));
    }

    startMatch({ mode, p1CharId, p2CharId, stageId, difficulty }) {
      this.mode = mode;
      this.stage = window.KOF.getStageById(stageId);
      this.ai.setDifficulty(difficulty || 'normal');

      const c1 = window.KOF.getCharacterById(p1CharId);
      const c2 = window.KOF.getCharacterById(p2CharId);

      this.fighters = [
        new window.KOF.Fighter(c1, 0, 500, FLOOR_Y),
        new window.KOF.Fighter(c2, 1, 940, FLOOR_Y)
      ];
      this.roundNumber = 1;
      this.paused = false;
      this.running = true;

      this.hud.onMatchInit(this.fighters[0], this.fighters[1], this.mode);
      this.startRound();

      window.KOF.audio.startBgm();
      this.lastTimestamp = performance.now();
      this.accumulator = 0;
      if (this.rafId) cancelAnimationFrame(this.rafId);
      this.loop(this.lastTimestamp);
    }

    startRound() {
      this.projectiles = [];
      this.effects.clear();
      this.fighters[0].resetForRound(500, 1);
      this.fighters[1].resetForRound(940, -1);
      this.roundTimer = ROUND_TIME;
      this.timerFrames = 0;
      this.hitstopFrames = 0;
      this.superFreezeFrames = 0;
      this.slowMoTimer = 0;
      this.camX = (WORLD_WIDTH - VIEW_WIDTH) / 2;

      this.phase = 'intro';
      this.phaseTimer = 95;
      this.hud.showAnnouncement(`ROUND ${this.roundNumber}`, 'READY...');
      window.KOF.audio.roundAnnounce();
      this.syncHud();
    }

    stop() {
      this.running = false;
      if (this.rafId) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
      window.KOF.audio.stopBgm();
    }

    setPaused(val) {
      this.paused = val;
      if (!val) {
        this.lastTimestamp = performance.now();
      }
    }

    canControlFighters() {
      return this.phase === 'fight';
    }

    spawnProjectile(owner, move) {
      this.projectiles.push({
        owner,
        x: owner.x + owner.facing * 52,
        y: move.projGround ? FLOOR_Y - 26 : owner.y - 88,
        vx: owner.facing * (move.projSpeed || 10),
        radius: move.projGround ? 24 : 20,
        damage: move.damage,
        chip: move.chip || 14,
        color: owner.config.colors.primary,
        coreColor: owner.config.colors.flameCore,
        ground: !!move.projGround,
        life: 110,
        move
      });
    }

    loop(now) {
      if (!this.running) return;
      this.rafId = requestAnimationFrame((t) => this.loop(t));

      if (this.paused) return;

      const elapsed = Math.min(50, now - this.lastTimestamp);
      this.lastTimestamp = now;
      this.accumulator += elapsed;

      while (this.accumulator >= this.fixedDt) {
        this.step();
        this.accumulator -= this.fixedDt;
      }

      this.render();
    }

    step() {
      this.frameCount++;

      // Dramatic slow motion on K.O.
      if (this.slowMoTimer > 0) {
        this.slowMoTimer--;
        if (this.frameCount % 3 !== 0) {
          this.effects.update();
          return;
        }
      }

      // Super freeze pause (lets cut-in play dramatically)
      if (this.superFreezeFrames > 0) {
        this.superFreezeFrames--;
        this.effects.update();
        return;
      }

      // Hitstop impact freeze (defender still trembles during freeze!)
      if (this.hitstopFrames > 0) {
        this.hitstopFrames--;
        for (const f of this.fighters) {
          if (f.hitShakeFrames > 0) f.hitShakeFrames--;
        }
        this.effects.update();
        return;
      }

      // Smoothly decay camera punch-zoom back to 1.0
      this.camZoom += (this.camZoomTarget - this.camZoom) * 0.16;
      if (Math.abs(this.camZoom - 1.0) < 0.001) this.camZoom = 1.0;

      for (const f of this.fighters) {
        if (f.hitShakeFrames > 0) f.hitShakeFrames--;
      }

      // Phase transitions
      if (this.phase === 'intro') {
        this.phaseTimer--;
        if (this.phaseTimer === 28) {
          this.hud.showAnnouncement('FIGHT!', '');
          window.KOF.audio.uiConfirm();
        }
        if (this.phaseTimer <= 0) {
          this.phase = 'fight';
          this.hud.hideAnnouncement();
        }
      } else if (this.phase === 'fight') {
        this.timerFrames++;
        if (this.timerFrames >= 60) {
          this.timerFrames = 0;
          if (this.roundTimer > 0) this.roundTimer--;
          if (this.roundTimer === 0) {
            this.finishRoundByTimeout();
          }
        }
      } else if (this.phase === 'ko' || this.phase === 'roundEnd') {
        this.phaseTimer--;
        if (this.phaseTimer <= 0) {
          this.advanceAfterRound();
        }
      }

      const [p1, p2] = this.fighters;
      const in1 = this.hud.getPlayerInput(0);
      const in2 = this.mode === 'pvp' ? this.hud.getPlayerInput(1) : this.ai.computeInput(p2, p1, this.projectiles);

      p1.update(in1, p2, this);
      p2.update(in2, p1, this);

      // Pushbox separation (prevent fighters overlapping unless rolling)
      if (p1.state !== 'roll' && p2.state !== 'roll') {
        const minSep = 54;
        const dx = p2.x - p1.x;
        const absDx = Math.abs(dx);
        if (absDx < minSep && Math.abs(p1.y - p2.y) < 100) {
          const push = (minSep - absDx) / 2;
          const dir = dx >= 0 ? 1 : -1;
          p1.x = Math.max(70, Math.min(1370, p1.x - dir * push));
          p2.x = Math.max(70, Math.min(1370, p2.x + dir * push));
        }
      }

      // Resolve melee hits
      if (this.phase === 'fight') {
        this.resolveMeleeHit(p1, p2, in2);
        this.resolveMeleeHit(p2, p1, in1);
      }

      // Update projectiles
      this.updateProjectiles(in1, in2);

      // Check K.O.
      if (this.phase === 'fight' && (p1.hp <= 0 || p2.hp <= 0)) {
        this.triggerKO();
      }

      // Smooth camera tracking
      const midX = (p1.x + p2.x) / 2;
      const targetCam = Math.max(0, Math.min(WORLD_WIDTH - VIEW_WIDTH, midX - VIEW_WIDTH / 2));
      this.camX += (targetCam - this.camX) * 0.14;

      this.effects.update();
      this.syncHud();
    }

    resolveMeleeHit(attacker, defender, defenderInput) {
      if (defender.invincibleFrames > 0 || defender.state === 'knockdown' || defender.state === 'ko') return;
      const hitbox = attacker.getActiveHitbox();
      if (!hitbox) return;

      const hurtbox = defender.getHurtbox();
      if (!boxesOverlap(hitbox, hurtbox)) return;

      const move = attacker.currentMove;
      if (move.multiHit) {
        attacker.multiHitCount++;
        attacker.nextMultiHitFrame = attacker.moveFrame + 4;
      }
      attacker.moveHasHit = true;

      const blocked = defender.isBlocking(defenderInput, attacker.x, move.level || 'mid');
      defender.takeHit(move, attacker, blocked, this);
    }

    updateProjectiles(in1, in2) {
      const [p1, p2] = this.fighters;
      for (let i = this.projectiles.length - 1; i >= 0; i--) {
        const proj = this.projectiles[i];
        proj.x += proj.vx;
        proj.life--;

        if (this.frameCount % 2 === 0) {
          this.effects.spawnFlameTrail(proj.x, proj.y, proj.color, proj.coreColor);
        }

        // Check projectile vs projectile clash
        let destroyed = false;
        for (let j = i - 1; j >= 0; j--) {
          const other = this.projectiles[j];
          if (other.owner !== proj.owner && Math.hypot(proj.x - other.x, proj.y - other.y) < proj.radius + other.radius) {
            this.effects.spawnHitSpark((proj.x + other.x) / 2, (proj.y + other.y) / 2, '#fde047', true);
            window.KOF.audio.block();
            this.projectiles.splice(i, 1);
            this.projectiles.splice(j, 1);
            i--;
            destroyed = true;
            break;
          }
        }
        if (destroyed) continue;

        // Check hit on opponent
        const target = proj.owner === p1 ? p2 : p1;
        const targetInput = proj.owner === p1 ? in2 : in1;
        if (
          this.phase === 'fight' &&
          target.invincibleFrames <= 0 &&
          target.state !== 'knockdown' &&
          target.state !== 'ko'
        ) {
          const pBox = { x: proj.x - proj.radius, y: proj.y - proj.radius, w: proj.radius * 2, h: proj.radius * 2 };
          if (boxesOverlap(pBox, target.getHurtbox())) {
            const blocked = target.isBlocking(targetInput, proj.x, proj.ground ? 'mid' : 'mid');
            target.takeHit(
              { damage: proj.damage, chip: proj.chip, hitstun: 18, blockstun: 12, knockback: 8, push: 7, powerGain: 8, heavy: true },
              proj.owner,
              blocked,
              this
            );
            this.projectiles.splice(i, 1);
            continue;
          }
        }

        if (proj.life <= 0 || proj.x < 20 || proj.x > WORLD_WIDTH - 20) {
          this.projectiles.splice(i, 1);
        }
      }
    }

    triggerKO() {
      const [p1, p2] = this.fighters;
      this.phase = 'ko';
      this.phaseTimer = 115;
      this.slowMoTimer = 36;
      this.effects.addShake(18, 12);
      window.KOF.audio.ko();

      if (p1.hp <= 0 && p2.hp <= 0) {
        this.hud.showAnnouncement('DOUBLE K.O.!', '平局');
      } else if (p2.hp <= 0) {
        p1.wins++;
        p1.state = 'victory';
        const isPerfect = p1.hp === p1.maxHp;
        this.hud.showAnnouncement('K.O.!', isPerfect ? 'PERFECT VICTORY!' : `${p1.config.name} WINS!`);
      } else {
        p2.wins++;
        p2.state = 'victory';
        const isPerfect = p2.hp === p2.maxHp;
        this.hud.showAnnouncement('K.O.!', isPerfect ? 'PERFECT VICTORY!' : `${p2.config.name} WINS!`);
      }
    }

    finishRoundByTimeout() {
      const [p1, p2] = this.fighters;
      this.phase = 'roundEnd';
      this.phaseTimer = 100;
      const r1 = p1.hp / p1.maxHp;
      const r2 = p2.hp / p2.maxHp;

      if (r1 > r2) {
        p1.wins++;
        p1.state = 'victory';
        this.hud.showAnnouncement('TIME OVER', `${p1.config.name} WINS!`);
      } else if (r2 > r1) {
        p2.wins++;
        p2.state = 'victory';
        this.hud.showAnnouncement('TIME OVER', `${p2.config.name} WINS!`);
      } else {
        this.hud.showAnnouncement('TIME OVER', 'DRAW GAME');
      }
    }

    advanceAfterRound() {
      const [p1, p2] = this.fighters;
      if (p1.wins >= 2 || p2.wins >= 2) {
        this.phase = 'matchEnd';
        this.hud.hideAnnouncement();
        const winner = p1.wins >= 2 ? p1 : p2;
        this.hud.onMatchEnd(winner, p1, p2);
      } else {
        this.roundNumber++;
        this.startRound();
      }
    }

    syncHud() {
      this.hud.onTick(this.fighters[0], this.fighters[1], this.roundNumber, this.roundTimer);
    }

    render() {
      const ctx = this.ctx;
      const shake = this.effects.getShakeOffset();

      ctx.save();
      ctx.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

      // Apply micro camera punch-zoom on heavy/counter/KO impacts!
      if (this.camZoom > 1.001) {
        ctx.translate(this.zoomFocusX, this.zoomFocusY);
        ctx.scale(this.camZoom, this.camZoom);
        ctx.translate(-this.zoomFocusX, -this.zoomFocusY);
      }

      // Draw animated stage
      this.stage.draw(ctx, VIEW_WIDTH, VIEW_HEIGHT, FLOOR_Y, this.frameCount, this.camX);

      // World space camera transform
      ctx.save();
      ctx.translate(-this.camX + shake.x, shake.y);

      // Draw fighters
      for (const f of this.fighters) {
        f.draw(ctx);
      }

      // Draw signature character projectiles with rich arcade VFX
      for (const p of this.projectiles) {
        const ownerId = p.owner.config.id;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 24;

        if (ownerId === 'mai') {
          // Spinning Flaming Sakura Paper Fan!
          ctx.rotate(this.frameCount * 0.45 * Math.sign(p.vx));
          ctx.fillStyle = '#f43f5e';
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.arc(0, 0, 28, -0.75, 0.75);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = '#fef08a';
          ctx.lineWidth = 3;
          ctx.stroke();
        } else if (ownerId === 'shermie') {
          // Crackling Orochi Lightning Orb!
          ctx.fillStyle = '#38bdf8';
          ctx.beginPath();
          ctx.arc(0, 0, 22, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2.5;
          for (let k = 0; k < 5; k++) {
            const a = (Math.PI * 2 * k) / 5 + this.frameCount * 0.3;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(a) * 16, Math.sin(a) * 16);
            ctx.lineTo(Math.cos(a + 0.35) * 32, Math.sin(a + 0.35) * 32);
            ctx.stroke();
          }
        } else {
          // Roaring Flame / Shockwave Crest
          const dir = Math.sign(p.vx);
          ctx.scale(dir, 1);
          const grad = ctx.createRadialGradient(8, 0, 4, 0, 0, p.radius * 1.7);
          grad.addColorStop(0, p.coreColor);
          grad.addColorStop(0.55, p.color);
          grad.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.ellipse(0, 0, p.radius * 1.75, p.radius * 1.05, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // World-space VFX (sparks, dust, floating texts)
      this.effects.drawWorld(ctx);

      ctx.restore();

      // Screen-space Super Cut-in overlay
      this.effects.drawScreenOverlay(ctx, VIEW_WIDTH, VIEW_HEIGHT);
      ctx.restore();
    }
  }

  window.KOF.GameEngine = GameEngine;
})();
