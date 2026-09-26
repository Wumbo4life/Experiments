/* Device_Flower - Susie's Idea: climb ahead of the rising thorns. OMEGA FLOWERY forms at the top. */
(function () {
  'use strict';
  const DF = window.DF;
  const G = DF.G;
  const U = DF.U;
  const Input = DF.Input;
  const Audio = DF.Audio;

  const LEFT = 180;
  const RIGHT = 460;
  const TOP = -3400;

  class Climb {
    constructor(bt) {
      this.bt = bt;
      this.fx = bt.fx;
      this.t = 0;
      this.done = false;
      this.failed = false;
      this.state = 'climb';
      this.s = { x: 320, y: 0, py: 0, r: 6, state: 'free', stateT: 0, dx: 0, dy: -1, dashCD: 0, inv: 0, boostT: 0, flash: 0, trail: [] };
      this.camY = -300;
      this.thornY = 250;
      this.obs = this.build();
      this.petals = [];
      this.divers = [];
      this.msg = { text: 'CLIMB!   [ARROWS] Move   [Z] Dash', t: 0 };
      this.slow = 1;
      this.omega = null;
      this.white = 0;
      this.seq = null;
      Audio.loop('wind', 'windloop', 0.22);
    }
    build() {
      const O = [];
      const add = (y, type, o) => O.push(Object.assign({ y, type, alive: true, fired: false, t: 0 }, o || {}));
      add(-260, 'branch', { x1: LEFT, x2: LEFT + 170 });
      add(-420, 'branch', { x1: RIGHT - 170, x2: RIGHT });
      add(-560, 'boost', { x: LEFT + 60 });
      add(-730, 'blue');
      add(-890, 'branch', { x1: LEFT, x2: LEFT + 140 });
      add(-890, 'branch', { x1: RIGHT - 70, x2: RIGHT });
      add(-1030, 'petals');
      add(-1200, 'dive');
      add(-1340, 'blue');
      add(-1470, 'boost', { x: RIGHT - 60 });
      add(-1650, 'branch', { x1: RIGHT - 200, x2: RIGHT });
      add(-1810, 'branch', { x1: LEFT, x2: LEFT + 200 });
      add(-1960, 'dive');
      add(-2110, 'blue');
      add(-2250, 'petals');
      add(-2410, 'branch', { x1: LEFT, x2: LEFT + 110 });
      add(-2410, 'branch', { x1: RIGHT - 110, x2: RIGHT });
      add(-2550, 'boost', { x: 320 });
      add(-2750, 'blue');
      add(-2890, 'dive');
      add(-3050, 'branch', { x1: RIGHT - 190, x2: RIGHT });
      add(-3190, 'blue');
      return O;
    }
    sy(wy) {
      return wy - this.camY;
    }
    hurt(dmg) {
      const s = this.s;
      if (s.inv > 0 || this.done) return;
      s.inv = 1.0;
      Audio.play('hurt', { vol: 0.8 });
      this.fx.screenShake(4);
      if (DF.debug && DF.debug.god) return;
      const bt = this.bt;
      const alive = bt.party.filter((m) => !m.down);
      if (alive.length) bt.damageMember(U.choose(alive), dmg);
      bt.stats.hits++;
      if (bt.party.every((m) => m.down)) {
        this.failed = true;
        this.done = true;
        Audio.stopLoop('wind');
        bt.soul.x = s.x;
        bt.soul.y = this.sy(s.y);
      }
    }

    update(rawDt) {
      const dt = rawDt * this.slow;
      this.t += dt;
      this.msg.t += rawDt;
      const s = this.s;
      if (s.inv > 0) s.inv = Math.max(0, s.inv - dt);
      if (s.flash > 0) s.flash = Math.max(0, s.flash - dt * 4);
      s.dashCD -= dt;
      if (this.seq) this.seq.update(rawDt);
      if (this.omega) this.omega.t += rawDt;
      if (this.state === 'climb') this.updateClimb(dt);
      else if (this.state === 'final') this.updateFinal(dt);
      // Trail.
      if (s.state === 'dash' || s.boostT > 0) s.trail.push({ x: s.x, y: s.y, t: 0 });
      for (const p of s.trail) p.t += dt;
      while (s.trail.length && s.trail[0].t > 0.2) s.trail.shift();
      // Camera.
      const target = this.state === 'final' ? TOP - 300 : s.y - 300;
      this.camY = U.lerp(this.camY, target, Math.min(1, dt * 6));
    }

    moveSoul(dt) {
      const s = this.s;
      s.py = s.y;
      const ax = Input.axis();
      if (Input.pressed('confirm') && s.dashCD <= 0) {
        let dx = ax.x;
        let dy = ax.y;
        if (!dx && !dy) dy = -1;
        const l = Math.hypot(dx, dy);
        s.dx = dx / l;
        s.dy = dy / l;
        s.state = 'dash';
        s.stateT = 0;
        s.dashCD = 0.32;
        Audio.play('wing', { vol: 0.5, pitch: 1.3 });
      }
      if (s.state === 'dash') {
        s.stateT += dt;
        s.x += s.dx * 640 * dt;
        s.y += s.dy * 640 * dt;
        if (s.stateT > 0.15) s.state = 'free';
      } else {
        const sp = Input.down('cancel') ? 100 : 200;
        s.x += ax.x * sp * dt;
        s.y += ax.y * sp * dt;
      }
      if (s.boostT > 0) {
        s.boostT -= dt;
        s.y -= 540 * dt;
      }
      s.x = U.clamp(s.x, LEFT + s.r, RIGHT - s.r);
    }

    updateClimb(dt) {
      const s = this.s;
      this.moveSoul(dt);
      // Obstacles.
      for (const o of this.obs) {
        if (!o.alive) continue;
        o.t += dt;
        if (o.type === 'blue') {
          const top = o.y - 8;
          const bot = o.y + 8;
          if (s.y - s.r < bot && s.y + s.r > top) {
            if (s.state === 'dash' || s.boostT > 0) {
              o.alive = false;
              this.bt.gainTP(3);
              this.bt.stats.breaks++;
              Audio.play('break2', { vol: 0.7 });
              for (let i = 0; i < 12; i++) {
                this.fx.add({ frame: 'fx/leaf_1', anim: 'fx/leaf', fps: 10, loop: true, x: U.rand(LEFT, RIGHT), y: this.sy(o.y), vx: U.rand(-120, 120), vy: U.rand(-160, 40), grav: 380, life: 0.8, tint: '#60a0ff', scale: 1.5 });
              }
            } else if (s.py - s.r >= bot - 2) {
              s.y = bot + s.r;
            } else if (s.py + s.r <= top + 2) {
              s.y = top - s.r;
            }
          }
        } else if (o.type === 'branch') {
          if (s.inv <= 0 && U.circleRect(s.x, s.y, s.r, o.x1, o.y - 7, o.x2 - o.x1, 14)) this.hurt(22);
        } else if (o.type === 'boost') {
          if (U.dist(s.x, s.y, o.x, o.y) < s.r + 16 && s.boostT <= 0) {
            s.boostT = 0.5;
            Audio.play('boost', { vol: 0.7 });
            this.fx.shockRing(o.x, this.sy(o.y), '#4a9aff', 50, 0.4);
          }
        } else if (o.type === 'petals' && !o.fired && s.y < o.y + 260) {
          o.fired = true;
          for (let i = 0; i < 14; i++) {
            this.petals.push({ x: U.rand(LEFT + 10, RIGHT - 10), y: this.camY - 20 - i * 34, vy: U.rand(90, 140), vx: U.rand(-30, 30), t: 0, rot: 0 });
          }
        } else if (o.type === 'dive' && !o.fired && s.y < o.y + 200) {
          o.fired = true;
          this.divers.push({ x: s.x, y: this.camY - 60, state: 'tele', t: 0, blue: false });
          Audio.voice(U.choose(['fl_jarona1', 'fl_jarona2', 'fl_jarona3']));
        }
      }
      // Falling petals.
      for (const p of this.petals) {
        p.t += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += dt * 4;
        if (s.inv <= 0 && U.dist(p.x, p.y, s.x, s.y) < s.r + 5) this.hurt(16);
      }
      this.petals = this.petals.filter((p) => p.y < this.camY + 520);
      // Flowery dives down the stalk.
      for (const d of this.divers) this.updateDiver(d, dt);
      this.divers = this.divers.filter((d) => !d.gone);
      // Thorns.
      const spd = Math.min(125, 60 + this.t * 5);
      this.thornY = Math.min(this.thornY - spd * dt, s.y + 196);
      if (s.y + s.r > this.thornY) {
        this.hurt(24);
        s.y = this.thornY - 60;
        s.boostT = Math.max(s.boostT, 0.15);
      }
      if (s.y < TOP + 130) this.beginFinal();
    }

    updateDiver(d, dt) {
      const s = this.s;
      d.t += dt;
      if (d.state === 'tele') {
        d.x = U.approach(d.x, s.x, 140 * dt);
        d.y = this.camY - 50;
        if (d.t > 0.75) {
          d.state = 'dive';
          d.t = 0;
          Audio.play('heavyswing', { vol: 0.7 });
        }
      } else if (d.state === 'dive') {
        d.y += 520 * dt;
        const hh = 34;
        const hw = 16;
        const gap = s.y - s.r - (d.y + hh);
        d.blue = gap < 115 && gap > -hh * 2;
        const touching = Math.abs(d.x - s.x) < hw + s.r && Math.abs(d.y - s.y) < hh + s.r;
        if (touching) {
          if (s.state === 'dash' && s.dy < -0.3) this.parryDiver(d);
          else if (s.inv <= 0) this.hurt(24);
        }
        if (d.y > this.camY + 560) d.gone = true;
      } else if (d.state === 'parried') {
        d.y -= 500 * dt;
        d.rot = (d.rot || 0) + dt * 14;
        if (d.t > 0.8) d.gone = true;
      }
    }
    parryDiver(d) {
      const s = this.s;
      const bt = this.bt;
      s.state = 'free';
      s.flash = 1;
      s.inv = Math.max(s.inv, 0.3);
      bt.stats.parries++;
      if (s.stateT <= 0.06) bt.stats.perfects++;
      bt.gainTP(6);
      Audio.play('impact', { vol: 0.9 });
      Audio.play('bell', { vol: 0.6 });
      this.fx.screenShake(6);
      this.fx.shockRing(s.x, this.sy(s.y) - 20, '#ffff60', 80, 0.4);
      this.fx.label(s.x + 30, this.sy(s.y) - 30, 'PARRY!', '#ffff40', { size: 16, life: 0.8 });
      d.state = 'parried';
      d.t = 0;
    }

    // At the top, the six Flowers pour their colors into FLOWERY: OMEGA FLOWERY.
    beginFinal() {
      if (this.state !== 'climb') return;
      this.state = 'final';
      Audio.stopLoop('wind', 1);
      this.petals.length = 0;
      this.divers.length = 0;
      const self = this;
      const om = (this.omega = { x: 320, y: TOP - 170, t: 0, r: 170, spin: 0, alpha: 0, beams: 0, rainbow: false, enter: 0 });
      this.seq = new DF.Script(
        (function* () {
          self.msg = { text: '', t: 0 };
          yield* DF.tween(om, { enter: 1 }, 0.8, 'outCubic');
          Audio.voice('vc_with_your_powers_combined');
          self.msg = { text: 'FLOWERY: Everyone...! With your powers combined...!', t: 0 };
          yield 0.6;
          Audio.play('sparkle', { vol: 0.7 });
          yield* DF.tween(om, { alpha: 1 }, 0.5);
          Audio.voice('vc_powering_up');
          yield* DF.tween(om, { beams: 1 }, 0.4);
          for (let i = 0; i < 6; i++) {
            Audio.play('power', { vol: 0.5, pitch: 1 + i * 0.1 });
            self.fx.shockRing(om.x, self.sy(om.y), U.RAINBOW[i], 80, 0.4);
            yield 0.28;
          }
          yield* DF.tween(om, { r: 0 }, 0.6, 'inCubic');
          Audio.voice('fl_omega');
          Audio.play('omegarona', { vol: 0.7 });
          self.fx.screenFlash('#ffffff', 1, 1.2);
          self.fx.screenShake(10);
          om.rainbow = true;
          self.msg = { text: 'FLOWERY became OMEGA FLOWERY!', t: 0 };
          yield 2.2;
          yield* DF.tween(self, { white: 1 }, 0.6);
          self.done = true;
        })()
      );
    }

    updateFinal(dt) {
      const s = this.s;
      this.moveSoul(dt);
      s.y = U.clamp(s.y, TOP - 40, TOP + 150);
      if (this.omega) this.omega.spin += dt * 3;
    }

    // ---- drawing ------------------------------------------------------------------
    draw() {
      const ctx = G.ctx;
      const prog = U.clamp(-this.s.y / -TOP, 0, 1);
      // Sky: dusk -> gold as you near the top.
      const g = ctx.createLinearGradient(0, 0, 0, 480);
      g.addColorStop(0, U.hsl(270 - prog * 40, 60, 6 + prog * 10));
      g.addColorStop(1, U.hsl(320 - prog * 40, 55, 14 + prog * 18));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 640, 480);
      for (let i = 0; i < 60; i++) {
        const x = (i * 97) % 640;
        const y = ((i * 53 - this.camY * 0.15) % 480 + 480) % 480;
        G.rect(x, Math.round(y), 2, 2, '#ffffff', 0.25 + ((i * 13) % 5) / 10);
      }
      // The Fountain, waiting at the top.
      const fy = this.sy(TOP - 300);
      if (fy > -400) {
        const k = 0.7 + Math.sin(this.t * 3) * 0.1;
        G.rect(290, fy - 600, 60, 700, '#ffffff', 0.12 * k);
        G.rect(305, fy - 600, 30, 700, '#ffffff', 0.25 * k);
        G.rect(314, fy - 600, 12, 700, '#ffffff', 0.7 * k);
      }
      // Beanstalk.
      // Stalk segments are anchored to world space so leaves scroll with the climb.
      const first = Math.floor((this.camY - 60) / 40);
      for (let i = first; i < first + 16; i++) {
        const y = Math.round(i * 40 - this.camY);
        const sway = Math.round(Math.sin(i * 0.7) * 3);
        G.rect(296 + sway, y, 48, 41, '#0e3a12');
        G.rect(300 + sway, y, 40, 41, '#2e8a2a');
        G.rect(308 + sway, y, 6, 41, '#6ad04a');
        G.rect(300 + sway, y + 30, 40, 3, '#1a5a1a');
        const h = ((i * 2654435761) >>> 0) % 7;
        if (h < 3) {
          const right = h % 2 === 0;
          G.draw('bloom/leaves_1', right ? 358 + sway : 282 + sway, y + 18, { scale: 1.5, ox: 0.5, oy: 0.5, flip: !right, tint: h === 0 ? '#80ff80' : '#c0ffa0' });
        }
      }
      G.rect(LEFT - 4, 0, 2, 480, '#ffffff', 0.08);
      G.rect(RIGHT + 2, 0, 2, 480, '#ffffff', 0.08);
      // Obstacles.
      for (const o of this.obs) {
        if (!o.alive) continue;
        const y = this.sy(o.y);
        if (y < -40 || y > 520) continue;
        if (o.type === 'branch') {
          G.rect(o.x1, y - 7, o.x2 - o.x1, 14, '#0e3a12');
          G.rect(o.x1, y - 5, o.x2 - o.x1, 10, '#3a7a2a');
          for (let x = o.x1 + 6; x < o.x2 - 4; x += 12) {
            G.ctx.fillStyle = '#e8ffe0';
            G.ctx.beginPath();
            G.ctx.moveTo(x, y - 7);
            G.ctx.lineTo(x + 3, y - 14);
            G.ctx.lineTo(x + 6, y - 7);
            G.ctx.moveTo(x + 6, y + 7);
            G.ctx.lineTo(x + 9, y + 14);
            G.ctx.lineTo(x + 12, y + 7);
            G.ctx.fill();
          }
        } else if (o.type === 'blue') {
          const pulse = 0.6 + Math.sin(this.t * 8 + o.y) * 0.25;
          G.rect(LEFT, y - 8, RIGHT - LEFT, 16, '#1c4ab0');
          G.rect(LEFT, y - 5, RIGHT - LEFT, 10, '#4a9aff', pulse);
          G.rect(LEFT, y - 1, RIGHT - LEFT, 2, '#d0e8ff', 0.8);
        } else if (o.type === 'boost') {
          const bob = Math.sin(this.t * 5 + o.y) * 3;
          G.draw(G.frameAt('bloom/blue', this.t, 6, true), o.x, y + bob, { scale: 0.8, ox: 0.5, oy: 0.5 });
          G.draw('bloom/boost_1', o.x, y + bob, { scale: 1.2, ox: 0.5, oy: 0.5, rot: -Math.PI / 2 });
        }
      }
      // Petals and dives.
      for (const p of this.petals) {
        G.draw(G.frameAt('petal/spinning', p.t, 12, true), p.x, this.sy(p.y), { scale: 1.5, ox: 0.5, oy: 0.5, rot: p.rot });
      }
      for (const d of this.divers) this.drawDiver(d, 1.2);
      if (this.omega) this.drawOmega();
      // Thorns rising from below.
      const ty = this.sy(this.thornY);
      if (ty < 520) {
        G.rect(0, ty + 10, 640, 480, '#1a0508');
        for (let x = 0; x < 640; x += 16) {
          const h = 16 + ((x * 7) % 11) + Math.sin(this.t * 6 + x) * 3;
          G.ctx.fillStyle = '#5a0a14';
          G.ctx.beginPath();
          G.ctx.moveTo(x, ty + 12);
          G.ctx.lineTo(x + 8, ty + 12 - h);
          G.ctx.lineTo(x + 16, ty + 12);
          G.ctx.fill();
          G.ctx.fillStyle = '#ffe0e0';
          G.ctx.beginPath();
          G.ctx.moveTo(x + 6, ty + 14 - h + 6);
          G.ctx.lineTo(x + 8, ty + 12 - h);
          G.ctx.lineTo(x + 10, ty + 14 - h + 6);
          G.ctx.fill();
        }
      }
      // SOUL (facing up).
      const s = this.s;
      for (const p of s.trail) G.draw('heart/heart', p.x, this.sy(p.y), { scale: 1, ox: 0.5, oy: 0.5, rot: Math.PI, tint: '#ffa020', alpha: 0.4 * (1 - p.t / 0.2) });
      if (!(s.inv > 0 && Math.floor(s.inv * 15) % 2 === 0)) {
        const fl = 3 + Math.sin(DF.time * 40) * 1.5 + (s.state === 'dash' || s.boostT > 0 ? 6 : 0);
        G.rect(Math.round(s.x - 1), Math.round(this.sy(s.y) + 9), 2, Math.round(fl), '#ffd080', 0.8);
        G.draw('heart/heart', Math.round(s.x), Math.round(this.sy(s.y)), { scale: 1, ox: 0.5, oy: 0.5, rot: Math.PI, tint: '#ffa020', fill: '#fff', fillAmt: s.flash });
      }
      this.drawHUD(prog);
      if (this.white > 0) G.rect(0, 0, 640, 480, '#ffffff', this.white);
    }

    drawDiver(d, scale) {
      if (d.gone) return;
      const y = this.sy(d.y);
      if (d.state === 'tele') {
        G.rect(Math.round(d.x - 22), 0, 44, 480, '#ffffff', 0.06 + 0.08 * (Math.floor(d.t * 12) % 2));
        G.draw(G.frameAt('flowery/powerup', d.t, 12, true), d.x, Math.max(40, y + 40), { scale, ox: 0.5, oy: 0.5 });
        G.draw('fx/alert', d.x, Math.max(40, y + 40) - 50, { scale: 2, ox: 0.5, oy: 0.5 });
        return;
      }
      const f = G.frameAt('flowery/jarona', d.t, 18, true);
      const col = d.blue ? '#2a6aff' : '#ffffff';
      G.drawFill(f, d.x, y, col, { scale, ox: 0.5, oy: 0.5, rot: Math.PI / 2 + (d.rot || 0), alpha: d.state === 'parried' ? Math.max(0, 1 - d.t) : 1 });
      if (d.blue && d.state === 'dive') G.circle(d.x, y + 34 * (scale / 1.2), 10 + Math.sin(this.t * 50) * 3, '#5aa0ff', 0.4);
    }

    // FLOWERY at the top of the stalk, the six Flowers circling and pouring in their colors.
    drawOmega() {
      const om = this.omega;
      const x = om.x;
      const y = this.sy(om.y) - (1 - om.enter) * 200;
      const ids = ['aqua', 'seth', 'orange', 'green', 'yellow', 'blue'];
      ids.forEach((id, i) => {
        const a = (i / ids.length) * Math.PI * 2 + om.spin;
        const px = x + Math.cos(a) * om.r;
        const py = y + Math.sin(a) * om.r * 0.55;
        if (om.beams > 0 && om.alpha > 0) {
          G.ctx.save();
          G.ctx.globalAlpha = om.beams * om.alpha;
          G.line(px, py, x, y, DF.GANG[id].color, 4);
          G.ctx.restore();
        }
        if (om.r > 2) G.draw(G.frameAt('gang/' + id, DF.time, DF.GANG[id].fps, true), px, py, { ox: 0.5, oy: 0.5, scale: 1.2, alpha: om.alpha });
      });
      const f = om.rainbow ? G.frameAt('flowery/poweringup', om.t, 10, true) : G.frameAt('flowery/powerup', om.t, 12, true);
      if (om.rainbow) {
        for (let i = 0; i < 7; i++) G.ring(x, y, 60 + i * 7 + Math.sin(om.t * 6 + i) * 3, U.RAINBOW[(i + Math.floor(om.t * 10)) % 7], 3, 0.35);
        G.draw(f, x, y, { scale: 2, ox: 0.5, oy: 0.5, fill: U.rainbow(), fillAmt: 0.5 });
      } else {
        G.draw(f, x, y, { scale: 2, ox: 0.5, oy: 0.5, flip: true });
      }
    }

    drawHUD(prog) {
      // Height meter.
      G.rect(604, 60, 10, 300, '#000000', 0.6);
      G.rect(604, 60 + Math.round(300 * (1 - prog)), 10, Math.round(300 * prog), '#ffd020');
      G.text('TOP', 609, 40, { size: 16, align: 'center', color: '#ffffff' });
      // Party HP.
      this.bt.party.forEach((m, i) => {
        const x = 12;
        const y = 420 + i * 26;
        G.rect(x - 4, y - 4, 150, 24, '#000000', 0.6);
        G.draw('icon/' + m.id + '_head', x, y - 2, { scale: 0.75 });
        G.rect(x + 30, y + 6, 76, 9, '#800000');
        if (m.hp > 0) G.rect(x + 30, y + 6, Math.ceil((m.hp / m.maxhp) * 76), 9, m.color);
        G.bitmapText('smallnumbers', String(m.hp), x + 112, y + 5, { color: m.hp <= 0 ? '#ff0000' : '#ffffff', fill: true });
      });
      if (this.msg.text && this.msg.t < 4) {
        const a = this.msg.t < 0.2 ? this.msg.t / 0.2 : this.msg.t > 3.3 ? (4 - this.msg.t) / 0.7 : 1;
        G.text(this.msg.text, 320, 440, { size: 16, align: 'center', color: '#ffff80', alpha: a, outline: '#000', outlineWidth: 4 });
      }
    }
  }
  DF.Climb = Climb;
})();
