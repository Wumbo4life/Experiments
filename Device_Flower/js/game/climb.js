/* Device_Flower - the finale: climb the beanstalk ahead of the rising thorns, then the last JARONA. */
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
      this.boss = null;
      this.cine = null;
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
      if (this.cine) {
        this.cine.t += rawDt;
        return;
      }
      if (this.state === 'climb') this.updateClimb(dt);
      else if (this.state === 'final') this.updateFinal(dt);
      // Trail.
      if (s.state === 'dash' || s.boostT > 0) s.trail.push({ x: s.x, y: s.y, t: 0 });
      for (const p of s.trail) p.t += dt;
      while (s.trail.length && s.trail[0].t > 0.2) s.trail.shift();
      // Camera.
      const target = this.state === 'final' ? TOP - 140 : s.y - 300;
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
      // Omega Flowery dives.
      for (const d of this.divers) this.updateDiver(d, dt, false);
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

    updateDiver(d, dt, isBoss) {
      const s = this.s;
      d.t += dt;
      if (d.state === 'tele') {
        d.x = U.approach(d.x, s.x, 140 * dt);
        d.y = this.camY - 50;
        if (d.t > (isBoss ? 1.3 : 0.75)) {
          d.state = 'dive';
          d.t = 0;
          Audio.play('heavyswing', { vol: 0.7 });
        }
      } else if (d.state === 'dive') {
        d.y += (isBoss ? 380 : 520) * dt;
        const hh = isBoss ? 50 : 34;
        const hw = isBoss ? 24 : 16;
        const gap = s.y - s.r - (d.y + hh);
        d.blue = gap < (isBoss ? 110 : 115) && gap > -hh * 2;
        const touching = Math.abs(d.x - s.x) < hw + s.r && Math.abs(d.y - s.y) < hh + s.r;
        if (touching) {
          if (s.state === 'dash' && s.dy < -0.3) {
            this.parryDiver(d, isBoss);
          } else if (s.inv <= 0) {
            this.hurt(isBoss ? 30 : 24);
            if (isBoss) {
              d.state = 'recoil';
              d.t = 0;
            }
          }
        }
        if (!isBoss && d.y > this.camY + 560) d.gone = true;
        if (isBoss && d.y > s.y + 80) {
          d.state = 'recoil';
          d.t = 0;
        }
      } else if (d.state === 'parried') {
        d.y -= 500 * dt;
        d.rot = (d.rot || 0) + dt * 14;
        if (d.t > 0.8) d.gone = true;
      } else if (d.state === 'recoil') {
        d.y = U.lerp(d.y, this.camY - 50, Math.min(1, dt * 4));
        if (d.t > 1.0) {
          d.state = 'tele';
          d.t = 0;
          this.msg = { text: 'DASH UP into him when he turns BLUE!', t: 0 };
        }
      }
    }
    parryDiver(d, isBoss) {
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
      if (isBoss) {
        d.state = 'won';
        this.win();
      } else {
        d.state = 'parried';
        d.t = 0;
      }
    }

    beginFinal() {
      if (this.state !== 'climb') return;
      this.state = 'final';
      Audio.stopLoop('wind', 1);
      this.petals.length = 0;
      this.divers.length = 0;
      const self = this;
      this.seq = new DF.Script(
        (function* () {
          self.msg = { text: '', t: 0 };
          yield 0.6;
          Audio.voice('fl_last_jarona');
          self.boss = { x: 320, y: self.camY - 80, state: 'enter', t: 0, blue: false };
          self.msg = { text: 'OMEGA FLOWERY: LAST... JARONA!!', t: 0 };
          yield* DF.tween(self.boss, { y: TOP - 200 }, 1.0, 'outCubic');
          self.boss.state = 'tele';
          self.boss.t = 0;
          self.msg = { text: 'DASH UP into him when he turns BLUE!', t: 0 };
        })()
      );
    }

    updateFinal(dt) {
      const s = this.s;
      this.moveSoul(dt);
      s.y = U.clamp(s.y, TOP - 120, TOP + 120);
      const b = this.boss;
      if (!b || b.state === 'enter' || b.state === 'won') {
        this.slow = 1;
        return;
      }
      this.updateDiver(b, dt, true);
      // Slow motion inside the parry window.
      this.slow = b.state === 'dive' && b.blue ? 0.35 : 1;
    }

    win() {
      const self = this;
      this.slow = 1;
      DF.Music.stop(0.4);
      this.seq = new DF.Script(
        (function* () {
          Audio.play('ultraswing', { vol: 0.9 });
          self.fx.screenFlash('#ffffff', 1, 2);
          self.cine = { t: 0 };
          yield 0.5;
          Audio.play('scytheburst', { vol: 0.9 });
          yield 0.6;
          Audio.voice('vc_im_falling');
          Audio.play('badexplosion', { vol: 0.7 });
          yield 2.2;
          yield* DF.tween(self, { white: 1 }, 0.8);
          yield 0.4;
          self.done = true;
        })()
      );
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
      if (this.boss) this.drawDiver(this.boss, 1.8);
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
      if (!(s.inv > 0 && Math.floor(s.inv * 15) % 2 === 0) && !this.cine) {
        const fl = 3 + Math.sin(DF.time * 40) * 1.5 + (s.state === 'dash' || s.boostT > 0 ? 6 : 0);
        G.rect(Math.round(s.x - 1), Math.round(this.sy(s.y) + 9), 2, Math.round(fl), '#ffd080', 0.8);
        G.draw('heart/heart', Math.round(s.x), Math.round(this.sy(s.y)), { scale: 1, ox: 0.5, oy: 0.5, rot: Math.PI, tint: '#ffa020', fill: '#fff', fillAmt: s.flash });
      }
      this.drawHUD(prog);
      if (this.cine) this.drawCinematic();
      if (this.white > 0) G.rect(0, 0, 640, 480, '#ffffff', this.white);
    }

    drawDiver(d, scale) {
      if (d.gone || d.state === 'won') return;
      const y = this.sy(d.y);
      if (d.state === 'tele') {
        G.rect(Math.round(d.x - 22), 0, 44, 480, U.rainbow(), 0.08 + 0.1 * (Math.floor(d.t * 12) % 2));
        G.drawFill(G.frameAt('flowery/powerup', d.t, 12, true), d.x, Math.max(40, y + 40), U.rainbow(), { scale, ox: 0.5, oy: 0.5 });
        G.draw('fx/alert', d.x, Math.max(40, y + 40) - 50, { scale: 2, ox: 0.5, oy: 0.5 });
        return;
      }
      const f = G.frameAt('flowery/jarona', d.t, 18, true);
      const col = d.blue ? '#2a6aff' : U.rainbow();
      G.drawFill(f, d.x, y, col, { scale, ox: 0.5, oy: 0.5, rot: Math.PI / 2 + (d.rot || 0), alpha: d.state === 'parried' ? Math.max(0, 1 - d.t) : 1 });
      if (d.blue && d.state === 'dive') {
        G.circle(d.x, y + 34 * (scale / 1.2), 10 + Math.sin(this.t * 50) * 3, '#5aa0ff', 0.4);
        if (this.state === 'final') G.text('[Z]', this.s.x, this.sy(this.s.y) + 18, { size: 16, align: 'center', color: '#80c0ff', outline: '#000' });
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

    drawCinematic() {
      const c = this.cine;
      const t = c.t;
      const ctx = G.ctx;
      G.rect(0, 0, 640, 480, '#000000', Math.min(0.85, t * 2));
      const bars = Math.min(1, t * 3) * 70;
      G.rect(0, 0, 640, bars, '#000');
      G.rect(0, 480 - bars, 640, bars, '#000');
      // Kris slashes across; Omega Flowery shatters into seven colors.
      const kx = U.lerp(120, 330, U.ease.outCubic(Math.min(1, t / 0.6)));
      const frame = G.frameAt('kplat/slash', t, 16, false);
      G.draw(frame, kx, 250, { scale: 3, ox: 0.5, oy: 0.5 });
      if (t < 1.1) {
        G.drawFill(G.frameAt('flowery/powerup', t, 12, true), 470 + Math.sin(t * 60) * (t > 0.6 ? 4 : 0), 230, U.rainbow(), { scale: 2.2, ox: 0.5, oy: 0.5, flip: true });
      } else if (!c.burst) {
        c.burst = true;
        this.fx.petalBurst(470, 230, 40, U.RAINBOW);
        this.fx.screenFlash('#ffffff', 0.8, 2);
        this.fx.screenShake(10);
      }
      if (t > 0.45 && t < 1.2) {
        const k = (t - 0.45) / 0.75;
        ctx.save();
        ctx.globalAlpha = 1 - k;
        for (let i = 0; i < 7; i++) G.line(260, 330 - i * 4, 640, 130 - i * 4, U.RAINBOW[i], 3);
        ctx.restore();
      }
      if (t > 1.3) G.text('FLOWERY was defeated!', 320, 400, { size: 32, align: 'center', color: '#ffffff', alpha: Math.min(1, (t - 1.3) * 2) });
    }
  }
  DF.Climb = Climb;
})();
