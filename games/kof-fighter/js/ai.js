(function () {
  window.KOF = window.KOF || {};

  const DIFFICULTIES = {
    easy: {
      thinkInterval: 14,
      blockChance: 0.25,
      antiAirChance: 0.15,
      specialChance: 0.16,
      superChance: 0.2,
      aggression: 0.42
    },
    normal: {
      thinkInterval: 8,
      blockChance: 0.55,
      antiAirChance: 0.42,
      specialChance: 0.3,
      superChance: 0.55,
      aggression: 0.65
    },
    hard: {
      thinkInterval: 4,
      blockChance: 0.82,
      antiAirChance: 0.72,
      specialChance: 0.48,
      superChance: 0.85,
      aggression: 0.84
    }
  };

  class AIController {
    constructor(difficulty = 'normal') {
      this.setDifficulty(difficulty);
      this.cooldown = 0;
      this.heldInput = this.emptyInput();
      this.planTimer = 0;
    }

    setDifficulty(diff) {
      this.difficulty = diff;
      this.cfg = DIFFICULTIES[diff] || DIFFICULTIES.normal;
    }

    emptyInput() {
      return {
        left: false,
        right: false,
        up: false,
        down: false,
        lp: false,
        lk: false,
        hp: false,
        hk: false,
        roll: false,
        super: false
      };
    }

    computeInput(self, opponent, projectiles) {
      // Release single-frame attack buttons each tick so edge detection fires cleanly
      const input = {
        ...this.heldInput,
        lp: false,
        lk: false,
        hp: false,
        hk: false,
        roll: false,
        super: false,
        up: false
      };

      if (!opponent || self.state === 'ko' || self.state === 'victory') {
        return this.emptyInput();
      }

      const dx = opponent.x - self.x;
      const dist = Math.abs(dx);
      const towardsLeft = dx < 0;

      // Immediate projectile awareness (jump or block or roll)
      const incomingProj = projectiles.find(
        (p) => p.owner !== self && Math.abs(p.x - self.x) < 170 && Math.sign(p.vx) === Math.sign(self.x - p.x)
      );
      if (incomingProj && self.isGrounded() && !self.isBusy()) {
        if (Math.random() < this.cfg.blockChance) {
          if (Math.random() < 0.35) {
            input.roll = true;
            input.left = towardsLeft;
            input.right = !towardsLeft;
          } else {
            input.left = !towardsLeft;
            input.right = towardsLeft;
          }
          return input;
        }
      }

      // Reactive blocking when opponent attacks up close
      if (opponent.state === 'attack' && dist < 135 && !self.isBusy()) {
        if (Math.random() < this.cfg.blockChance) {
          this.heldInput = this.emptyInput();
          this.heldInput.left = !towardsLeft;
          this.heldInput.right = towardsLeft;
          if (opponent.currentMove && opponent.currentMove.level === 'low') {
            this.heldInput.down = true;
          }
          return { ...this.heldInput };
        }
      }

      // Reactive anti-air if opponent jumps in
      if (!opponent.isGrounded() && dist < 120 && self.isGrounded() && !self.isBusy()) {
        if (Math.random() < this.cfg.antiAirChance) {
          input.down = true;
          input.hp = true; // Triggers sp2 anti-air shortcut
          return input;
        }
      }

      // Combo follow-up if we just landed a light/heavy hit!
      if (self.state === 'attack' && self.moveHasHit && self.currentMoveKey) {
        if (self.currentMoveKey === 'lp' && Math.random() < this.cfg.aggression) {
          input.hp = true;
          return input;
        }
        if ((self.currentMoveKey === 'hp' || self.currentMoveKey === 'hk') && Math.random() < this.cfg.specialChance) {
          if (self.stocks >= 1 && Math.random() < this.cfg.superChance) {
            input.super = true;
          } else {
            input.left = towardsLeft;
            input.right = !towardsLeft;
            input.hk = true; // Triggers sp3 rush
          }
          return input;
        }
      }

      if (this.planTimer > 0) {
        this.planTimer--;
        return input;
      }

      this.planTimer = this.cfg.thinkInterval + Math.floor(Math.random() * 6);
      this.heldInput = this.emptyInput();

      // Decision making by distance
      if (dist > 280) {
        // Long range: approach or throw fireball
        if (Math.random() < this.cfg.specialChance * 0.7) {
          input.left = towardsLeft;
          input.right = !towardsLeft;
          input.hp = true; // sp1 projectile
        } else {
          this.heldInput.left = towardsLeft;
          this.heldInput.right = !towardsLeft;
        }
      } else if (dist > 115) {
        // Mid range: footsies, rush special, or jump-in
        const r = Math.random();
        if (self.stocks >= 1 && r < this.cfg.superChance * 0.25) {
          input.super = true;
        } else if (r < this.cfg.specialChance) {
          input.left = towardsLeft;
          input.right = !towardsLeft;
          input.hk = true; // sp3 rush
        } else if (r < this.cfg.aggression) {
          this.heldInput.left = towardsLeft;
          this.heldInput.right = !towardsLeft;
          if (Math.random() < 0.22) input.up = true;
        } else {
          // Slight spacing backstep
          this.heldInput.left = !towardsLeft;
          this.heldInput.right = towardsLeft;
        }
      } else {
        // Close range: mixup light/heavy/sweep/super/roll
        const r = Math.random();
        if (self.stocks >= 1 && r < this.cfg.superChance * 0.35) {
          input.super = true;
        } else if (r < 0.32) {
          input.lp = true;
        } else if (r < 0.54) {
          input.lk = true;
        } else if (r < 0.72) {
          input.hp = true;
        } else if (r < 0.86) {
          input.hk = true;
        } else if (r < 0.94) {
          input.roll = true;
          input.left = towardsLeft;
          input.right = !towardsLeft;
        } else {
          // Guard briefly
          this.heldInput.left = !towardsLeft;
          this.heldInput.right = towardsLeft;
        }
      }

      return { ...this.heldInput, ...input };
    }
  }

  window.KOF.AIController = AIController;
})();
