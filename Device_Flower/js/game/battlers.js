/* Device_Flower - party members and enemies on the battlefield. */
(function () {
  'use strict';
  const DF = window.DF;
  const G = DF.G;
  const U = DF.U;

  class PartyBattler {
    constructor(id) {
      const d = DF.PARTY[id];
      this.id = id;
      this.def = d;
      this.name = d.name;
      this.maxhp = d.maxhp;
      this.hp = d.maxhp;
      this.color = d.color;
      this.x = 0;
      this.y = 0;
      this.slideX = 0;
      this.anim = 'idle';
      this.animT = 0;
      this.animTemp = 0;
      this.flash = 0;
      this.alpha = 1;
      this.visible = true;
      this.defending = false;
      this.headIcon = 'head';
      this.override = null; // a frame name drawn instead of the animation
      this.shake = 0;
    }
    get down() {
      return this.hp <= 0;
    }
    setAnim(name) {
      if (!G.anim(this.id + '/' + name).length && !G.has(this.id + '/' + name + '_1')) name = 'idle';
      this.anim = name;
      this.animT = 0;
      const a = DF.ANIMS[name];
      this.animTemp = a && a.temp ? a.temp : 0;
    }
    resetAnim() {
      if (this.down) this.setAnim('defeat');
      else if (this.defending) this.setAnim('defend');
      else this.setAnim('idle');
    }
    update(dt) {
      this.animT += dt;
      const a = DF.ANIMS[this.anim] || DF.ANIMS.idle;
      const frames = G.anim(this.id + '/' + this.anim);
      if (this.animTemp > 0) {
        this.animTemp -= dt;
        if (this.animTemp <= 0) this.resetAnim();
      } else if (!a.loop && a.next && this.animT * a.fps >= frames.length) {
        this.setAnim(a.next);
      }
      if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 3);
      if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 20);
    }
    frame() {
      const a = DF.ANIMS[this.anim] || DF.ANIMS.idle;
      return G.frameAt(this.id + '/' + this.anim, this.animT, a.fps, a.loop);
    }
    // Screen position of the SOUL inside this character.
    soulPos() {
      return { x: this.x - this.def.w + this.def.soul[0] * 2, y: this.y - this.def.h * 2 + this.def.soul[1] * 2 };
    }
    center() {
      return { x: this.x, y: this.y - this.def.h };
    }
    draw() {
      if (!this.visible) return;
      const d = this.def;
      const off = d.offsets[this.anim] || d.offsets.idle;
      const sx = this.x + this.slideX + (this.shake > 0 ? Math.round(U.rand(-this.shake, this.shake)) : 0);
      const x0 = sx - d.w + off[0] * 2;
      const y0 = this.y - d.h * 2 + off[1] * 2;
      if (this.override) {
        G.draw(this.override.frame, sx + (this.override.dx || 0), this.y + (this.override.dy || 0), {
          ox: 0.5, oy: 1, alpha: this.alpha, rot: this.override.rot || 0, flip: this.override.flip,
        });
        return;
      }
      if (this.flipX) {
        G.draw(this.frame(), 2 * sx - x0, y0, { alpha: this.alpha, fill: '#fff', fillAmt: this.flash, flip: true });
      } else {
        G.draw(this.frame(), x0, y0, { alpha: this.alpha, fill: '#fff', fillAmt: this.flash });
      }
    }
  }
  DF.PartyBattler = PartyBattler;

  /*
   * Enemy: Flowery or one of the Flowers. Drawn bottom-centred at (x, y).
   */
  class EnemyBattler {
    constructor(o) {
      Object.assign(
        this,
        {
          id: 'flowery',
          name: 'Flowery',
          hp: 999,
          maxhp: 999,
          mercy: 0,
          x: 510,
          y: 250,
          prefix: 'flowery/idle',
          fps: 8,
          loop: true,
          flip: false,
          alpha: 1,
          visible: true,
          selectable: true,
          scale: 2,
          t: 0,
          shake: 0,
          flash: 0,
          flashColor: '#fff',
          tint: null,
          rainbow: false,
          bob: 0,
          frameOverride: null,
          glow: 0,
          offX: 0,
          offY: 0,
          rot: 0,
        },
        o || {}
      );
    }
    setPose(prefix, fps, loop, flip) {
      this.prefix = prefix;
      this.fps = fps || 8;
      this.loop = loop !== false;
      this.t = 0;
      if (flip !== undefined) this.flip = flip;
    }
    idle() {
      if (this.id === 'flowery') this.setPose('flowery/idle', 8, true, false);
      else this.setPose('gang/' + this.id, DF.GANG[this.id].fps, true, DF.GANG[this.id].flip);
    }
    update(dt) {
      this.t += dt;
      if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 14);
      if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 2.5);
    }
    frame() {
      if (this.frameOverride) return this.frameOverride;
      if (G.has(this.prefix)) return this.prefix;
      return G.frameAt(this.prefix, this.t, this.fps, this.loop);
    }
    top() {
      const s = G.size(this.frame());
      return this.y - s.h * this.scale;
    }
    center() {
      const s = G.size(this.frame());
      return { x: this.x + this.offX, y: this.y + this.offY - (s.h * this.scale) / 2 };
    }
    // Where speech bubbles point.
    mouth() {
      const s = G.size(this.frame());
      return { x: this.x + this.offX - (s.w * this.scale) / 2 + 6, y: this.y + this.offY - s.h * this.scale * 0.78 };
    }
    draw() {
      if (!this.visible || this.alpha <= 0) return;
      const shakeX = this.shake > 0 ? Math.sin(this.t * 70) * this.shake * 2 : 0;
      const bob = this.bob ? Math.sin(this.t * 2.2) * this.bob : 0;
      const name = this.frame();
      const x = Math.round(this.x + this.offX + shakeX);
      const y = Math.round(this.y + this.offY + bob);
      const tint = this.rainbow ? U.rainbow() : this.tint;
      // HARD MODE: a red outline that throbs like a heartbeat.
      if (this.determined && !this.rainbow) {
        const beat = 0.3 + 0.2 * Math.max(0, Math.sin(this.t * 5));
        for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) {
          G.drawFill(name, x + dx, y + dy, '#ff1010', { ox: 0.5, oy: 1, flip: this.flip, alpha: this.alpha * beat, scale: this.scale, rot: this.rot });
        }
      }
      if (this.glow > 0) {
        const g = this.rainbow ? U.rainbow(3) : this.glowColor || '#fff';
        for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) {
          G.drawFill(name, x + dx, y + dy, g, { ox: 0.5, oy: 1, flip: this.flip, alpha: this.alpha * this.glow, scale: this.scale, rot: this.rot });
        }
      }
      G.draw(name, x, y, {
        ox: 0.5, oy: 1, flip: this.flip, alpha: this.alpha, scale: this.scale, rot: this.rot,
        tint: this.rainbow ? null : tint, fill: this.rainbow ? tint : this.flashColor, fillAmt: this.rainbow ? 0.45 : this.flash,
      });
      // The stolen red SOUL, beating in his chest.
      if (this.determined) {
        const s = G.size(name);
        const beat = 1 + 0.25 * Math.max(0, Math.sin(this.t * 5));
        G.draw('heart/heart', x, y - s.h * this.scale * 0.55, { scale: beat, ox: 0.5, oy: 0.5, tint: '#ff0000', alpha: this.alpha });
      }
    }
  }
  DF.EnemyBattler = EnemyBattler;
})();
