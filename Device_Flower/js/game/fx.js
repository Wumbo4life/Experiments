/* Device_Flower - particles, damage/mercy popups, flashes and screen shake. */
(function () {
  'use strict';
  const DF = window.DF;
  const G = DF.G;
  const U = DF.U;

  class FX {
    constructor() {
      this.list = [];
      this.shake = 0;
      this.shakeT = 0;
      this.flash = 0;
      this.flashColor = '#fff';
      this.flashDecay = 3;
    }
    add(p) {
      p.t = 0;
      if (p.life === undefined) p.life = 1;
      this.list.push(p);
      return p;
    }
    clear() {
      this.list.length = 0;
    }
    screenShake(amount) {
      if (!DF.settings.shake) return;
      this.shake = Math.max(this.shake, amount);
    }
    screenFlash(color, amount, decay) {
      this.flashColor = color || '#fff';
      this.flash = amount === undefined ? 1 : amount;
      this.flashDecay = decay || 3;
    }
    update(dt) {
      for (const p of this.list) {
        p.t += dt;
        if (p.vx) p.x += p.vx * dt;
        if (p.vy) p.y += p.vy * dt;
        if (p.grav) p.vy += p.grav * dt;
        if (p.fric) {
          p.vx *= Math.pow(p.fric, dt * 60);
          p.vy *= Math.pow(p.fric, dt * 60);
        }
        if (p.spin) p.rot = (p.rot || 0) + p.spin * dt;
        if (p.update) p.update(p, dt);
      }
      this.list = this.list.filter((p) => p.t < p.life);
      if (this.shake > 0) {
        this.shakeT += dt;
        this.shake = Math.max(0, this.shake - dt * 30);
      }
      if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * this.flashDecay);
    }
    offset() {
      if (this.shake <= 0) return { x: 0, y: 0 };
      const s = Math.round(this.shake);
      return { x: U.randInt(-s, s), y: U.randInt(-s, s) };
    }
    draw(layer) {
      for (const p of this.list) {
        if ((p.layer || 'mid') !== layer) continue;
        const k = p.t / p.life;
        const alpha = p.fade === false ? 1 : p.fadeIn ? Math.min(1, k * 4) * (1 - Math.max(0, (k - 0.7) / 0.3)) : 1 - Math.max(0, (k - (p.fadeStart || 0.6)) / (1 - (p.fadeStart || 0.6)));
        if (p.draw) {
          p.draw(p, alpha, k);
          continue;
        }
        if (p.frame) {
          const name = p.anim ? G.frameAt(p.anim, p.t, p.fps || 12, p.loop !== undefined ? p.loop : false) : p.frame;
          G.draw(name, p.x, p.y, { scale: p.scale || 2, ox: 0.5, oy: 0.5, rot: p.rot, alpha: alpha * (p.alpha || 1), tint: p.tint, add: p.add, flip: p.flip });
        } else if (p.circle) {
          G.circle(p.x, p.y, p.r * (p.grow ? 1 + k * p.grow : 1), p.color || '#fff', alpha * (p.alpha || 1));
        } else if (p.ringFx) {
          G.ring(p.x, p.y, p.r + k * p.grow, p.color || '#fff', p.lw || 3, alpha * (p.alpha || 1));
        }
      }
    }
    drawFlash() {
      if (this.flash > 0) G.rect(0, 0, DF.W, DF.H, this.flashColor, Math.min(1, this.flash));
    }

    // ---- presets -----------------------------------------------------------
    // Deltarune-style damage numbers (bounce then drift up).
    number(x, y, value, color, opts) {
      opts = opts || {};
      const str = String(value);
      return this.add({
        x,
        y,
        life: 1.4,
        layer: 'top',
        fade: false,
        vy: 0,
        draw: (p, a, k) => {
          const t = p.t;
          const bounce = t < 0.35 ? -Math.abs(Math.sin(t * 9)) * 18 * (1 - t / 0.35) : 0;
          const rise = t > 0.9 ? -(t - 0.9) * 60 : 0;
          const alpha = t > 0.9 ? Math.max(0, 1 - (t - 0.9) / 0.5) : 1;
          const stretch = t < 0.08 ? 1 + (0.08 - t) * 8 : 1;
          const font = opts.font || 'bignumbers';
          G.bitmapText(font, str, p.x, p.y + bounce + rise, { color, align: 'center', alpha, scale: 1 * stretch });
        },
      });
    }
    // Pre-rendered message sprites (MISS, UP, DOWN...).
    msg(x, y, frame, opts) {
      opts = opts || {};
      return this.add({
        x,
        y,
        life: 1.4,
        layer: 'top',
        fade: false,
        draw: (p) => {
          const t = p.t;
          const bounce = t < 0.35 ? -Math.abs(Math.sin(t * 9)) * 16 * (1 - t / 0.35) : 0;
          const rise = t > 0.9 ? -(t - 0.9) * 60 : 0;
          const alpha = t > 0.9 ? Math.max(0, 1 - (t - 0.9) / 0.5) : 1;
          G.draw(frame, p.x, p.y + bounce + rise, { scale: 1, ox: 0.5, oy: 0.5, alpha, tint: opts.tint });
        },
      });
    }
    // Rising text label (e.g. "+10%" mercy, "PERFECT!").
    label(x, y, str, color, opts) {
      opts = opts || {};
      return this.add({
        x,
        y,
        life: opts.life || 1.2,
        layer: 'top',
        fade: false,
        draw: (p) => {
          const t = p.t;
          const pop = t < 0.12 ? 0.6 + (t / 0.12) * 0.6 : t < 0.2 ? 1.2 - ((t - 0.12) / 0.08) * 0.2 : 1;
          const alpha = t > p.life - 0.4 ? Math.max(0, (p.life - t) / 0.4) : 1;
          const rise = -Math.min(t, 0.6) * (opts.rise !== undefined ? opts.rise : 30);
          const size = (opts.size || 32) * pop;
          G.text(str, p.x, p.y + rise - size / 2, { size: Math.round(size), color, align: 'center', alpha, outline: opts.outline || '#000', outlineWidth: 5 });
        },
      });
    }
    sparkles(x, y, n, color, spread) {
      for (let i = 0; i < n; i++) {
        const a = U.rand(0, Math.PI * 2);
        const s = U.rand(40, spread || 140);
        this.add({ frame: 'fx/star_1', anim: 'fx/star', fps: 10, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, fric: 0.94, life: 0.6, tint: color, scale: 2 });
      }
    }
    petalBurst(x, y, n, colors) {
      for (let i = 0; i < n; i++) {
        const a = U.rand(0, Math.PI * 2);
        const s = U.rand(60, 220);
        this.add({
          frame: 'petal/falling_1',
          anim: 'petal/falling',
          fps: 10,
          loop: true,
          x,
          y,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s,
          grav: 120,
          fric: 0.97,
          spin: U.rand(-8, 8),
          life: U.rand(0.7, 1.3),
          tint: colors ? U.choose(colors) : undefined,
        });
      }
    }
    hit(x, y, scale, tint) {
      return this.add({ frame: 'fx/hit_1', anim: 'fx/hit', fps: 24, x, y, life: 0.3, scale: scale || 1, tint, add: true, fade: false });
    }
    shockRing(x, y, color, grow, life) {
      return this.add({ ringFx: true, x, y, r: 6, grow: grow || 90, color: color || '#fff', lw: 4, life: life || 0.4 });
    }
    healSparkle(x, y) {
      for (let i = 0; i < 6; i++) {
        this.add({ frame: 'fx/heal_1', anim: 'fx/heal', fps: 10, x: x + U.rand(-18, 18), y: y + U.rand(-30, 10), vy: -U.rand(30, 70), life: 0.8, scale: 1.5 });
      }
    }
  }
  DF.FX = FX;
})();
