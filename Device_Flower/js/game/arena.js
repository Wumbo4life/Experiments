/* Device_Flower - the bullet board and the orange SOUL. */
(function () {
  'use strict';
  const DF = window.DF;
  const G = DF.G;
  const U = DF.U;
  const Input = DF.Input;

  class Arena {
    constructor(cx, cy, w, h) {
      this.cx = cx;
      this.cy = cy;
      this.w = w;
      this.h = h;
      this.grow = 0; // 0..1 appear animation
      this.scroll = 0;
      this.scrollSpeed = 150;
      this.color = '#00c000';
      this.lanes = 0; // Seth's book lanes
      this.laneAlpha = 0;
      this.tintPulse = 0;
    }
    get L() {
      return this.cx - this.w / 2;
    }
    get R() {
      return this.cx + this.w / 2;
    }
    get T() {
      return this.cy - this.h / 2;
    }
    get B() {
      return this.cy + this.h / 2;
    }
    update(dt) {
      this.scroll += this.scrollSpeed * dt;
      if (this.tintPulse > 0) this.tintPulse = Math.max(0, this.tintPulse - dt * 2);
    }
    // Rectangle currently visible (during the grow animation).
    rect() {
      const k = U.ease.outCubic(U.clamp(this.grow, 0, 1));
      const w = this.w * k;
      const h = this.h * k;
      return { x: this.cx - w / 2, y: this.cy - h / 2, w, h };
    }
    drawBack() {
      const r = this.rect();
      if (r.w < 1) return;
      const ctx = G.ctx;
      ctx.save();
      ctx.fillStyle = '#000';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      // Speed lines: the board "moves" to the left under the orange SOUL.
      ctx.beginPath();
      ctx.rect(r.x, r.y, r.w, r.h);
      ctx.clip();
      const lines = 9;
      for (let i = 0; i < lines; i++) {
        const yy = r.y + ((i + 0.5) / lines) * r.h;
        const len = 26 + ((i * 37) % 30);
        const off = (this.scroll * (0.7 + ((i * 13) % 7) / 10) + i * 71) % (r.w + len);
        const xx = r.x + r.w - off;
        ctx.fillStyle = 'rgba(255,160,64,' + (0.12 + ((i * 7) % 5) * 0.03) + ')';
        ctx.fillRect(Math.round(xx), Math.round(yy), len, 2);
      }
      if (this.lanes > 0 && this.laneAlpha > 0) {
        ctx.globalAlpha = this.laneAlpha;
        for (let i = 1; i < this.lanes; i++) {
          const yy = Math.round(r.y + (i / this.lanes) * r.h);
          ctx.fillStyle = '#6a2c9a';
          ctx.fillRect(r.x, yy - 1, r.w, 3);
        }
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }
    drawBorder() {
      const r = this.rect();
      if (r.w < 1) return;
      const ctx = G.ctx;
      ctx.save();
      const k = U.clamp(this.grow, 0, 1);
      ctx.translate(this.cx, this.cy);
      ctx.rotate((1 - k) * 0.6);
      ctx.strokeStyle = this.tintPulse > 0 ? '#ffffff' : this.color;
      ctx.lineWidth = 4;
      ctx.strokeRect(-r.w / 2 - 2, -r.h / 2 - 2, r.w + 4, r.h + 4);
      ctx.restore();
    }
    clip() {
      const r = this.rect();
      const ctx = G.ctx;
      ctx.beginPath();
      ctx.rect(r.x, r.y, r.w, r.h);
      ctx.clip();
    }
  }
  DF.Arena = Arena;

  // The orange SOUL's dash is charge-and-release: tap for a short hop forward,
  // hold to build a longer, faster burst.
  const DASH_MIN = 64;
  const DASH_MAX = 196;
  const SPEED_MIN = 560;
  const SPEED_MAX = 920;
  const CHARGE_TIME = 0.5;
  const RETURN_SPEED = 300;

  class OrangeSoul {
    constructor() {
      this.x = 0;
      this.y = 0;
      this.homeX = 0;
      this.r = 6;
      this.grazeR = 24;
      this.speed = 180;
      this.state = 'free';
      this.stateT = 0;
      this.dashCD = 0;
      this.dashTime = 0.12;
      this.dashSpeed = SPEED_MIN;
      this.charging = false;
      this.charge = 0;
      this.chargeSnd = null;
      this.inv = 0;
      this.visible = true;
      this.locked = true;
      this.forceY = 0;
      this.hopT = 0;
      this.hopDur = 0;
      this.trail = [];
      this.grazeFlash = 0;
      this.color = '#ffa020';
      this.canDash = true;
      this.dashCount = 0;
      this.flash = 0;
    }
    place(arena) {
      this.homeX = arena.L + 46;
      this.x = this.homeX;
      this.y = arena.cy;
      this.state = 'free';
      this.stateT = 0;
      this.trail.length = 0;
      this.forceY = 0;
      this.hopT = 0;
      this.stopCharge();
    }
    get dashing() {
      return this.state === 'dash' || (this.state === 'return' && this.stateT < 0.06);
    }
    get hopping() {
      return this.hopT > 0;
    }
    hop(dur) {
      this.hopT = dur;
      this.hopDur = dur;
    }
    stopCharge() {
      this.charging = false;
      this.charge = 0;
      if (this.chargeSnd) this.chargeSnd.stop(0.05);
      this.chargeSnd = null;
    }
    startDash(power) {
      const dist = U.lerp(DASH_MIN, DASH_MAX, power);
      this.dashSpeed = U.lerp(SPEED_MIN, SPEED_MAX, power);
      this.dashTime = dist / this.dashSpeed;
      this.state = 'dash';
      this.stateT = 0;
      this.dashCD = 0.08;
      this.dashCount++;
      DF.Audio.play(power > 0.6 ? 'boost' : 'wing', { vol: 0.5, pitch: power > 0.6 ? 1.2 : 1.3 });
    }
    update(dt, arena) {
      if (this.inv > 0) this.inv = Math.max(0, this.inv - dt);
      if (this.grazeFlash > 0) this.grazeFlash = Math.max(0, this.grazeFlash - dt * 4);
      if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 4);
      if (this.hopT > 0) this.hopT = Math.max(0, this.hopT - dt);
      this.dashCD -= dt;
      if (this.locked) {
        this.stopCharge();
        return;
      }
      const ax = Input.axis();
      const spd = this.speed * (Input.down('cancel') ? 0.5 : 1);
      this.y += (ax.y * spd + this.forceY) * dt;
      // Charge while [Z] is held, dash on release.
      if (Input.pressed('confirm') && this.state !== 'dash' && this.canDash && this.dashCD <= 0) {
        this.charging = true;
        this.charge = 0;
      }
      if (this.charging) {
        if (Input.down('confirm')) {
          this.charge = Math.min(1, this.charge + dt / CHARGE_TIME);
          if (this.charge > 0.2 && !this.chargeSnd) this.chargeSnd = DF.Audio.play('charge', { vol: 0.3, pitch: 1.4 });
        }
        if (!Input.down('confirm') || Input.released('confirm')) {
          const power = this.charge;
          this.stopCharge();
          this.startDash(power);
        }
      }
      this.stateT += dt;
      if (this.state === 'dash') {
        this.x += this.dashSpeed * dt;
        if (this.stateT >= this.dashTime) {
          this.state = 'return';
          this.stateT = 0;
        }
      } else {
        this.x = U.approach(this.x, this.homeX, RETURN_SPEED * dt);
        if (this.state === 'return' && this.x === this.homeX) this.state = 'free';
      }
      const m = this.r + 2;
      this.x = U.clamp(this.x, arena.L + m, arena.R - m);
      this.y = U.clamp(this.y, arena.T + m, arena.B - m);
      if (this.state === 'dash' || this.hopT > 0) this.trail.push({ x: this.x, y: this.y, t: 0 });
      for (const p of this.trail) p.t += dt;
      while (this.trail.length && this.trail[0].t > 0.18) this.trail.shift();
    }
    // Knock the soul out of a dash (e.g. after a parry) so it returns home.
    bounce() {
      if (this.state === 'dash') {
        this.state = 'return';
        this.stateT = 0.06;
      }
    }
    draw(facing) {
      if (!this.visible) return;
      const rot = facing === 'up' ? Math.PI : facing === 'down' ? 0 : -Math.PI / 2;
      for (const p of this.trail) {
        G.draw('heart/heart', p.x, p.y, { scale: 1, ox: 0.5, oy: 0.5, rot, tint: this.color, alpha: 0.4 * (1 - p.t / 0.18) });
      }
      if (this.inv > 0 && Math.floor(this.inv * 15) % 2 === 0) return;
      const hop = this.hopT > 0 ? Math.sin((1 - this.hopT / this.hopDur) * Math.PI) : 0;
      if (hop > 0) G.circle(this.x, this.y + 8, 6 * (1 - hop * 0.4), '#000', 0.5);
      const sc = 1 + hop * 0.6;
      // Charge glow: a shrinking ring that locks on at full power.
      if (this.charging && this.charge > 0.08) {
        const full = this.charge >= 1;
        const rr = full ? 11 + Math.sin(DF.time * 30) : 22 - this.charge * 11;
        G.ring(this.x, this.y, rr, full ? '#ffffff' : '#ffd080', 2, full ? 0.9 : 0.4 + this.charge * 0.5);
      }
      // Little exhaust flame behind the SOUL.
      const fl = 3 + Math.sin(DF.time * 40) * 1.5 + (this.state === 'dash' ? 6 : 0) + (this.charging ? this.charge * 5 : 0);
      if (facing !== 'up') {
        G.rect(Math.round(this.x - 9 - fl), Math.round(this.y - 1 - hop * 10), Math.round(fl), 2, '#ffd080', 0.8);
      } else {
        G.rect(Math.round(this.x - 1), Math.round(this.y + 9), 2, Math.round(fl), '#ffd080', 0.8);
      }
      const glow = this.charging ? this.charge * 0.6 : 0;
      G.draw('heart/heart', Math.round(this.x), Math.round(this.y - hop * 10), {
        scale: sc, ox: 0.5, oy: 0.5, rot, tint: this.color, fill: '#fff', fillAmt: Math.max(this.flash, this.grazeFlash * 0.6, glow),
      });
    }
  }
  DF.OrangeSoul = OrangeSoul;
})();
