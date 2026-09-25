/* Device_Flower - bullets and the little procedural sprites some of them use. */
(function () {
  'use strict';
  const DF = window.DF;
  const G = DF.G;
  const U = DF.U;

  // ---- procedural pixel art --------------------------------------------------
  const PIX = {};
  DF.PIX = PIX;
  DF.buildPixelArt = function () {
    PIX.knife = G.pixelSprite(
      [
        '..............',
        '.wwwwwwwww....',
        'wwwwwwwwwwwkkk',
        '.gggggggggkcck',
        '..........kkk.',
      ],
      { w: '#ffffff', g: '#a0b0c0', k: '#1a5a7a', c: '#00ffff' }
    );
    PIX.glove = G.pixelSprite(
      [
        '..rrrrr...',
        '.rRRRRRr..',
        'rRRRRRRRr.',
        'rRRRRRRRrw',
        'rRRRRRRRrw',
        '.rRRRRRr.w',
        '..rrrrr...',
      ],
      { r: '#7a1010', R: '#ff3030', w: '#ffffff' }
    );
    PIX.pan = G.pixelSprite(
      [
        '...kkkkk.........',
        '..kKKKKKk........',
        '.kKKKKKKKk.......',
        '.kKKKKKKKkhhhhhhh',
        '.kKKKKKKKk.......',
        '..kKKKKKk........',
        '...kkkkk.........',
      ],
      { k: '#303040', K: '#6a6a80', h: '#8a5a2a' }
    );
    PIX.dish = G.pixelSprite(
      [
        '....gg....',
        '...gGGg...',
        '..gGyGGg..',
        '.wwwwwwww.',
        'wwwwwwwwww',
        '.wwwwwwww.',
      ],
      { g: '#1a8a1a', G: '#40e040', y: '#fff060', w: '#e8e8e8' }
    );
    PIX.lily = G.pixelSprite(
      [
        '....bbbbbb....',
        '..bbBBBBBBbb..',
        '.bBBBBBBBBBBb.',
        'bBBBBBBBBBBBBb',
        'bBBBBBpBBBBBBb',
        'bBBBBpPpBBBBBb',
        '.bBBBBpBBBBBb.',
        '..bbBBBBBBbb..',
        '....bbbbbb....',
      ],
      { b: '#1a4aa0', B: '#3a8aff', p: '#ffb0e0', P: '#ffffff' }
    );
    PIX.shot = G.pixelSprite(['.yyyyyyyyyy', 'yYYYYYYYYYY', '.yyyyyyyyyy'], { y: '#c09000', Y: '#fff080' });
    PIX.bolt = G.pixelSprite(['..ww..', '.wwww.', 'wwwwww', '.wwww.', '..ww..'], { w: '#ffffff' });
    PIX.thorn = G.pixelSprite(['...w...', '..www..', '..www..', '.wwwww.', '.wwwww.', 'wwwwwww'], { w: '#ffffff' });
    PIX.note = G.pixelSprite(['...ww', '...w.', '...w.', '.www.', 'wwww.', '.ww..'], { w: '#ffffff' });
  };

  // ---- base bullet ---------------------------------------------------------------
  class Bullet {
    constructor(o) {
      this.x = 0;
      this.y = 0;
      this.vx = 0;
      this.vy = 0;
      this.ax = 0;
      this.ay = 0;
      this.r = 6;
      this.shape = 'circle'; // 'circle' | 'rect' | 'custom'
      this.w = 0;
      this.h = 0;
      this.kind = 'white'; // white | blue | green | heal | lily
      this.damage = 0;
      this.alive = true;
      this.active = true;
      this.t = 0;
      this.life = 30;
      this.frame = null;
      this.anim = null;
      this.fps = 10;
      this.loop = true;
      this.scale = 2;
      this.rot = 0;
      this.spin = 0;
      this.tint = null;
      this.alpha = 1;
      this.grazed = false;
      this.ground = false;
      this.clip = true;
      this.canvas = null;
      this.rotateToVel = false;
      this.fadeIn = 0.08;
      this.margin = 140;
      Object.assign(this, o);
    }
    update(dt, w) {
      this.t += dt;
      this.vx += this.ax * dt;
      this.vy += this.ay * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.rot += this.spin * dt;
      if (this.rotateToVel) this.rot = Math.atan2(this.vy, this.vx);
      if (this.onUpdate) this.onUpdate(this, dt, w);
      if (this.t > this.life) this.alive = false;
      const a = w.arena;
      const m = this.margin;
      if (this.x < a.L - m || this.x > a.R + m + 200 || this.y < a.T - m - 100 || this.y > a.B + m + 100) this.alive = false;
    }
    // Returns true when touching the SOUL.
    hits(s, extra) {
      const r = s.r + (extra || 0);
      if (this.hitFn) return this.hitFn(this, s, extra || 0);
      if (this.shape === 'rect') return U.circleRect(s.x, s.y, r, this.x - this.w / 2, this.y - this.h / 2, this.w, this.h);
      const d = this.r + r;
      const dx = s.x - this.x;
      const dy = s.y - this.y;
      return dx * dx + dy * dy < d * d;
    }
    draw() {
      if (this.drawFn) return this.drawFn(this);
      const a = this.alpha * Math.min(1, this.t / this.fadeIn);
      if (this.canvas) {
        const c = this.fill ? G.canvasFill(this.canvas, this.fill) : this.canvas;
        G.drawCanvas(c, this.x, this.y, { scale: this.scale, rot: this.rot, alpha: a, flip: this.flip });
        return;
      }
      if (this.frame || this.anim) {
        const name = this.anim ? G.frameAt(this.anim, this.t, this.fps, this.loop) : this.frame;
        if (this.fill) G.drawFill(name, this.x, this.y, this.fill, { scale: this.scale, ox: 0.5, oy: 0.5, rot: this.rot, alpha: a, flip: this.flip });
        else G.draw(name, this.x, this.y, { scale: this.scale, ox: 0.5, oy: 0.5, rot: this.rot, alpha: a, tint: this.tint, flip: this.flip });
        return;
      }
      G.circle(this.x, this.y, this.r, this.kind === 'blue' ? '#3a8aff' : '#fff', a);
    }
  }
  DF.Bullet = Bullet;

  // ---- presets ------------------------------------------------------------------
  const B = (DF.Bullets = {});

  B.petal = (x, y, vx, vy, o) =>
    new Bullet(Object.assign({ x, y, vx, vy, r: 5, anim: U.chance(0.5) ? 'petal/falling' : 'petal/spinning', fps: 12, scale: U.chance(0.5) ? 2 : 1.5, spin: U.rand(-3, 3) }, o || {}));
  B.bluePetal = (x, y, vx, vy, o) => new Bullet(Object.assign({ x, y, vx, vy, r: 7, kind: 'blue', anim: 'petal/blue', fps: 10, scale: 2, rotateToVel: true }, o || {}));
  B.pinkPetal = (x, y, vx, vy, o) => new Bullet(Object.assign({ x, y, vx, vy, r: 6, anim: 'petal/barrier', fps: 12, scale: 1.5, spin: U.rand(-4, 4) }, o || {}));
  B.blueOrb = (x, y, vx, vy, o) => new Bullet(Object.assign({ x, y, vx, vy, r: 9, kind: 'blue', anim: 'bullet/blueorb', fps: 6, scale: 0.75 }, o || {}));
  B.rainbowPetal = (x, y, vx, vy, o) =>
    new Bullet(
      Object.assign(
        {
          x, y, vx, vy, r: 5, anim: 'petal/spinning', fps: 14, scale: 1.5, spin: U.rand(-5, 5),
          seed: U.randInt(0, 6),
          drawFn(b) {
            const name = G.frameAt(b.anim, b.t, b.fps, true);
            G.drawFill(name, b.x, b.y, U.rainbow(b.seed), { scale: b.scale, ox: 0.5, oy: 0.5, rot: b.rot, alpha: Math.min(1, b.t / 0.08) });
          },
        },
        o || {}
      )
    );
  B.knife = (x, y, vx, vy, o) => new Bullet(Object.assign({ x, y, vx, vy, shape: 'rect', w: 22, h: 6, canvas: PIX.knife, scale: 2, rotateToVel: true, flip: true, hitFn: knifeHit }, o || {}));
  function knifeHit(b, s, extra) {
    // Thin segment along the blade.
    const c = Math.cos(b.rot);
    const d = Math.sin(b.rot);
    const d2 = U.segDist2(s.x, s.y, b.x - c * 12, b.y - d * 12, b.x + c * 12, b.y + d * 12);
    const r = s.r + 3 + extra;
    return d2 < r * r;
  }
  B.glove = (x, y, vx, vy, o) => new Bullet(Object.assign({ x, y, vx, vy, r: 9, canvas: PIX.glove, scale: 2, rotateToVel: false, spin: 0 }, o || {}));
  B.pan = (x, y, vx, vy, o) => new Bullet(Object.assign({ x, y, vx, vy, r: 9, canvas: PIX.pan, scale: 2, spin: U.rand(6, 10) * (U.chance(0.5) ? 1 : -1) }, o || {}));
  B.dish = (x, y, vx, vy, o) => new Bullet(Object.assign({ x, y, vx, vy, r: 10, kind: 'heal', canvas: PIX.dish, scale: 2 }, o || {}));
  B.lily = (x, y, vx, o) => new Bullet(Object.assign({ x, y, vx, vy: 0, r: 13, kind: 'lily', canvas: PIX.lily, scale: 2 }, o || {}));

  // A falling column of knives across the whole board (hop over it on a lily pad).
  B.knifeWall = (w, x, vx, o) =>
    new Bullet(
      Object.assign(
        {
          x, y: w.arena.cy, vx, vy: 0, ground: true, shape: 'rect', w: 18, h: w.arena.h + 20,
          drawFn(b) {
            const a = w.arena;
            const n = Math.ceil(a.h / 16);
            for (let i = 0; i < n; i++) {
              const yy = a.T + 8 + i * 16;
              G.drawCanvas(PIX.knife, b.x + ((i % 2) * 6 - 3), yy, { scale: 2, alpha: Math.min(1, b.t / 0.1) });
            }
          },
        },
        o || {}
      )
    );

  // Seth's words. White ones hurt, green ones are TP.
  B.word = (x, y, vx, text, green) => {
    const width = G.textWidth(text, 'main', 32);
    return new Bullet({
      x, y, vx, vy: 0, kind: green ? 'green' : 'white', shape: 'rect', w: width - 4, h: 18, text, margin: 260,
      drawFn(b) {
        G.text(b.text, b.x, b.y - 17, { size: 32, align: 'center', color: green ? '#40ff60' : '#ffffff', alpha: Math.min(1, b.t / 0.1) });
      },
    });
  };
})();
