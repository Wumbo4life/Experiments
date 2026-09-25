/* Device_Flower - enemy turns ("waves"): the runner, special bullets and every attack pattern. */
(function () {
  'use strict';
  const DF = window.DF;
  const G = DF.G;
  const U = DF.U;
  const B = DF.Bullets;
  const Bullet = DF.Bullet;

  class Wave {
    constructor(battle, id) {
      this.battle = battle;
      this.arena = battle.arena;
      this.soul = battle.soul;
      this.fx = battle.fx;
      this.id = id;
      this.bullets = [];
      this.t = 0;
      this.damage = battle.waveDamage();
      this.pool = new DF.ScriptPool();
      this.windDir = 0;
      this.hops = 0;
      this.hint = null;
      this.hintT = 0;
      const fn = WAVES[id];
      this.main = this.pool.run(fn(this, battle, this.arena, this.soul), 'wave:' + id);
    }
    get done() {
      return this.main.done;
    }
    run(gen) {
      return this.pool.run(gen, 'wave-sub');
    }
    spawn(b) {
      this.bullets.push(b);
      return b;
    }
    hintOnce(key, text) {
      const bt = this.battle;
      if (bt.hints[key]) return;
      bt.hints[key] = true;
      this.hint = text;
      this.hintT = 0;
    }
    update(dt) {
      this.t += dt;
      this.hintT += dt;
      this.pool.update(dt);
      for (let i = 0; i < this.bullets.length; i++) {
        const b = this.bullets[i];
        if (b.alive) b.update(dt, this);
      }
      this.collide(dt);
      this.bullets = this.bullets.filter((b) => b.alive);
    }
    collide(dt) {
      const s = this.soul;
      const bt = this.battle;
      if (!s.visible || s.locked) return;
      const grazeExtra = s.grazeR - s.r;
      for (const b of this.bullets) {
        if (!b.alive || !b.active || b.kind === 'none') continue;
        const touching = b.hits(s, 0);
        if (!touching) {
          if (b.kind === 'white' || b.kind === 'blue') {
            if (!(b.ground && s.hopping) && b.hits(s, grazeExtra)) {
              if (!b.grazed) {
                b.grazed = true;
                bt.graze(1.0);
              } else bt.graze(1.6 * dt, true);
            }
          }
          continue;
        }
        if (b.onTouch && b.onTouch(b, s, this) === true) continue;
        if (b.kind === 'green') {
          b.alive = false;
          bt.gainTP(4);
          this.fx.sparkles(b.x, b.y, 5, '#40ff60', 90);
          DF.Audio.play('sparkle', { vol: 0.5, minGap: 0.05 });
          this.fx.label(b.x, b.y - 10, '+TP', '#40ff60', { size: 16, rise: 20, life: 0.7 });
          continue;
        }
        if (b.kind === 'heal') {
          b.alive = false;
          bt.healLowest(8);
          continue;
        }
        if (b.kind === 'lily') {
          if (s.dashing) {
            b.alive = false;
            this.hops++;
            s.hop(0.6);
            s.bounce();
            DF.Audio.play('bounceflower_quick', { vol: 0.7 });
            this.fx.add({ ringFx: true, x: b.x, y: b.y, r: 8, grow: 30, color: '#3a8aff', lw: 3, life: 0.35 });
            bt.gainTP(2);
          }
          continue;
        }
        if (b.kind === 'blue' && s.dashing) {
          this.shatter(b);
          continue;
        }
        if (b.ground && s.hopping) continue;
        if (s.inv > 0) continue;
        bt.hitSoul(b.damage || this.damage);
        if (b.destroyOnHit) b.alive = false;
      }
    }
    shatter(b, color) {
      b.alive = false;
      this.battle.gainTP(2);
      this.battle.stats.breaks++;
      DF.Audio.play(U.chance(0.5) ? 'break1' : 'break2', { vol: 0.5, minGap: 0.04 });
      for (let i = 0; i < 5; i++) {
        const ang = U.rand(-1.2, 1.2);
        const sp = U.rand(90, 200);
        this.fx.add({ frame: 'heart/shard_1', anim: 'heart/shard', fps: 12, loop: true, x: b.x, y: b.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, grav: 300, life: 0.45, tint: color || '#5aa0ff', scale: 1 });
      }
    }
    // ---- helpers used by patterns ---------------------------------------------
    rY(m) {
      m = m === undefined ? 8 : m;
      return U.rand(this.arena.T + m, this.arena.B - m);
    }
    aimAt(x, y, speed) {
      const s = this.soul;
      const ang = Math.atan2(s.y - y, s.x - x);
      return { vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed };
    }
    petalBurst(x, y, n) {
      for (let i = 0; i < n; i++) {
        const ang = Math.PI + U.rand(-0.9, 0.9);
        const sp = U.rand(110, 170);
        this.spawn(B.petal(x + 20, y, Math.cos(ang) * sp, Math.sin(ang) * sp, { fadeIn: 0.15 }));
      }
    }
    // A visual-only object.
    deco(o) {
      return this.spawn(new Bullet(Object.assign({ kind: 'none', margin: 600 }, o)));
    }

    /*
     * A charging attacker (Flowery's JARONA, Orange's punch, Omega...). It telegraphs at the right
     * edge, then rushes left. Dash into it while it glows blue to PARRY.
     */
    charger(o) {
      const w = this;
      const a = this.arena;
      const s = this.soul;
      const who = o.who || 'flowery';
      const sizes = { flowery: [70, 26], omega: [74, 28], orange: [54, 26], blue: [56, 60] };
      const [cw, ch] = sizes[who] || sizes.flowery;
      const b = new Bullet({
        x: a.R + 46,
        y: U.clamp(o.y, a.T + 14, a.B - 14),
        shape: 'rect',
        w: cw,
        h: ch,
        clip: false,
        margin: 600,
        active: false,
        state: 'tele',
        teleT: o.tele || 0.7,
        tele0: o.tele || 0.7,
        speed: o.speed || 420,
        who,
        blue: false,
        damage: Math.round(this.damage * 1.4),
        after: [],
        onUpdate(b, dt) {
          if (b.state === 'tele') {
            b.teleT -= dt;
            if (o.track && b.teleT > b.tele0 * 0.35) b.y = U.approach(b.y, U.clamp(s.y, a.T + 14, a.B - 14), 160 * dt);
            if (b.teleT <= 0) {
              b.state = 'charge';
              b.active = true;
              b.vx = -b.speed;
              if (o.voice && who !== 'orange') DF.Audio.voice(U.choose(['fl_jarona1', 'fl_jarona2', 'fl_jarona3', 'fl_jarona4']));
              else DF.Audio.play('heavyswing', { vol: 0.6, pitch: who === 'orange' ? 1.4 : 1 });
            }
          } else if (b.state === 'charge') {
            const gap = b.x - b.w / 2 - (s.x + s.r);
            b.blue = gap < 125 && gap > -b.w;
            b.after.push({ x: b.x, y: b.y, t: 0 });
            if (b.x < a.L - 120) b.alive = false;
          } else if (b.state === 'parried') {
            b.alpha = Math.max(0, 1 - b.pt / 0.6);
            b.pt += dt;
            if (b.pt > 0.6) b.alive = false;
          }
          for (const p of b.after) p.t += dt;
          while (b.after.length && b.after[0].t > 0.12) b.after.shift();
        },
        onTouch(b, s2) {
          if (b.state !== 'charge') return true;
          if (s2.dashing) {
            w.parry(b, o);
            return true;
          }
          return false;
        },
        drawFn(b) {
          w.drawCharger(b);
        },
      });
      this.spawn(b);
      DF.Audio.play('charge', { vol: 0.35, pitch: who === 'orange' ? 1.5 : 1.2 });
      return b;
    }
    parry(b, o) {
      const s = this.soul;
      const bt = this.battle;
      const q = s.state === 'dash' ? s.stateT : 1;
      let grade;
      let tp;
      if (q <= 0.055) {
        grade = 'PERFECT!';
        tp = 9;
        bt.stats.perfects++;
      } else if (q <= 0.105) {
        grade = 'GREAT!';
        tp = 6;
      } else {
        grade = 'GOOD';
        tp = 3;
      }
      bt.stats.parries++;
      b.state = 'parried';
      b.active = false;
      b.pt = 0;
      b.vx = 520;
      b.vy = U.rand(-120, -40);
      b.ay = 400;
      b.spin = 14;
      s.bounce();
      s.flash = 1;
      s.inv = Math.max(s.inv, 0.25);
      bt.gainTP(tp);
      DF.Audio.play('impact', { vol: 0.8 });
      if (grade === 'PERFECT!') DF.Audio.play('bell', { vol: 0.6 });
      this.fx.hit((b.x + s.x) / 2, s.y, 0.6);
      this.fx.shockRing(s.x + 10, s.y, grade === 'PERFECT!' ? '#ffff60' : '#80c0ff', 70, 0.35);
      this.fx.screenShake(4);
      this.fx.label(s.x + 20, s.y - 26, grade, grade === 'PERFECT!' ? '#ffff40' : '#80d0ff', { size: 16, rise: 26, life: 0.8 });
      if (o.onParry) o.onParry(b);
    }
    drawCharger(b) {
      const a = this.arena;
      const alpha = b.alpha;
      const blueFill = '#2a6aff';
      if (b.state === 'tele') {
        // Warning line + the attacker winding up at the edge of the board.
        const k = 1 - b.teleT / b.tele0;
        G.rect(a.L, Math.round(b.y) - 1, a.w, 2, b.who === 'orange' ? '#ffa040' : '#ffffff', 0.15 + 0.35 * Math.abs(Math.sin(k * 18)));
        const ex = a.R + 30;
        if (b.who === 'orange') {
          G.draw('gang/orange_1', ex, b.y + Math.sin(k * 30) * 3, { ox: 0.5, oy: 0.5 });
        } else if (b.who === 'blue') {
          G.draw(G.frameAt('gang/blue', k, 3, true), ex, b.y, { ox: 0.5, oy: 0.5, scale: 1 });
        } else {
          const f = G.frameAt('flowery/powerup', k * b.tele0, 12, true);
          if (b.who === 'omega') G.drawFill(f, ex, b.y, U.rainbow(), { ox: 0.5, oy: 0.5, scale: 1.3, flip: true });
          else G.draw(f, ex, b.y, { ox: 0.5, oy: 0.5, scale: 1.3, flip: true });
        }
        G.draw('fx/alert', ex - 4, b.y - 42, { scale: 2, ox: 0.5, oy: 0.5, alpha: Math.floor(k * 10) % 2 ? 1 : 0.4 });
        return;
      }
      const fillCol = b.blue ? blueFill : null;
      const draw = (x, y, al, glow) => {
        if (b.who === 'orange') {
          G.draw('gang/orange_1', x, y, { ox: 0.5, oy: 0.5, alpha: al, rot: b.rot, fill: fillCol || '#fff', fillAmt: fillCol ? 0.75 : 0 });
        } else if (b.who === 'blue') {
          G.draw(G.frameAt('gang/blue', b.t, 6, true), x, y, { ox: 0.5, oy: 0.5, scale: 1, alpha: al, rot: b.rot, fill: fillCol || '#fff', fillAmt: fillCol ? 0.75 : 0 });
        } else {
          const f = G.frameAt('flowery/jarona', b.t, 18, true);
          const col = fillCol || (b.who === 'omega' ? U.rainbow(glow ? 2 : 0) : '#ffffff');
          G.drawFill(f, x, y, col, { ox: 0.5, oy: 0.5, scale: 1.3, alpha: al, rot: b.rot });
        }
      };
      for (const p of b.after) draw(p.x, p.y, 0.35 * (1 - p.t / 0.12) * alpha, true);
      if (b.blue && b.state === 'charge') {
        G.circle(b.x - b.w / 2, b.y, 10 + Math.sin(b.t * 50) * 3, '#5aa0ff', 0.35);
      }
      draw(b.x, b.y, alpha, false);
    }

    // A vertical wall of thorny vine with one BLUE section you can dash through.
    vineWall(o) {
      const a = this.arena;
      const w = this;
      const blueH = o.blueH || 36;
      const b = new Bullet({
        x: a.R + 16,
        y: a.cy,
        vx: -o.speed,
        w: 14,
        blueY: U.clamp(o.blueY, a.T + blueH / 2 + 4, a.B - blueH / 2 - 4),
        blueH,
        broken: false,
        margin: 300,
        hitFn(b, s, extra) {
          if (Math.abs(s.x - b.x) > b.w / 2 + s.r + extra) return false;
          if (b.broken) return false;
          return true;
        },
        onTouch(b, s) {
          const g1 = b.blueY - b.blueH / 2;
          const g2 = b.blueY + b.blueH / 2;
          const inBlue = s.y - s.r >= g1 - 4 && s.y + s.r <= g2 + 4;
          if (inBlue && s.dashing) {
            b.broken = true;
            w.battle.gainTP(3);
            w.battle.stats.breaks++;
            DF.Audio.play('break2', { vol: 0.6 });
            for (let i = 0; i < 8; i++) {
              w.fx.add({ frame: 'fx/leaf_1', anim: 'fx/leaf', fps: 10, loop: true, x: b.x, y: U.rand(g1, g2), vx: U.rand(-40, 160), vy: U.rand(-120, 60), grav: 300, life: 0.6, tint: '#60a0ff', scale: 1.5 });
            }
            return true;
          }
          return false;
        },
        drawFn(b) {
          const g1 = b.blueY - b.blueH / 2;
          const g2 = b.blueY + b.blueH / 2;
          drawVine(b.x, a.T - 4, g1, b.t);
          drawVine(b.x, g2, a.B + 4, b.t);
          if (!b.broken) {
            const pulse = 0.6 + Math.sin(b.t * 10) * 0.25;
            G.rect(Math.round(b.x - 6), Math.round(g1), 12, Math.round(b.blueH), '#1c4ab0');
            G.rect(Math.round(b.x - 4), Math.round(g1 + 2), 8, Math.round(b.blueH - 4), '#4a9aff', pulse);
            G.rect(Math.round(b.x - 1), Math.round(g1 + 4), 2, Math.round(b.blueH - 8), '#d0e8ff', 0.8);
          }
        },
      });
      return this.spawn(b);
    }

    // Prism beam: warning line, then a band across the whole board.
    beam(y, color, warn, dur, h) {
      const a = this.arena;
      h = h || 14;
      const b = new Bullet({
        x: a.cx,
        y,
        shape: 'rect',
        w: a.w + 40,
        h: 0,
        active: false,
        margin: 800,
        life: warn + dur + 0.3,
        onUpdate(b) {
          if (b.t < warn) {
            b.active = false;
            b.h = 0;
          } else if (b.t < warn + dur) {
            if (!b.fired) {
              b.fired = true;
              DF.Audio.play('spearrise', { vol: 0.5, minGap: 0.05 });
            }
            b.active = true;
            b.h = h;
          } else {
            b.active = false;
          }
        },
        drawFn(b) {
          if (b.t < warn) {
            const k = b.t / warn;
            G.rect(a.L, Math.round(y) - 1, a.w, 2, color, 0.3 + 0.5 * (Math.floor(k * 12) % 2));
          } else {
            const k = U.clamp((b.t - warn) / dur, 0, 1);
            const hh = h * (k < 0.2 ? k / 0.2 : k > 0.8 ? (1 - k) / 0.2 : 1) + 2;
            G.rect(a.L, Math.round(y - hh / 2), a.w, Math.round(hh), color, 0.9);
            G.rect(a.L, Math.round(y - hh / 4), a.w, Math.max(1, Math.round(hh / 2)), '#ffffff', 0.9);
          }
        },
      });
      return this.spawn(b);
    }

    // Yellow's shot: a crosshair locks onto the SOUL, then a bullet flies along that line.
    yellowShot(o) {
      const a = this.arena;
      const s = this.soul;
      const w = this;
      const aim = o.aim || 0.6;
      const lock = o.lock || 0.25;
      const ctl = { fired: false };
      const ret = this.deco({
        x: s.homeX,
        y: s.y,
        drawFn(b) {
          const k = b.t / (aim + lock);
          const locked = b.t > aim;
          const col = locked ? (o.blue ? '#4a9aff' : '#ffe040') : '#ffffff';
          const r = 16 - Math.min(1, k) * 6;
          G.ring(b.x, b.y, r, col, 2, 0.9);
          G.rect(b.x - r - 6, Math.round(b.y) - 1, 8, 2, col);
          G.rect(b.x + r - 2, Math.round(b.y) - 1, 8, 2, col);
          G.rect(Math.round(b.x) - 1, b.y - r - 6, 2, 8, col);
          G.rect(Math.round(b.x) - 1, b.y + r - 2, 2, 8, col);
          if (locked) G.rect(b.x + r + 6, Math.round(b.y), a.R - b.x - r - 6, 1, col, 0.5);
        },
        onUpdate(b) {
          if (b.t < aim) b.y = U.approach(b.y, s.y, 260 * DF.STEP);
          if (b.t >= aim + lock && !ctl.fired) {
            ctl.fired = true;
            b.alive = false;
            DF.Audio.play('punchmed', { vol: 0.35, pitch: 1.8 });
            w.shot(a.R + 12, b.y, -820, 0, o.blue);
          }
        },
      });
      ctl.reticle = ret;
      return ctl;
    }
    shot(x, y, vx, vy, blue) {
      const w = this;
      const b = new Bullet({
        x, y, vx, vy,
        shape: 'rect', w: 20, h: 8,
        kind: blue ? 'blue' : 'white',
        canvas: DF.PIX.shot,
        fill: blue ? '#4a9aff' : null,
        rotateToVel: true,
        destroyOnHit: true,
        onTouch(b, s) {
          if (b.kind === 'blue' && s.dashing) {
            b.kind = 'none';
            b.vx = 700;
            b.vy = U.rand(-60, 60);
            b.fill = '#ffff80';
            w.battle.gainTP(5);
            w.battle.stats.parries++;
            DF.Audio.play('bell', { vol: 0.5 });
            w.fx.label(s.x + 18, s.y - 24, 'REFLECT!', '#80d0ff', { size: 16, rise: 24, life: 0.7 });
            return true;
          }
          return false;
        },
      });
      return this.spawn(b);
    }
    draw() {
      const ctx = G.ctx;
      const a = this.arena;
      // Wind streaks.
      if (this.windDir) {
        ctx.save();
        a.clip();
        for (let i = 0; i < 14; i++) {
          const xx = a.R - ((this.t * 260 + i * 53) % (a.w + 60));
          const yy = a.T + ((i * 37 + this.t * 90 * this.windDir) % a.h + a.h) % a.h;
          G.rect(Math.round(xx), Math.round(yy), 18, 1, '#ffffff', 0.25);
        }
        ctx.restore();
      }
      ctx.save();
      a.clip();
      for (const b of this.bullets) if (b.clip) b.draw();
      ctx.restore();
      for (const b of this.bullets) if (!b.clip) b.draw();
    }
    drawHint() {
      if (!this.hint || this.hintT > 4.5) return;
      const a = this.arena;
      const alpha = this.hintT < 0.3 ? this.hintT / 0.3 : this.hintT > 3.8 ? (4.5 - this.hintT) / 0.7 : 1;
      G.text(this.hint, a.cx, a.B + 12, { size: 16, align: 'center', color: '#ffff80', alpha, outline: '#000', outlineWidth: 4 });
    }
    finish() {
      this.soul.forceY = 0;
      this.arena.lanes = 0;
      for (const b of this.bullets) b.alive = false;
      this.bullets.length = 0;
    }
  }
  DF.Wave = Wave;

  function drawVine(x, y1, y2, t) {
    if (y2 <= y1) return;
    const X = Math.round(x);
    G.rect(X - 6, Math.round(y1), 12, Math.round(y2 - y1), '#0e3a12');
    G.rect(X - 4, Math.round(y1), 8, Math.round(y2 - y1), '#2e8a2a');
    G.rect(X - 2, Math.round(y1), 2, Math.round(y2 - y1), '#6ad04a');
    // Thorns alternate left/right.
    for (let yy = Math.ceil(y1 / 10) * 10; yy < y2 - 4; yy += 10) {
      const side = (yy / 10) % 2 === 0 ? -1 : 1;
      const tx = X + side * 6;
      G.ctx.fillStyle = '#e8ffe0';
      G.ctx.beginPath();
      G.ctx.moveTo(tx, yy);
      G.ctx.lineTo(tx + side * 6, yy + 3);
      G.ctx.lineTo(tx, yy + 6);
      G.ctx.fill();
    }
  }
  DF.drawVine = drawVine;

  // ======================================================================
  // Attack patterns. Each is a generator: (wave, battle, arena, soul).
  // ======================================================================
  const WAVES = (DF.WAVES = {});
  const WHITE_WORDS = ['WRONG', 'QUIZ', 'DOUBT', 'TYPO', 'ERROR', 'NOPE', 'LATE', 'FAIL', 'F-', 'REDO'];
  const GREEN_WORDS = ['A+', 'SMART', 'PASS', 'NEAT', 'GOOD'];

  // ---- Phase 1 ------------------------------------------------------------
  WAVES.petals = function* (w, bt, a) {
    w.hintOnce('dash', '[Z] to DASH!  Dash into BLUE things to break them!');
    let n = 0;
    while (w.t < 7.6) {
      const y = w.rY(8);
      if (n % 3 === 2) {
        w.spawn(B.bluePetal(a.R + 10, y, -U.rand(120, 150), 0));
      } else {
        const b = w.spawn(B.petal(a.R + 10, y, -U.rand(150, 200), 0));
        b.baseY = y;
        b.amp = U.rand(6, 16);
        b.freq = U.rand(2, 4);
        b.onUpdate = (p) => {
          p.y = p.baseY + Math.sin(p.t * p.freq) * p.amp;
        };
      }
      n++;
      yield 0.25;
    }
    yield 1.5;
  };

  WAVES.jarona = function* (w, bt) {
    w.hintOnce('parry', 'DASH into FLOWERY just as he turns BLUE to PARRY!');
    bt.hideEnemy(bt.flowery);
    for (let i = 0; i < 5; i++) {
      const c = w.charger({ who: 'flowery', y: w.soul.y, speed: 380 + i * 25, tele: 0.8 - i * 0.05, track: true, voice: i === 0 || i === 4, onParry: (b) => w.petalBurst(b.x, b.y, 4) });
      yield () => c.state !== 'tele';
      yield 1.05;
    }
    yield 0.9;
    bt.showEnemy(bt.flowery);
  };

  WAVES.vines = function* (w, bt, a) {
    w.hintOnce('vine', 'Line up with the BLUE part of the vine and DASH!');
    for (let i = 0; i < 6; i++) {
      w.vineWall({ speed: 118 + i * 8, blueY: w.rY(24), blueH: 38 });
      yield 0.85;
      w.spawn(B.petal(a.R + 10, w.rY(8), -175, 0));
      yield 0.8;
    }
    yield 1.9;
  };

  // ---- Phase 2 ------------------------------------------------------------
  WAVES.spiral = function* (w, bt, a) {
    const ex = a.R - 34;
    const ey = a.cy;
    const em = w.deco({
      x: ex,
      y: ey,
      drawFn(b) {
        G.draw(G.frameAt('bloom/blue', b.t, 8, true), b.x, b.y, { scale: 1, ox: 0.5, oy: 0.5, rot: b.t * 4, tint: '#ffffff', alpha: Math.min(1, b.t * 4) });
      },
    });
    let ang = 0;
    let n = 0;
    while (w.t < 8) {
      for (let k = 0; k < 3; k++) {
        const aa = ang + (k * Math.PI * 2) / 3;
        const sp = 118;
        if (n % 7 === 6) w.spawn(B.bluePetal(ex, ey, Math.cos(aa) * sp, Math.sin(aa) * sp));
        else w.spawn(B.petal(ex, ey, Math.cos(aa) * sp, Math.sin(aa) * sp));
        n++;
      }
      ang += 0.37;
      yield 0.11;
    }
    em.alive = false;
    yield 1.4;
  };

  WAVES.jarona2 = function* (w, bt, a) {
    bt.hideEnemy(bt.flowery);
    for (let i = 0; i < 6; i++) {
      const c = w.charger({ who: 'flowery', y: w.soul.y, speed: 460 + i * 18, tele: 0.62, track: true, voice: i === 0, onParry: (b) => w.petalBurst(b.x, b.y, 5) });
      yield () => c.state !== 'tele';
      yield 0.5;
      for (let k = 0; k < 3; k++) {
        const y = w.rY(10);
        const v = w.aimAt(a.R + 10, y, 185);
        w.spawn(B.petal(a.R + 10, y, v.vx, v.vy));
        yield 0.12;
      }
      yield 0.45;
    }
    yield 1.0;
    bt.showEnemy(bt.flowery);
  };

  WAVES.wind = function* (w, bt, a, s) {
    w.hintOnce('wind', 'The MYSTERIOUS WIND pushes your SOUL around!');
    w.run(
      (function* () {
        let dir = U.chance(0.5) ? 1 : -1;
        while (w.t < 8.4) {
          w.windDir = dir;
          s.forceY = dir * 85;
          DF.Audio.play('wing', { vol: 0.4, pitch: 0.6 });
          yield 2.0;
          dir = -dir;
        }
        s.forceY = 0;
        w.windDir = 0;
      })()
    );
    let n = 0;
    while (w.t < 8.4) {
      const y = w.rY(6);
      if (n % 5 === 4) w.spawn(B.blueOrb(a.R + 16, y, -115, w.windDir * 35));
      else w.spawn(B.petal(a.R + 10, y, -U.rand(160, 210), w.windDir * 55));
      n++;
      yield 0.19;
    }
    s.forceY = 0;
    w.windDir = 0;
    yield 1.3;
  };

  // ---- Phase 3: Aqua & Seth -------------------------------------------------
  function* bookWords(w, a, until, gap, greenEvery) {
    const laneH = a.h / 3;
    const speeds = [125, 150, 108];
    let n = 0;
    let lastLane = -1;
    while (w.t < until) {
      let lane = U.randInt(0, 2);
      if (lane === lastLane) lane = (lane + U.randInt(1, 2)) % 3;
      lastLane = lane;
      const y = a.T + laneH * (lane + 0.5);
      const green = n % greenEvery === greenEvery - 1;
      w.spawn(B.word(a.R + 70, y, -speeds[lane], U.choose(green ? GREEN_WORDS : WHITE_WORDS), green));
      n++;
      yield U.rand(gap * 0.85, gap * 1.15);
    }
  }
  WAVES.books = function* (w, bt, a) {
    w.hintOnce('words', 'Dodge WHITE words.  Grab GREEN words for TP!');
    a.lanes = 3;
    yield* DF.tween(a, { laneAlpha: 1 }, 0.3);
    yield* bookWords(w, a, 8.3, 0.5, 4);
    yield 2.2;
    yield* DF.tween(a, { laneAlpha: 0 }, 0.3);
    a.lanes = 0;
  };

  function* aquaKnife(w, a) {
    const y = w.rY(10);
    w.deco({
      x: a.R - 6,
      y,
      life: 0.35,
      drawFn(b) {
        G.circle(b.x, b.y, 7 + b.t * 20, '#00ffff', 0.6 * (1 - b.t / 0.35));
      },
    });
    yield 0.3;
    const v = w.aimAt(a.R + 6, y, 235);
    w.spawn(B.knife(a.R + 6, y, v.vx, v.vy));
    DF.Audio.play('smallswing', { vol: 0.4, minGap: 0.05 });
  }

  WAVES.knives = function* (w, bt, a) {
    w.hintOnce('lily', 'DASH onto a LILY PAD to hop over the knives!');
    let spd = 150;
    for (let i = 0; i < 6; i++) {
      const y = w.rY(22);
      w.spawn(B.lily(a.R + 24, y, -spd));
      w.spawn(B.knifeWall(w, a.R + 24 + 50, -spd));
      yield (0.8 * 150) / spd;
      if (i > 0) yield* aquaKnife(w, a);
      yield (0.75 * 150) / spd;
      spd = 150 * Math.pow(1.08, w.hops + 1);
    }
    yield 1.8;
  };

  WAVES.aquaseth = function* (w, bt, a) {
    a.lanes = 3;
    yield* DF.tween(a, { laneAlpha: 1 }, 0.3);
    w.run(
      (function* () {
        yield 1.0;
        while (w.t < 8) {
          yield* aquaKnife(w, a);
          yield 0.95;
        }
      })()
    );
    yield* bookWords(w, a, 8.3, 0.72, 3);
    yield 2.2;
    yield* DF.tween(a, { laneAlpha: 0 }, 0.3);
    a.lanes = 0;
  };

  // ---- Phase 4: Orange & Green ------------------------------------------------
  function* glovePinch(w, a) {
    const s = w.soul;
    const y = s.y;
    for (const side of [-1, 1]) {
      const g = w.spawn(B.glove(a.R + 14, U.clamp(y + side * 46, a.T + 8, a.B - 8), -230, -side * 60));
      g.onUpdate = (b) => {
        b.vy = U.approach(b.vy, -side * 0, 200 * DF.STEP);
      };
    }
    DF.Audio.play('glove', { vol: 0.5 });
  }
  WAVES.punches = function* (w, bt, a) {
    w.hintOnce('orange', "ORANGE's punches can be PARRIED too!");
    const orange = bt.enemyById('orange');
    bt.hideEnemy(bt.flowery);
    if (orange) bt.hideEnemy(orange);
    for (let i = 0; i < 7; i++) {
      const who = i % 2 === 0 ? 'orange' : 'flowery';
      const c = w.charger({
        who,
        y: w.soul.y,
        speed: who === 'orange' ? 540 : 450,
        tele: who === 'orange' ? 0.55 : 0.68,
        track: true,
        voice: i === 1,
        onParry: who === 'orange' ? () => w.run(glovePinch(w, a)) : (b) => w.petalBurst(b.x, b.y, 4),
      });
      yield () => c.state !== 'tele';
      yield 1.0;
    }
    yield 1.2;
    bt.showEnemy(bt.flowery);
    if (orange) bt.showEnemy(orange);
  };

  WAVES.kitchen = function* (w, bt, a) {
    w.hintOnce('heal', "GREEN's dishes heal you. Pans do not!");
    let n = 0;
    while (w.t < 8.4) {
      w.spawn(B.pan(a.R + 10, U.rand(a.cy - 10, a.B - 6), -U.rand(135, 185), -U.rand(110, 190), { ay: 250 }));
      n++;
      if (n % 5 === 0) w.spawn(B.dish(a.R + 16, w.rY(20), -85, 0));
      yield 0.4;
    }
    yield 1.6;
  };

  WAVES.orangegreen = function* (w, bt, a) {
    const orange = bt.enemyById('orange');
    if (orange) bt.hideEnemy(orange);
    w.run(
      (function* () {
        let n = 0;
        while (w.t < 8.2) {
          w.spawn(B.pan(a.R + 10, U.rand(a.cy, a.B - 6), -U.rand(125, 170), -U.rand(110, 170), { ay: 250 }));
          n++;
          if (n % 6 === 0) w.spawn(B.dish(a.R + 16, w.rY(20), -85, 0));
          yield 0.62;
        }
      })()
    );
    for (let i = 0; i < 4; i++) {
      const c = w.charger({ who: 'orange', y: w.soul.y, speed: 520, tele: 0.6, track: true, onParry: () => w.run(glovePinch(w, a)) });
      yield () => c.state !== 'tele';
      yield 1.5;
    }
    yield 1.6;
    if (orange) bt.showEnemy(orange);
  };

  // ---- Phase 5: Yellow & Blue --------------------------------------------------
  function* sixShooter(w, a) {
    for (let k = 0; k < 6; k++) {
      const ang = Math.PI + (k - 2.5) * 0.13;
      w.shot(a.R + 10, a.cy, Math.cos(ang) * 210, Math.sin(ang) * 210, false);
    }
    DF.Audio.play('punchmed', { vol: 0.4, pitch: 1.5 });
    yield 0.01;
  }
  WAVES.showdown = function* (w, bt, a) {
    w.hintOnce('shot', 'DASH into BLUE bullets to knock them back!');
    for (let i = 0; i < 8; i++) {
      const sh = w.yellowShot({ blue: i % 3 === 2, aim: 0.62 - Math.min(i, 5) * 0.04, lock: 0.26 });
      yield () => sh.fired;
      yield 0.35;
      if (i % 3 === 1) {
        yield* sixShooter(w, a);
        yield 0.55;
      }
    }
    yield 1.3;
  };

  function* rings(w, a, until, gap, n) {
    const em = w.deco({
      x: a.R - 28,
      y: a.cy,
      drawFn(b) {
        G.draw(G.frameAt('gang/blue', b.t, 4, true), b.x, b.y, { scale: 0.8, ox: 0.5, oy: 0.5, flip: Math.floor(b.t * 8) % 2 === 0, alpha: Math.min(1, b.t * 4) });
      },
    });
    let k = 0;
    while (w.t < until) {
      em.y = a.cy + Math.sin(w.t * 1.5) * (a.h / 2 - 22);
      const blue = k % 2 === 1;
      const off = k * 0.26;
      for (let i = 0; i < n; i++) {
        const ang = off + (i * Math.PI * 2) / n;
        const sp = 108;
        if (blue) w.spawn(B.bluePetal(em.x, em.y, Math.cos(ang) * sp, Math.sin(ang) * sp));
        else w.spawn(B.pinkPetal(em.x, em.y, Math.cos(ang) * sp, Math.sin(ang) * sp));
      }
      DF.Audio.play('wing', { vol: 0.25, pitch: 1.6, minGap: 0.1 });
      k++;
      yield gap;
    }
    em.alive = false;
  }
  WAVES.ballet = function* (w, bt, a) {
    w.hintOnce('ballet', "BLUE's pirouettes: break the blue rings!");
    const blue = bt.enemyById('blue');
    if (blue) bt.hideEnemy(blue);
    w.run(rings(w, a, 8.2, 0.62, 12));
    yield 3.0;
    const c = w.charger({ who: 'blue', y: w.soul.y, speed: 430, tele: 0.7, track: true });
    yield () => c.state !== 'tele';
    yield 2.4;
    const c2 = w.charger({ who: 'blue', y: w.soul.y, speed: 460, tele: 0.65, track: true });
    yield () => c2.state !== 'tele';
    yield 3.2;
    if (blue) bt.showEnemy(blue);
  };

  WAVES.yellowblue = function* (w, bt, a) {
    w.run(rings(w, a, 8.0, 0.95, 10));
    yield 0.8;
    for (let i = 0; i < 6; i++) {
      const sh = w.yellowShot({ blue: i % 2 === 1, aim: 0.55, lock: 0.24 });
      yield () => sh.fired;
      yield 0.75;
    }
    yield 1.6;
  };

  // ---- Phase 6: OMEGA FLOWERY ----------------------------------------------------
  function* rainbowRain(w, a, until, gap) {
    while (w.t < until) {
      w.spawn(B.rainbowPetal(U.rand(a.L + 30, a.R + 90), a.T - 8, -U.rand(90, 130), U.rand(120, 160)));
      yield gap;
    }
  }
  WAVES.omega1 = function* (w, bt, a) {
    bt.hideEnemy(bt.flowery);
    w.run(rainbowRain(w, a, 8.6, 0.17));
    for (let i = 0; i < 6; i++) {
      const c = w.charger({ who: 'omega', y: w.soul.y, speed: 500 + i * 15, tele: 0.58, track: true, voice: i === 0 || i === 5, onParry: (b) => w.petalBurst(b.x, b.y, 3) });
      yield () => c.state !== 'tele';
      yield 1.0;
    }
    yield 1.2;
    bt.showEnemy(bt.flowery);
  };

  WAVES.omega2 = function* (w, bt, a) {
    w.hintOnce('prism', 'PRISM BLOW! Stay out of the colored lines!');
    const cols = U.RAINBOW;
    for (let round = 0; round < 3; round++) {
      const lanes = 6;
      const lh = a.h / lanes;
      const safe = U.randInt(0, lanes - 1);
      const safe2 = (safe + U.choose([2, 3])) % lanes;
      let c = 0;
      for (let i = 0; i < lanes; i++) {
        if (i === safe || i === safe2) continue;
        w.beam(a.T + lh * (i + 0.5), cols[(c++ + round * 2) % cols.length], 0.75, 0.4, lh - 4);
      }
      yield 1.35;
      w.vineWall({ speed: 165, blueY: w.rY(24), blueH: 36 });
      yield 1.35;
    }
    yield 1.4;
  };

  WAVES.omega3 = function* (w, bt, a) {
    w.hintOnce('omega3', 'All seven colors at once!');
    a.lanes = 3;
    yield* DF.tween(a, { laneAlpha: 1 }, 0.2);
    const t0 = w.t;
    yield* bookWords(w, a, t0 + 2.2, 0.45, 3);
    yield* DF.tween(a, { laneAlpha: 0 }, 0.2);
    a.lanes = 0;
    for (let i = 0; i < 2; i++) {
      w.spawn(B.lily(a.R + 24, w.rY(22), -175));
      w.spawn(B.knifeWall(w, a.R + 24 + 52, -175));
      yield 1.15;
    }
    yield* glovePinch(w, a);
    yield 0.9;
    for (let i = 0; i < 3; i++) {
      const sh = w.yellowShot({ blue: i === 2, aim: 0.45, lock: 0.2 });
      yield () => sh.fired;
      yield 0.35;
    }
    const c = w.charger({ who: 'omega', y: w.soul.y, speed: 560, tele: 0.7, track: true, voice: true, onParry: (b) => w.petalBurst(b.x, b.y, 6) });
    yield () => c.state !== 'tele';
    yield 1.8;
  };
})();
