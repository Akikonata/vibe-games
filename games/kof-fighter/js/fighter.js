(function () {
  window.KOF = window.KOF || {};

  const GRAVITY = 0.86;
  const STAGE_MIN_X = 70;
  const STAGE_MAX_X = 1370;

  class Fighter {
    constructor(config, playerIndex, startX, floorY) {
      this.config = config;
      this.playerIndex = playerIndex; // 0 = P1, 1 = P2
      this.floorY = floorY;
      this.resetForRound(startX, playerIndex === 0 ? 1 : -1);
      this.wins = 0;
      this.maxComboReached = 0;
      this.totalDamageDealt = 0;
      this.supersUsed = 0;
    }

    resetForRound(startX, facing) {
      this.x = startX;
      this.y = this.floorY;
      this.vx = 0;
      this.vy = 0;
      this.facing = facing; // 1 = right, -1 = left
      this.hp = this.config.stats.maxHp;
      this.maxHp = this.config.stats.maxHp;
      this.guard = 100;
      // Preserve power gauge across rounds like KOF! (Or start with 35 on round 1)
      if (this.power === undefined) this.power = 35;
      if (this.stocks === undefined) this.stocks = 0;

      this.state = 'idle'; // idle, walk, crouch, jump, attack, hitstun, blockstun, knockdown, wakeup, roll, victory, ko
      this.stateTimer = 0;
      this.animTime = 0;

      this.currentMoveKey = null;
      this.currentMove = null;
      this.moveFrame = 0;
      this.moveHasHit = false;
      this.multiHitCount = 0;
      this.nextMultiHitFrame = 0;

      this.invincibleFrames = 0;
      this.comboCount = 0;
      this.comboTimer = 0;
      this.flashFrames = 0;
      this.hitShakeFrames = 0;
      this.hitShakeAmp = 0;
      this.slammedGround = false;
      this.afterimages = [];
      // Secondary spring physics for bust-bounce & muscle flex
      this.springPos = 0;
      this.springVel = 0;
      this.bustY = 0;
      this.bustVy = 0;
      this.bustX = 0;
      this.bustVx = 0;
      this.wasGrounded = true;
      this.walkPhase = 0;
      this.lastStepIndex = -1;
      if (!Fighter.bustCanvas && typeof document !== 'undefined') {
        Fighter.bustCanvas = document.createElement('canvas');
        Fighter.bustCanvas.width = 96;
        Fighter.bustCanvas.height = 96;
        Fighter.bustCtx = Fighter.bustCanvas.getContext('2d');
      }

      this.inputHistory = []; // Recent directional history for classic motion inputs
      this.prevButtons = { lp: false, lk: false, hp: false, hk: false, roll: false, super: false };
    }

    addPower(amount) {
      if (this.stocks >= 3) {
        this.power = 100;
        return;
      }
      this.power += amount;
      while (this.power >= 100 && this.stocks < 3) {
        this.power -= 100;
        this.stocks++;
      }
      if (this.stocks >= 3) this.power = 100;
    }

    isGrounded() {
      return this.y >= this.floorY - 0.5;
    }

    isBusy() {
      return (
        this.state === 'attack' ||
        this.state === 'hitstun' ||
        this.state === 'blockstun' ||
        this.state === 'knockdown' ||
        this.state === 'wakeup' ||
        this.state === 'roll' ||
        this.state === 'ko' ||
        this.state === 'victory'
      );
    }

    canCancelInto(nextMoveKey) {
      if (this.state !== 'attack' || !this.currentMove || !this.moveHasHit) return false;
      const cur = this.currentMoveKey;
      // Light -> Heavy / Special / Super
      if ((cur === 'lp' || cur === 'lk') && (nextMoveKey === 'hp' || nextMoveKey === 'hk' || nextMoveKey.startsWith('sp') || nextMoveKey === 'super')) {
        return true;
      }
      // Heavy -> Special / Super
      if ((cur === 'hp' || cur === 'hk') && (nextMoveKey.startsWith('sp') || nextMoveKey === 'super')) {
        return true;
      }
      // Special -> Super (Dream Cancel!)
      if (cur.startsWith('sp') && nextMoveKey === 'super') {
        return true;
      }
      return false;
    }

    recordDirection(input) {
      // Relative to facing: 6 = forward, 4 = back, 2 = down, 8 = up, 5 = neutral
      const forward = this.facing === 1 ? input.right : input.left;
      const back = this.facing === 1 ? input.left : input.right;
      let dir = 5;
      if (input.down && forward) dir = 3;
      else if (input.down && back) dir = 1;
      else if (input.down) dir = 2;
      else if (input.up && forward) dir = 9;
      else if (input.up && back) dir = 7;
      else if (input.up) dir = 8;
      else if (forward) dir = 6;
      else if (back) dir = 4;

      const last = this.inputHistory[this.inputHistory.length - 1];
      if (!last || last.dir !== dir) {
        this.inputHistory.push({ dir, time: this.animTime });
        if (this.inputHistory.length > 16) this.inputHistory.shift();
      }
    }

    hasMotion(seq, windowFrames = 22) {
      const minTime = this.animTime - windowFrames;
      let idx = 0;
      for (const entry of this.inputHistory) {
        if (entry.time < minTime) continue;
        if (entry.dir === seq[idx]) {
          idx++;
          if (idx === seq.length) return true;
        }
      }
      return false;
    }

    update(input, opponent, engine) {
      this.animTime++;
      if (this.invincibleFrames > 0) this.invincibleFrames--;
      if (this.flashFrames > 0) this.flashFrames--;

      // Secondary spring-damper physics (lively KOF-style underdamped bust bounce + male muscle flex)
      const isFemale = this.config.gender === 'female';
      const stiffness = isFemale ? 0.22 : 0.34;
      const damping = isFemale ? 0.85 : 0.74;
      const breathFreq = this.state === 'walk' ? 0.38 : 0.21;
      const breathDrive = Math.sin(this.animTime * breathFreq) * (isFemale ? 1.15 : 0.45);
      this.springVel += -this.springPos * stiffness + breathDrive * 0.22;
      this.springVel *= damping;
      this.springPos = Math.max(-9, Math.min(9, this.springPos + this.springVel));

      if (isFemale) {
        // Dedicated 2D soft-body bust spring (vertical bounce + subtle horizontal inertia)
        const idleBounce = Math.sin(this.animTime * (this.state === 'walk' ? 0.42 : 0.22)) * (this.state === 'walk' ? 1.6 : 0.95);
        this.bustVy += -this.bustY * 0.24 + idleBounce * 0.24 - this.vy * 0.09;
        this.bustVy *= 0.84;
        this.bustY = Math.max(-7.5, Math.min(7.5, this.bustY + this.bustVy));

        const horizTarget = -this.vx * this.facing * 0.35;
        this.bustVx += (horizTarget - this.bustX) * 0.22;
        this.bustVx *= 0.82;
        this.bustX = Math.max(-4.5, Math.min(4.5, this.bustX + this.bustVx));
      }

      // Landing impulse into secondary spring
      const groundedNow = this.isGrounded();
      if (groundedNow && !this.wasGrounded) {
        this.springVel += isFemale ? 5.0 : 2.6;
        if (isFemale) this.bustVy += 6.2;
      }
      this.wasGrounded = groundedNow;

      // Update & record afterimage trails for Rolls, Specials, and Supers
      for (let i = this.afterimages.length - 1; i >= 0; i--) {
        this.afterimages[i].life--;
        if (this.afterimages[i].life <= 0) this.afterimages.splice(i, 1);
      }
      const leaveTrail =
        this.state === 'roll' ||
        (this.state === 'attack' &&
          this.currentMoveKey &&
          (this.currentMoveKey === 'super' || this.currentMoveKey === 'sp2' || this.currentMoveKey === 'sp3'));
      if (leaveTrail && this.animTime % 2 === 0) {
        this.afterimages.push({
          x: this.x,
          y: this.y,
          facing: this.facing,
          frameIdx: this.getSpriteFrameIndex(),
          life: 10,
          maxLife: 10
        });
      }

      // Combo decay
      if (this.comboTimer > 0) {
        this.comboTimer--;
        if (this.comboTimer === 0) this.comboCount = 0;
      }

      // Passive guard regen when not blocking
      if (this.state !== 'blockstun' && this.guard < 100) {
        this.guard = Math.min(100, this.guard + 0.14);
      }

      // Edge-triggered button presses
      const pressed = {
        lp: input.lp && !this.prevButtons.lp,
        lk: input.lk && !this.prevButtons.lk,
        hp: input.hp && !this.prevButtons.hp,
        hk: input.hk && !this.prevButtons.hk,
        roll: input.roll && !this.prevButtons.roll,
        super: input.super && !this.prevButtons.super
      };
      this.prevButtons = {
        lp: !!input.lp,
        lk: !!input.lk,
        hp: !!input.hp,
        hk: !!input.hk,
        roll: !!input.roll,
        super: !!input.super
      };

      // Update facing when grounded & free
      if (this.isGrounded() && !this.isBusy() && opponent) {
        this.facing = opponent.x >= this.x ? 1 : -1;
      }

      this.recordDirection(input);

      // Handle locked / non-actionable states
      if (this.state === 'ko' || this.state === 'victory') {
        this.applyPhysics();
        return;
      }

      if (this.state === 'hitstun' || this.state === 'blockstun') {
        this.stateTimer--;
        this.vx *= 0.84;
        this.applyPhysics();
        if (this.stateTimer <= 0 && this.isGrounded()) {
          this.state = 'idle';
        }
        return;
      }

      if (this.state === 'knockdown') {
        this.stateTimer--;
        this.vx *= 0.9;
        const wasAirborne = !this.isGrounded();
        this.applyPhysics();
        if (wasAirborne && this.isGrounded() && !this.slammedGround) {
          this.slammedGround = true;
          engine.effects.spawnDust(this.x, this.floorY, this.facing, 12);
          engine.effects.spawnShockwave(this.x, this.floorY - 6, '#e2e8f0', 62, 10);
          engine.effects.addShake(6, 5);
          window.KOF.audio.groundSlam();
        }
        if (this.isGrounded() && this.stateTimer <= 0) {
          this.state = 'wakeup';
          this.stateTimer = 14;
          this.invincibleFrames = 18;
          this.slammedGround = false;
        }
        return;
      }

      if (this.state === 'wakeup') {
        this.stateTimer--;
        this.vx = 0;
        if (this.stateTimer <= 0) {
          this.state = 'idle';
        }
        return;
      }

      if (this.state === 'roll') {
        this.stateTimer--;
        this.applyPhysics();
        if (this.stateTimer % 4 === 0) {
          engine.effects.spawnDust(this.x, this.floorY, this.facing, 2);
        }
        if (this.stateTimer <= 0) {
          this.vx = 0;
          this.state = 'idle';
        }
        return;
      }

      // Check for attack / cancel inputs
      if (engine.canControlFighters()) {
        const chosenMove = this.detectMoveInput(input, pressed);
        if (chosenMove) {
          if (!this.isBusy() || this.canCancelInto(chosenMove)) {
            this.startMove(chosenMove, engine);
          }
        } else if (pressed.roll && this.isGrounded() && !this.isBusy()) {
          this.startRoll(input, engine);
          return;
        }
      }

      // Active attack update
      if (this.state === 'attack') {
        this.updateAttack(engine);
        this.applyPhysics();
        return;
      }

      // Normal movement (idle, walk, crouch, jump)
      if (engine.canControlFighters()) {
        const moveDir = (input.right ? 1 : 0) - (input.left ? 1 : 0);

        if (this.isGrounded()) {
          if (input.up) {
            this.vy = this.config.stats.jumpForce;
            this.vx = moveDir * this.config.stats.walkSpeed * 1.12;
            this.state = 'jump';
            engine.effects.spawnDust(this.x, this.floorY, moveDir || this.facing, 5);
          } else if (input.down) {
            this.vx = 0;
            this.state = 'crouch';
          } else if (moveDir !== 0) {
            // Backward walk is slightly slower than forward walk (classic KOF feel)
            const isForward = moveDir === this.facing;
            this.vx = moveDir * this.config.stats.walkSpeed * (isForward ? 1.05 : 0.82);
            this.state = 'walk';
            // Advance human gait phase based on actual ground distance traveled
            this.walkPhase += Math.abs(this.vx) * 0.068;
            const stepIdx = Math.floor(this.walkPhase / Math.PI);
            if (stepIdx !== this.lastStepIndex) {
              this.lastStepIndex = stepIdx;
              engine.effects.spawnDust(this.x - moveDir * 14, this.floorY, moveDir, 2);
              if (this.config.gender === 'female') this.bustVy += isForward ? 1.8 : 1.1;
              if (window.KOF.audio && window.KOF.audio.footstep) {
                window.KOF.audio.footstep();
              }
            }
          } else {
            this.vx = 0;
            this.state = 'idle';
            this.walkPhase = 0;
            this.lastStepIndex = -1;
          }
        }
      } else {
        this.vx *= 0.8;
        if (this.isGrounded()) this.state = 'idle';
      }

      this.applyPhysics();
    }

    detectMoveInput(input, pressed) {
      const forward = this.facing === 1 ? input.right : input.left;
      const back = this.facing === 1 ? input.left : input.right;

      // Super Desperation Move (requires 1 stock)
      if (pressed.super && this.stocks >= 1 && this.isGrounded()) {
        return 'super';
      }

      // Classic KOF Motion Inputs (on grounded)
      if (this.isGrounded()) {
        // Dragon Punch: 6-2-3 + P -> sp2 (Anti-Air)
        if ((pressed.lp || pressed.hp) && (this.hasMotion([6, 2, 3]) || this.hasMotion([6, 2, 6]))) {
          return 'sp2';
        }
        // Quarter-Circle Forward: 2-3-6 + P -> sp1 (Projectile)
        if ((pressed.lp || pressed.hp) && (this.hasMotion([2, 3, 6]) || this.hasMotion([2, 6]))) {
          return 'sp1';
        }
        // Quarter-Circle Back: 2-1-4 + K/P -> sp3 (Rush)
        if ((pressed.lk || pressed.hk || pressed.hp) && (this.hasMotion([2, 1, 4]) || this.hasMotion([2, 4]))) {
          return 'sp3';
        }

        // Ergonomic Directional Shortcuts for Keyboard Players
        if (pressed.hp && forward) return 'sp1';
        if (pressed.hp && (input.up || input.down)) return 'sp2';
        if (pressed.hk && (forward || back)) return 'sp3';
      }

      // Normals
      if (pressed.hp) return 'hp';
      if (pressed.hk) return 'hk';
      if (pressed.lp) return 'lp';
      if (pressed.lk) return 'lk';
      return null;
    }

    startRoll(input, engine) {
      const moveDir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      const rollDir = moveDir !== 0 ? moveDir : this.facing;
      this.state = 'roll';
      this.stateTimer = 20;
      this.invincibleFrames = 14;
      this.vx = rollDir * 9.5;
      window.KOF.audio.roll();
      engine.effects.spawnDust(this.x, this.floorY, rollDir, 7);
    }

    startMove(moveKey, engine) {
      const move = this.config.moves[moveKey];
      if (!move) return;

      this.state = 'attack';
      this.currentMoveKey = moveKey;
      this.currentMove = move;
      this.moveFrame = 0;
      this.moveHasHit = false;
      this.multiHitCount = 0;
      this.nextMultiHitFrame = move.startup;
      // Inject secondary spring impulse when launching a strike!
      this.springVel += (this.config.gender === 'female' ? 4.2 : 2.8) * (move.heavy ? 1.35 : 0.9);
      if (this.config.gender === 'female') {
        this.bustVy += move.heavy ? 5.6 : 3.6;
        this.bustVx -= move.heavy ? 2.4 : 1.4;
      }

      if (moveKey === 'super') {
        this.stocks = Math.max(0, this.stocks - 1);
        this.supersUsed++;
        this.invincibleFrames = 18;
        engine.superFreezeFrames = 26;
        engine.effects.triggerSuperCutIn(this, move.name);
        engine.effects.addShake(14, 7);
        window.KOF.audio.superFlash();
      } else if (move.type === 'antiAir') {
        this.invincibleFrames = move.invincibleFrames || 9;
        window.KOF.audio.uppercut();
      } else if (move.type === 'projectile') {
        window.KOF.audio.fireball();
      } else {
        window.KOF.audio.whiff(!!move.heavy);
      }

      if (move.powerGain) {
        this.addPower(Math.round(move.powerGain * 0.45));
      }

      // Stop normal walk momentum on grounded normal
      if (this.isGrounded() && !move.vx) {
        this.vx *= 0.25;
      }
    }

    updateAttack(engine) {
      const m = this.currentMove;
      this.moveFrame++;

      // Special movement impulses at startup
      if (this.moveFrame === m.startup) {
        if (m.type === 'projectile') {
          engine.spawnProjectile(this, m);
          engine.effects.spawnFlameTrail(this.x + this.facing * 44, this.y - 72, this.config.colors.primary, this.config.colors.flameCore);
        } else if (m.type === 'antiAir') {
          this.vy = m.vy || -14;
          this.vx = this.facing * (m.vx || 4);
          engine.effects.spawnDust(this.x, this.floorY, this.facing, 7);
        } else if (m.type === 'rush' || m.type === 'superDash') {
          this.vx = this.facing * (m.vx || 10);
          engine.effects.spawnDust(this.x, this.floorY, this.facing, 6);
        } else if (m.type === 'superWave') {
          engine.effects.addShake(16, 10);
        }
      }

      // Flame particles during active specials / supers
      if (
        this.moveFrame >= m.startup &&
        this.moveFrame <= m.startup + m.active &&
        (this.currentMoveKey.startsWith('sp') || this.currentMoveKey === 'super')
      ) {
        engine.effects.spawnFlameTrail(
          this.x + this.facing * 50,
          this.y - 78,
          this.config.colors.primary,
          this.config.colors.flameCore
        );
      }

      // Friction during recovery
      if (this.moveFrame > m.startup + m.active) {
        this.vx *= 0.8;
      }

      const totalFrames = m.startup + m.active + m.recovery;
      if (this.moveFrame >= totalFrames) {
        this.currentMove = null;
        this.currentMoveKey = null;
        this.state = this.isGrounded() ? 'idle' : 'jump';
      }
    }

    applyPhysics() {
      this.x += this.vx;
      this.y += this.vy;

      if (this.y < this.floorY) {
        this.vy += GRAVITY * this.config.stats.weight;
      } else {
        this.y = this.floorY;
        this.vy = 0;
        if (this.state === 'jump') {
          this.state = 'idle';
          this.vx = 0;
        }
      }

      // Stage wall bounds
      if (this.x < STAGE_MIN_X) this.x = STAGE_MIN_X;
      if (this.x > STAGE_MAX_X) this.x = STAGE_MAX_X;
    }

    getHurtbox() {
      const crouching = this.state === 'crouch';
      const w = 56;
      const h = crouching ? 86 : 134;
      return {
        x: this.x - w / 2,
        y: this.y - h,
        w,
        h
      };
    }

    getActiveHitbox() {
      if (this.state !== 'attack' || !this.currentMove) return null;
      const m = this.currentMove;
      if (m.type === 'projectile') return null; // Projectile object handles its own hitbox
      if (this.moveFrame < m.startup || this.moveFrame > m.startup + m.active) return null;

      if (m.multiHit) {
        if (this.moveFrame < this.nextMultiHitFrame || this.multiHitCount >= m.multiHit) return null;
      } else if (this.moveHasHit) {
        return null;
      }

      const rangeX = m.rangeX || 82;
      const rangeY = m.rangeY || 44;
      const offsetY = m.offsetY || -90;
      const x = this.facing === 1 ? this.x + 12 : this.x - 12 - rangeX;
      return {
        x,
        y: this.y + offsetY,
        w: rangeX,
        h: rangeY
      };
    }

    isBlocking(input, attackerX, attackLevel) {
      if (!this.isGrounded()) return false;
      if (this.state === 'attack' || this.state === 'roll' || this.state === 'knockdown' || this.state === 'hitstun' || this.state === 'ko') {
        return false;
      }
      const holdingBack = attackerX >= this.x ? input.left : input.right;
      if (!holdingBack) return false;
      if (attackLevel === 'low' && !input.down) return false;
      return true;
    }

    takeHit(move, attacker, blocked, engine) {
      const hitX = (this.x + attacker.x) / 2;
      const hitY = this.y - (this.state === 'crouch' ? 56 : 92);

      if (blocked) {
        const chip = move.chip || 0;
        this.hp = Math.max(1, this.hp - chip);
        this.guard = Math.max(0, this.guard - (move.heavy ? 18 : 10));
        this.state = 'blockstun';
        this.stateTimer = move.blockstun || 11;
        this.vx = -this.facing * (move.push || 6);
        this.addPower(5);

        engine.effects.spawnBlockSpark(hitX, hitY);
        window.KOF.audio.block();

        if (this.guard <= 0) {
          this.guard = 100;
          this.state = 'hitstun';
          this.stateTimer = 34;
          engine.effects.spawnFloatText(this.x, this.y - 150, 'GUARD CRUSH!', '#38bdf8');
          engine.effects.addShake(10, 8);
          window.KOF.audio.guardBreak();
        }
        return;
      }

      // Clean Hit! Check Counter-Hit (interrupting opponent's attack!)
      const isCounter = this.state === 'attack';
      attacker.comboCount++;
      attacker.comboTimer = 58;
      if (attacker.comboCount > attacker.maxComboReached) {
        attacker.maxComboReached = attacker.comboCount;
      }

      const scale = Math.max(0.45, 1 - (attacker.comboCount - 1) * 0.11);
      const counterMult = isCounter ? 1.2 : 1.0;
      const perHitDmg = move.multiHit
        ? Math.round((move.damage / move.multiHit) * scale * counterMult)
        : Math.round(move.damage * scale * counterMult);
      this.hp = Math.max(0, this.hp - perHitDmg);
      attacker.totalDamageDealt += perHitDmg;

      const isHeavy = !!move.heavy || !!move.knockdown || !!move.multiHit || isCounter;
      const pushDir = this.x >= attacker.x ? 1 : -1;

      this.flashFrames = isHeavy ? 8 : 5;
      this.hitShakeFrames = isHeavy ? 11 : 6;
      this.hitShakeAmp = isHeavy ? 7 : 3.5;
      this.springVel += (this.config.gender === 'female' ? 5.2 : 3.4) * (isHeavy ? 1.3 : 0.85);
      if (this.config.gender === 'female') {
        this.bustVy += isHeavy ? 6.8 : 4.2;
        this.bustVx += isHeavy ? 3.0 : 1.8;
      }
      this.addPower(Math.max(6, Math.round(perHitDmg * 0.14)));
      attacker.addPower(move.powerGain || 8);

      engine.effects.spawnHitSpark(hitX, hitY, isCounter ? '#fde047' : attacker.config.colors.primary, isHeavy, pushDir);
      engine.effects.addShake(isHeavy ? 11 : 5, isHeavy ? 10 : 4.5, pushDir);
      engine.hitstopFrames = isCounter ? 10 : isHeavy ? 8 : 4;

      if (isHeavy) {
        engine.effects.triggerFlash(isCounter ? 5 : 3, isCounter ? '#fde047' : '#ffffff');
        engine.triggerCameraPunch(isCounter ? 1.075 : 1.045, hitX, hitY);
      }

      if (isCounter) {
        engine.effects.spawnFloatText(this.x, this.y - 175, 'COUNTER!', '#fde047');
        window.KOF.audio.counterHit();
      } else {
        window.KOF.audio.hit(isHeavy);
      }

      // Floating crisp damage readout
      engine.effects.spawnFloatText(
        hitX + (Math.random() - 0.5) * 18,
        hitY - 26,
        `-${perHitDmg}`,
        isHeavy ? '#fb923c' : '#ffffff'
      );

      if (this.hp <= 0) {
        this.state = 'ko';
        this.vy = -13.5;
        this.vx = pushDir * 10.5;
        engine.effects.triggerFlash(8, '#fde047');
        engine.triggerCameraPunch(1.1, hitX, hitY);
        return;
      }

      if (move.knockdown && (!move.multiHit || attacker.multiHitCount >= move.multiHit)) {
        this.state = 'knockdown';
        this.stateTimer = 34;
        this.slammedGround = false;
        this.vy = move.launchY || -10.5;
        this.vx = pushDir * 8.2;
      } else {
        this.state = 'hitstun';
        this.stateTimer = (move.hitstun || 16) + (isCounter ? 4 : 0);
        this.vx = pushDir * ((move.knockback || 7) + (isCounter ? 2.5 : 0));
        if (!this.isGrounded()) {
          this.vy = -7.5;
        }
      }
    }

    getSpriteFrameIndex() {
      // 0 = Idle/Plant, 1 = Forward Stride/Dash/Jump/Roll, 2 = Normal Attack, 3 = Special/Super/Victory
      if (this.state === 'attack' && this.currentMoveKey) {
        if (this.currentMoveKey === 'super' || this.currentMoveKey.startsWith('sp')) return 3;
        return 2;
      }
      if (this.state === 'victory') return 3;
      if (this.state === 'jump' || this.state === 'roll') return 1;
      if (this.state === 'walk') {
        const walkingForward = this.vx * this.facing > 0;
        if (!walkingForward) {
          // Cautious backward guard-step: stay in guarded stance (never sprint forward while moving back!)
          return 0;
        }
        // Rhythmic human forward walk cycle: alternate planted stance (0) <-> push-off stride (1)
        return Math.sin(this.walkPhase) >= 0 ? 1 : 0;
      }
      return 0;
    }

    drawSkillVfx(ctx) {
      if (this.state !== 'attack' || !this.currentMove) return;
      const m = this.currentMove;
      if (this.moveFrame < m.startup || this.moveFrame > m.startup + m.active) return;

      const c = this.config.colors;
      const prog = (this.moveFrame - m.startup) / Math.max(1, m.active);

      ctx.save();
      ctx.shadowColor = c.primary;
      ctx.shadowBlur = 22;

      // 1. Normal / Rush Crescent Energy Slash Arc
      if (!m.type || m.type === 'rush') {
        const isHeavy = !!m.heavy || m.type === 'rush';
        const r = isHeavy ? 68 : 44;
        const arcX = isHeavy ? 52 : 42;
        const arcY = m.level === 'low' ? -44 : -92;
        ctx.strokeStyle = c.primary;
        ctx.lineWidth = isHeavy ? 10 : 6;
        ctx.lineCap = 'round';
        ctx.globalAlpha = 1 - prog * 0.55;
        ctx.beginPath();
        ctx.arc(arcX, arcY, r, -Math.PI * 0.42, Math.PI * 0.35);
        ctx.stroke();

        ctx.strokeStyle = c.flameCore;
        ctx.lineWidth = isHeavy ? 4 : 2.5;
        ctx.beginPath();
        ctx.arc(arcX, arcY, r * 0.92, -Math.PI * 0.35, Math.PI * 0.25);
        ctx.stroke();
      }

      // 2. Anti-Air Rising Spiral Flame / Lightning / Wind Column (sp2)
      if (m.type === 'antiAir') {
        const colH = 175;
        const grad = ctx.createLinearGradient(0, 0, 0, -colH);
        grad.addColorStop(0, 'rgba(255,255,255,0)');
        grad.addColorStop(0.35, c.primary);
        grad.addColorStop(0.85, c.flameCore);
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.globalAlpha = 0.72;
        ctx.beginPath();
        ctx.ellipse(36, -colH * 0.5, 42 + Math.sin(prog * Math.PI) * 18, colH * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();

        // Spiral ribbon streaks
        ctx.strokeStyle = c.flameCore;
        ctx.lineWidth = 4;
        for (let k = 0; k < 3; k++) {
          ctx.beginPath();
          for (let y = -10; y > -colH; y -= 14) {
            const sx = 36 + Math.sin(y * 0.06 + this.animTime * 0.45 + k * 2.1) * 34;
            if (y === -10) ctx.moveTo(sx, y);
            else ctx.lineTo(sx, y);
          }
          ctx.stroke();
        }
      }

      // 3. MAX Super Wave (Kyo Orochinagi / Terry Power Geyser / Shermie Orochi Lightning)
      if (m.type === 'superWave') {
        const id = this.config.id;
        if (id === 'shermie') {
          // Dramatic sky-to-ground Orochi Lightning Bolts!
          for (let b = 0; b < 3; b++) {
            const bx = 85 + b * 70 + Math.sin(this.animTime + b) * 14;
            ctx.strokeStyle = b === 1 ? '#ffffff' : '#38bdf8';
            ctx.lineWidth = b === 1 ? 8 : 5;
            ctx.beginPath();
            ctx.moveTo(bx, -360);
            for (let ly = -320; ly <= 0; ly += 40) {
              ctx.lineTo(bx + (Math.random() - 0.5) * 38, ly);
            }
            ctx.stroke();

            // Ground shockwave ring
            ctx.strokeStyle = '#ec4899';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.ellipse(bx, -4, 48 * (0.6 + prog * 0.6), 14, 0, 0, Math.PI * 2);
            ctx.stroke();
          }
        } else if (id === 'terry') {
          // Triple Golden Power Geyser Columns!
          for (let col = 0; col < 3; col++) {
            const cx = 75 + col * 72;
            const ch = (180 + col * 36) * Math.sin(Math.min(1, prog * 1.35) * Math.PI * 0.75);
            const grad = ctx.createLinearGradient(cx, 0, cx, -ch);
            grad.addColorStop(0, '#ffffff');
            grad.addColorStop(0.45, '#fbbf24');
            grad.addColorStop(1, 'rgba(245, 158, 11, 0)');
            ctx.fillStyle = grad;
            ctx.globalAlpha = 0.88;
            ctx.beginPath();
            ctx.moveTo(cx - 38, 0);
            ctx.quadraticCurveTo(cx - 24, -ch, cx, -ch - 20);
            ctx.quadraticCurveTo(cx + 24, -ch, cx + 38, 0);
            ctx.closePath();
            ctx.fill();
          }
        } else {
          // Kyo's Giant Sweeping Orochinagi Crimson Flame Wave!
          const waveW = 100 + prog * 210;
          const waveH = 160 + Math.sin(prog * Math.PI) * 60;
          const grad = ctx.createLinearGradient(20, 0, 20 + waveW, -waveH);
          grad.addColorStop(0, c.flameCore);
          grad.addColorStop(0.45, c.primary);
          grad.addColorStop(1, 'rgba(220, 38, 38, 0.1)');
          ctx.fillStyle = grad;
          ctx.globalAlpha = 0.9;
          ctx.beginPath();
          ctx.ellipse(34 + waveW * 0.5, -waveH * 0.48, waveW * 0.58, waveH * 0.55, -0.15, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 4. MAX Super Dash (Iori Maiden Masher / Mai Super Shinobibachi / Blue Mary Typhoon)
      if (m.type === 'superDash') {
        const grad = ctx.createLinearGradient(-40, -90, 120, -90);
        grad.addColorStop(0, 'rgba(255,255,255,0)');
        grad.addColorStop(0.55, c.primary);
        grad.addColorStop(1, c.flameCore);
        ctx.fillStyle = grad;
        ctx.globalAlpha = 0.78;
        ctx.beginPath();
        ctx.moveTo(-45, -135);
        ctx.lineTo(125, -90);
        ctx.lineTo(-45, -45);
        ctx.closePath();
        ctx.fill();

        // Cross energy slashes
        ctx.strokeStyle = c.flameCore;
        ctx.lineWidth = 5;
        for (let s = 0; s < 2; s++) {
          const sx = 45 + s * 30;
          ctx.beginPath();
          ctx.moveTo(sx - 28, -125 + s * 16);
          ctx.lineTo(sx + 28, -55 - s * 16);
          ctx.stroke();
        }
      }

      ctx.restore();
    }

    draw(ctx) {
      const c = this.config.colors;
      const spriteImg = window.KOF.SPRITES ? window.KOF.SPRITES[this.config.id] : null;
      const hasSprite = spriteImg && spriteImg.complete && spriteImg.naturalWidth > 0;

      // Draw Ghost Afterimages first (in world coordinates)
      if (hasSprite && this.afterimages.length > 0) {
        const fw = spriteImg.naturalWidth / 4;
        const fh = spriteImg.naturalHeight;
        for (const ghost of this.afterimages) {
          const alpha = (ghost.life / ghost.maxLife) * 0.42;
          ctx.save();
          ctx.translate(ghost.x, ghost.y);
          ctx.scale(ghost.facing, 1);
          ctx.globalAlpha = alpha;
          ctx.filter = `drop-shadow(0 0 10px ${c.primary}) brightness(1.3)`;
          ctx.drawImage(spriteImg, ghost.frameIdx * fw, 0, fw, fh, -96, -184, 192, 192);
          ctx.restore();
        }
      }

      ctx.save();
      ctx.translate(this.x, this.y);

      // Ground shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.48)';
      const shadowScale = Math.max(0.4, 1 - (this.floorY - this.y) / 360);
      ctx.beginPath();
      ctx.ellipse(0, 0, 46 * shadowScale, 11 * shadowScale, 0, 0, Math.PI * 2);
      ctx.fill();

      // Invincibility / Roll transparency flicker
      if (this.invincibleFrames > 0 && Math.floor(this.animTime / 2) % 2 === 0) {
        ctx.globalAlpha = 0.65;
      }

      // Flip horizontally based on facing
      ctx.scale(this.facing, 1);

      // Super / Special fiery energy aura behind fighter
      if (this.state === 'attack' && this.currentMoveKey && (this.currentMoveKey === 'super' || this.currentMoveKey.startsWith('sp'))) {
        ctx.save();
        ctx.shadowColor = c.aura;
        ctx.shadowBlur = 32;
        ctx.fillStyle = c.aura;
        ctx.globalAlpha = 0.28 + Math.sin(this.animTime * 0.6) * 0.08;
        ctx.beginPath();
        ctx.ellipse(0, -88, 58, 92, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      if (hasSprite) {
        const fw = spriteImg.naturalWidth / 4;
        const fh = spriteImg.naturalHeight;
        const frameIdx = this.getSpriteFrameIndex();
        const isFemale = this.config.gender === 'female';

        // 3-Phase Choreography (Anticipation Windup -> Explosive Strike -> Recovery Follow-Through)
        let scaleX = 1;
        let scaleY = 1;
        let offsetY = 0;
        let offsetX = 0;
        let rot = 0;
        let musclePump = 0;

        if (this.state === 'idle') {
          const breath = Math.sin(this.animTime * 0.16);
          scaleY = 1 + breath * 0.032;
          scaleX = 1 - breath * 0.018;
          musclePump = Math.max(0, breath) * 0.045;
        } else if (this.state === 'walk') {
          const walkingForward = this.vx * this.facing > 0;
          const strideSin = Math.sin(this.walkPhase);
          const lift = Math.abs(strideSin);
          if (walkingForward) {
            // Natural bipedal forward walk: knee-dip at foot plant, lift & lean on push-off
            offsetY = -lift * 9;
            offsetX = strideSin * 4;
            rot = 0.045 + lift * 0.055;
            scaleY = 0.965 + lift * 0.06;
            scaleX = 1.03 - lift * 0.045;
          } else {
            // Cautious KOF back-step: guarded heel-toe rhythm
            offsetY = -lift * 6;
            offsetX = -strideSin * 3;
            rot = -0.04 - lift * 0.03;
            scaleY = 0.97 + lift * 0.045;
            scaleX = 1.02 - lift * 0.03;
          }
        } else if (this.state === 'jump') {
          scaleY = this.vy < 0 ? 1.07 : 0.96;
          scaleX = this.vy < 0 ? 0.95 : 1.04;
          rot = this.vy * 0.008;
        } else if (this.state === 'crouch') {
          scaleY = 0.72;
          scaleX = 1.1;
        } else if (this.state === 'blockstun') {
          scaleX = 0.94;
          rot = -0.11;
        } else if (this.state === 'hitstun') {
          rot = -0.24;
          offsetX = -12;
          scaleX = 0.95;
          scaleY = 1.04;
        } else if (this.state === 'knockdown' || this.state === 'ko') {
          offsetY = -22;
          rot = -Math.PI / 2.15;
        } else if (this.state === 'roll') {
          ctx.translate(0, -56);
          ctx.rotate((this.animTime * 0.5) % (Math.PI * 2));
          ctx.translate(0, 56);
          scaleY = 0.78;
        } else if (this.state === 'attack' && this.currentMove) {
          const m = this.currentMove;
          if (this.moveFrame < m.startup) {
            // Phase 1: Anticipation coil back!
            const p = this.moveFrame / Math.max(1, m.startup);
            offsetX = -10 * p;
            rot = -0.09 * p;
            scaleX = 1 - 0.04 * p;
            scaleY = 1 + 0.04 * p;
            musclePump = 0.06 * p;
          } else if (this.moveFrame <= m.startup + m.active) {
            // Phase 2: Explosive strike snap forward!
            offsetX = m.heavy ? 20 : 14;
            rot = m.heavy ? 0.11 : 0.06;
            scaleX = m.heavy ? 1.13 : 1.08;
            scaleY = 0.94;
            musclePump = m.heavy ? 0.095 : 0.055;
          } else {
            // Phase 3: Recoil follow-through settle
            const recP = (this.moveFrame - (m.startup + m.active)) / Math.max(1, m.recovery);
            const ease = 1 - recP;
            offsetX = 10 * ease;
            rot = 0.05 * ease;
            musclePump = 0.04 * ease;
          }
        }

        // Charged MAX Power Ambient Aura Motes
        if (this.stocks >= 1 && this.state !== 'ko') {
          ctx.save();
          ctx.fillStyle = c.aura;
          for (let i = 0; i < 4; i++) {
            const my = -((this.animTime * 2.2 + i * 38) % 140);
            const mx = Math.sin(this.animTime * 0.12 + i * 1.7) * 38;
            ctx.globalAlpha = Math.max(0, (1 + my / 140) * 0.45);
            ctx.beginPath();
            ctx.arc(mx, my, 2.5 + (i % 2), 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }

        ctx.save();
        // Hitstop impact vibration tremble!
        const trembleX = this.hitShakeFrames > 0 ? (this.hitShakeFrames % 2 === 0 ? 1 : -1) * this.hitShakeAmp : 0;
        ctx.translate(offsetX + trembleX, offsetY);
        if (rot !== 0) {
          ctx.translate(0, -68);
          ctx.rotate(rot);
          ctx.translate(0, 68);
        }
        ctx.scale(scaleX, scaleY);

        if (this.flashFrames > 0) {
          ctx.filter = 'brightness(2.2) contrast(1.2)';
        } else if (this.state === 'blockstun') {
          ctx.filter = 'drop-shadow(0 0 12px #38bdf8)';
        } else {
          ctx.filter = `drop-shadow(0 4px 8px rgba(0,0,0,0.65))`;
        }

        // 1) Draw full intact high-res sprite cleanly (ZERO horizontal cut lines or seams!)
        const drawSize = 196;
        const baseX = -drawSize / 2;
        const baseY = -drawSize + 8;
        const sx = frameIdx * fw;

        ctx.drawImage(spriteImg, sx, 0, fw, fh, baseX, baseY, drawSize, drawSize);

        // 2) Seamless Feathered Soft-Body Bust Bounce Overlay for Female Fighters (Mai / Shermie / Blue Mary)
        if (isFemale && Fighter.bustCtx && this.state !== 'knockdown' && this.state !== 'ko' && this.state !== 'roll') {
          const CHEST_ANCHORS = {
            mai: [
              [0.51, 0.30],
              [0.68, 0.36],
              [0.42, 0.34],
              [0.62, 0.31]
            ],
            shermie: [
              [0.54, 0.30],
              [0.68, 0.36],
              [0.45, 0.28],
              [0.49, 0.31]
            ],
            mary: [
              [0.46, 0.31],
              [0.58, 0.33],
              [0.41, 0.31],
              [0.54, 0.25]
            ]
          };
          const anchors = CHEST_ANCHORS[this.config.id];
          if (anchors && anchors[frameIdx]) {
            const [u, v] = anchors[frameIdx];
            const bCanvas = Fighter.bustCanvas;
            const bCtx = Fighter.bustCtx;
            const bw = bCanvas.width;
            const bh = bCanvas.height;

            // Source chest patch from sprite sheet
            const patchRatio = 0.22;
            const srcW = fw * patchRatio;
            const srcH = fh * patchRatio;
            const srcX = sx + fw * u - srcW / 2;
            const srcY = fh * v - srcH / 2;

            bCtx.clearRect(0, 0, bw, bh);
            bCtx.globalCompositeOperation = 'source-over';
            bCtx.drawImage(spriteImg, srcX, srcY, srcW, srcH, 0, 0, bw, bh);

            // Soft feathered radial mask -> blends invisibly with zero edge line!
            bCtx.globalCompositeOperation = 'destination-in';
            const mask = bCtx.createRadialGradient(bw / 2, bh / 2, bw * 0.14, bw / 2, bh / 2, bw * 0.48);
            mask.addColorStop(0, 'rgba(0,0,0,1)');
            mask.addColorStop(0.58, 'rgba(0,0,0,0.92)');
            mask.addColorStop(1, 'rgba(0,0,0,0)');
            bCtx.fillStyle = mask;
            bCtx.fillRect(0, 0, bw, bh);
            bCtx.globalCompositeOperation = 'source-over';

            // Draw feathered bust patch with elastic squash-and-stretch spring bounce!
            const dstW = drawSize * patchRatio;
            const dstH = drawSize * patchRatio;
            const cx = baseX + drawSize * u + this.bustX;
            const cy = baseY + drawSize * v + this.bustY;
            const sqY = 1 + Math.max(-0.14, Math.min(0.16, this.bustVy * 0.032));
            const sqX = 1 - (sqY - 1) * 0.45;

            ctx.save();
            ctx.translate(cx, cy);
            ctx.scale(sqX, sqY);
            ctx.drawImage(bCanvas, -dstW / 2, -dstH / 2, dstW, dstH);
            ctx.restore();
          }
        }

        ctx.restore();

        // Guard barrier shield visual when blocking
        if (this.state === 'blockstun') {
          ctx.save();
          ctx.strokeStyle = '#38bdf8';
          ctx.fillStyle = 'rgba(56, 189, 248, 0.22)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(28, -92, 46, -Math.PI * 0.45, Math.PI * 0.45);
          ctx.stroke();
          ctx.fill();
          ctx.restore();
        }

        // Layer rich skill VFX over the sprite!
        this.drawSkillVfx(ctx);
        ctx.restore();
        return;
      }

      // Fallback silhouette only while sprite PNG is still loading
      ctx.fillStyle = c.primary;
      ctx.fillRect(-20, -130, 40, 130);
      ctx.restore();
    }
  }

  window.KOF.Fighter = Fighter;
})();
