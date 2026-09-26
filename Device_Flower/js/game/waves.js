/* Device_Flower - enemy turns ("waves"): the runner, special bullets and every attack pattern. */
(function () {
  'use strict';
  const DF = window.DF;
  const G = DF.G;
  const U = DF.U;
  const B = DF.Bullets;
  const Bullet = DF.Bullet;

  /*
   * Fairness. Every wave has a SAFE LINE: a height over time that the SOUL can always follow
   * (it never moves faster than the SOUL can). Random bullets are only launched if they stay
   * clear of it while they cross the SOUL's column, walls are planned so each opening can be
   * reached from the last one, and "quiet" windows keep the column empty while a charger is
   * on its way.
   */
  function wanderLine(a, k) {
    k = k || 1;
    const amp = a.h / 2 - 28;
    const p1 = U.rand(0, Math.PI * 2);
    const p2 = U.rand(0, Math.PI * 2);
    const w1 = U.rand(0.7, 1.0) * k;
    const w2 = U.rand(1.3, 1.7) * k;
    return (t) => a.cy + Math.sin(w1 * t + p1) * amp * 0.65 + Math.sin(w2 * t + p2) * amp * 0.35;
  }
  // A line through planned openings. points: [[time, y], ...]
  function pointLine(points) {
    return (t) => {
      if (t <= points[0][0]) return points[0][1];
      for (let i = 1; i < points.length; i++) {
        if (t <= points[i][0]) {
          const p = points[i - 1];
          const q = points[i];
          return U.lerp(p[1], q[1], (t - p[0]) / Math.max(0.001, q[0] - p[0]));
        }
      }
      return points[points.length - 1][1];
    };
  }

  const CHARGER_SIZES = { flowery: [70, 26], omega: [74, 28], orange: [54, 26], blue: [56, 60] };

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
      this.line = wanderLine(this.arena);
      this.slack = 0.2;
      this.quiet = [];
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
            s.hop(b.hopFor ? b.hopFor(b, s) : 0.6);
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

    // ---- fairness helpers ------------------------------------------------------
    // The range the safe line covers around wave time t, with slack for reaction time.
    band(t) {
      let lo = Infinity;
      let hi = -Infinity;
      for (let k = -2; k <= 2; k++) {
        const y = this.line(t + (k * this.slack) / 2);
        if (y < lo) lo = y;
        if (y > hi) hi = y;
      }
      return [lo, hi];
    }
    /*
     * Will a bullet launched now leave the safe line (and every quiet window) alone while it
     * crosses the SOUL's column? yAt(tau) is its height tau seconds from now; hw/hh its half size.
     */
    clearOf(x, vx, yAt, hw, hh, margin) {
      if (vx > -1) return true;
      const s = this.soul;
      const reach = s.r + hw;
      const t0 = Math.max(0, (x - (s.homeX + reach)) / -vx);
      const t1 = (x - (s.homeX - reach)) / -vx;
      if (t1 <= 0) return true;
      for (const q of this.quiet) if (this.t + t1 > q[0] && this.t + t0 < q[1]) return false;
      const need = hh + s.r + (margin === undefined ? 8 : margin);
      const n = Math.max(2, Math.ceil((t1 - t0) / 0.04) + 1);
      for (let i = 0; i < n; i++) {
        const tau = t0 + ((t1 - t0) * i) / (n - 1);
        const y = yAt(tau);
        const band = this.band(this.t + tau);
        const d = y < band[0] ? band[0] - y : y > band[1] ? y - band[1] : 0;
        if (d < need) return false;
      }
      return true;
    }
    clearLine(x, y, vx, vy, hw, hh, margin, ay) {
      ay = ay || 0;
      return this.clearOf(x, vx, (tau) => y + vy * tau + 0.5 * ay * tau * tau, hw, hh, margin);
    }
    // Try a few launch heights; returns one that passes `test`, or null.
    pickY(test, lo, hi, tries) {
      for (let i = 0; i < (tries || 10); i++) {
        const y = U.rand(lo, hi);
        if (test(y)) return y;
      }
      return null;
    }
    // Keep the SOUL's column empty while a charger launched at wave time `at` goes by, plus a
    // moment afterwards to get back to the safe line.
    reserveCharge(at, o) {
      const size = CHARGER_SIZES[o.who || 'flowery'];
      const tele = o.tele || 0.7;
      const pass = (this.arena.R + 46 + size[0] / 2 + this.soul.r - this.soul.homeX) / (o.speed || 420);
      this.quiet.push([at + tele * 0.4, at + tele + pass + 0.6]);
    }
    // Wait until nothing is still heading for the SOUL (at most `max` seconds).
    *settle(max) {
      const t0 = this.t;
      const s = this.soul;
      const a = this.arena;
      yield () => this.t - t0 >= max || !this.bullets.some((b) => b.alive && b.kind !== 'none' && b.kind !== 'lily' && b.kind !== 'heal' && b.vx < 0 && b.x + (b.w || b.r * 2) / 2 > s.x - 12 && b.x < a.R + 400);
      yield 0.25;
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
    // A visual-only object.
    deco(o) {
      return this.spawn(new Bullet(Object.assign({ kind: 'none', margin: 600 }, o)));
    }

    /*
     * A charging attacker (Flowery's JARONA, Orange's punch, Blue's pirouette). It telegraphs at
     * the right edge, then rushes left. DASH into it while it glows blue to PARRY.
     */
    charger(o) {
      const w = this;
      const a = this.arena;
      const s = this.soul;
      const who = o.who || 'flowery';
      const [cw, ch] = CHARGER_SIZES[who] || CHARGER_SIZES.flowery;
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
      this.fx.petalBurst(b.x, b.y, 6);
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
          const f = G.frameAt(b.who === 'omega' ? 'flowery/omegajarona' : 'flowery/jarona', b.t, 18, true);
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

    /*
     * A bamboo wall. openings: [{ y1, y2, type }] where 'gap' is empty and 'blue' is a BLUE
     * section that a DASH breaks open. Everything else is white stalk.
     */
    bamboo(o) {
      const a = this.arena;
      const w = this;
      const b = new Bullet({
        x: o.x || a.R + 20,
        y: a.cy,
        vx: -o.speed,
        w: 14,
        margin: 300,
        openings: o.openings,
        flowers: [],
        hitFn(b, s, extra) {
          if (Math.abs(s.x - b.x) > b.w / 2 + s.r + extra) return false;
          const y1 = s.y - s.r - extra;
          const y2 = s.y + s.r + extra;
          for (const op of b.openings) {
            if (op.type === 'blue' && !op.broken) continue;
            const tol = op.broken ? 6 : 2;
            if (y1 >= op.y1 - tol && y2 <= op.y2 + tol) return false;
          }
          return true;
        },
        onTouch(b, s) {
          if (!s.dashing) return false;
          for (const op of b.openings) {
            if (op.type !== 'blue' || op.broken) continue;
            if (s.y - s.r >= op.y1 - 5 && s.y + s.r <= op.y2 + 5) {
              op.broken = true;
              w.breakBamboo(b, op);
              return true;
            }
          }
          return false;
        },
        drawFn(b) {
          drawBamboo(b, a);
        },
      });
      return this.spawn(b);
    }
    breakBamboo(b, op) {
      const bt = this.battle;
      bt.gainTP(3);
      bt.stats.breaks++;
      DF.Audio.play('break2', { vol: 0.6, minGap: 0.04 });
      for (let i = 0; i < 8; i++) {
        this.fx.add({ frame: 'fx/leaf_1', anim: 'fx/leaf', fps: 10, loop: true, x: b.x, y: U.rand(op.y1, op.y2), vx: U.rand(-40, 180), vy: U.rand(-120, 60), grav: 300, life: 0.6, tint: '#60a0ff', scale: 1.5 });
      }
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
            G.rect(a.L, Math.round(y - h / 2), a.w, Math.round(h), color, 0.08 + 0.08 * k);
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
          drawReticle(b.x, b.y, b.t / (aim + lock), b.t > aim, o.blue, a);
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
        r: 4,
        kind: blue ? 'blue' : 'white',
        canvas: DF.PIX.shot,
        fill: blue ? '#4a9aff' : null,
        rotateToVel: true,
        destroyOnHit: true,
        // A thin segment along the bullet.
        hitFn(b, s, extra) {
          const c = Math.cos(b.rot);
          const d = Math.sin(b.rot);
          const d2 = U.segDist2(s.x, s.y, b.x - c * 9, b.y - d * 9, b.x + c * 9, b.y + d * 9);
          const r = s.r + 3 + extra;
          return d2 < r * r;
        },
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
        for (let i = 0; i < 18; i++) {
          const xx = a.R - ((this.t * 260 + i * 53) % (a.w + 60));
          const yy = a.T + ((i * 37 + this.t * 90 * this.windDir) % a.h + a.h) % a.h;
          G.rect(Math.round(xx), Math.round(yy), 18, 1, '#ffffff', 0.25);
        }
        ctx.restore();
      }
      ctx.save();
      a.clip();
      for (const b of this.bullets) if (b.clip) b.draw();
      if (DF.debug && DF.debug.showLine) {
        // Where the safe line will be when things now at each x reach the SOUL (at ~150px/s).
        for (let x = this.soul.homeX; x < a.R; x += 6) {
          const y = this.line(this.t + (x - this.soul.homeX) / 150);
          G.rect(x, Math.round(y) - 1, 3, 3, '#ff40ff', 0.8);
        }
      }
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
      this.arena.laneAlpha = 0;
      for (const b of this.bullets) b.alive = false;
      this.bullets.length = 0;
    }
  }
  DF.Wave = Wave;

  function drawReticle(x, y, k, locked, blue, a) {
    const col = locked ? (blue ? '#4a9aff' : '#ffe040') : '#ffffff';
    const r = 16 - Math.min(1, k) * 6;
    G.ring(x, y, r, col, 2, 0.9);
    G.rect(x - r - 6, Math.round(y) - 1, 8, 2, col);
    G.rect(x + r - 2, Math.round(y) - 1, 8, 2, col);
    G.rect(Math.round(x) - 1, y - r - 6, 2, 8, col);
    G.rect(Math.round(x) - 1, y + r - 2, 2, 8, col);
    if (locked) G.rect(x + r + 6, Math.round(y), a.R - x - r - 6, 1, col, 0.5);
  }

  // ---- bamboo -------------------------------------------------------------------
  function drawBamboo(b, a) {
    const X = Math.round(b.x);
    const bottom = a.B + 6;
    let y = a.T - 6;
    const ops = b.openings.slice().sort((p, q) => p.y1 - q.y1);
    for (const op of ops) {
      if (op.y1 > y) stalk(X, y, op.y1, false, b.t);
      if (op.type === 'blue' && !op.broken) stalk(X, op.y1, op.y2, true, b.t);
      else leafTufts(X, op.y1, op.y2);
      y = Math.max(y, op.y2);
    }
    if (y < bottom) stalk(X, y, bottom, false, b.t);
    for (const f of b.flowers) if (f.alive) G.drawCanvas(DF.PIX.flower, X, f.y, { scale: 2 });
  }
  function stalk(X, y1, y2, blue, t) {
    const Y1 = Math.round(y1);
    const Y2 = Math.round(y2);
    if (Y2 - Y1 < 3) return;
    const edge = blue ? '#0c2a80' : '#7c8898';
    const body = blue ? '#2a6aff' : '#ffffff';
    const shade = blue ? '#1a48c0' : '#cdd5e0';
    G.rect(X - 7, Y1, 14, Y2 - Y1, edge);
    G.rect(X - 5, Y1 + 1, 10, Y2 - Y1 - 2, body);
    G.rect(X - 5, Y1 + 1, 3, Y2 - Y1 - 2, shade);
    if (blue) G.rect(X - 1, Y1 + 3, 3, Math.max(1, Y2 - Y1 - 6), '#9ad0ff', 0.5 + Math.sin(t * 10) * 0.3);
    // Nodes sit on a fixed grid so they don't swim when a piece changes length.
    for (let yy = Math.ceil((Y1 + 7) / 26) * 26; yy < Y2 - 6; yy += 26) {
      G.rect(X - 8, yy - 1, 16, 3, edge);
      G.rect(X - 5, yy + 2, 10, 1, shade);
    }
  }
  // Little leaves where the stalk is cut open.
  function leafTufts(X, y1, y2) {
    G.rect(X + 5, Math.round(y1) - 4, 6, 2, '#6ad04a');
    G.rect(X - 10, Math.round(y2) + 2, 6, 2, '#6ad04a');
  }

  /*
   * A run of bamboo walls. o: { walls, speed, every, gap: [min, max], blues (extra BLUE sections
   * per wall), blueOnly (chance that a wall's way through is BLUE only), blueFrom, cacti (chance
   * of a cactus between walls), onWall(wall, plan, i) }.
   * Each opening is planned so it can be reached from the one before.
   */
  function* bambooRun(w, a, o) {
    const s = w.soul;
    const x0 = a.R + 20;
    const travel = (x0 - s.homeX) / o.speed;
    const pass = (14 + s.r * 2 + 6) / o.speed;
    const reach = 180 * Math.max(0.3, o.every - pass) * 0.55;
    const t0 = w.t;
    const plan = [];
    let prev = s.y;
    for (let i = 0; i < o.walls; i++) {
      const blueOnly = i >= (o.blueFrom || 0) && U.chance(o.blueOnly || 0);
      const h = blueOnly ? Math.max(38, o.gap[1]) : U.rand(o.gap[0], o.gap[1]);
      const lo = a.T + h / 2 + 4;
      const hi = a.B - h / 2 - 4;
      const r = i === 0 ? a.h : reach;
      const y = U.clamp(prev + U.rand(-r, r), lo, hi);
      const openings = [{ y1: y - h / 2, y2: y + h / 2, type: blueOnly ? 'blue' : 'gap' }];
      // Extra BLUE sections: a second way through for anyone who likes to DASH.
      for (let k = 0; k < (o.blues || 0); k++) {
        const bh = 36;
        const by = w.pickY((yy) => openings.every((op) => yy + bh / 2 + 16 < op.y1 || yy - bh / 2 - 16 > op.y2), a.T + bh / 2 + 4, a.B - bh / 2 - 4, 8);
        if (by !== null) openings.push({ y1: by - bh / 2, y2: by + bh / 2, type: 'blue' });
      }
      plan.push({ y, openings, at: t0 + i * o.every + travel });
      prev = y;
    }
    // The safe line holds each opening while its wall goes by.
    const pts = [];
    for (const p of plan) pts.push([p.at - pass, p.y], [p.at + pass, p.y]);
    w.line = pointLine(pts);
    w.slack = 0.35;
    for (let i = 0; i < plan.length; i++) {
      const p = plan[i];
      const wall = w.bamboo({ speed: o.speed, x: x0, openings: p.openings });
      if (o.onWall) o.onWall(wall, p, i);
      if (o.cacti && i + 1 < plan.length && U.chance(o.cacti)) cactusBetween(w, a, o, p, plan[i + 1], x0);
      yield o.every;
    }
    yield Math.max(0, travel - o.every + 0.3);
  }
  // A white cactus between two walls, kept off the whole stretch the SOUL has to cross.
  function cactusBetween(w, a, o, p, q, x0) {
    const top = Math.min(p.y, q.y) - 38;
    const bot = Math.max(p.y, q.y) + 38;
    const spots = [];
    if (top - (a.T + 12) > 0) spots.push(U.rand(a.T + 12, top));
    if (a.B - 12 - bot > 0) spots.push(U.rand(bot, a.B - 12));
    if (!spots.length) return;
    w.spawn(B.cactus(x0 + (o.speed * o.every) / 2, U.choose(spots), -o.speed));
  }

  // Yellow picks a flower off a bamboo wall; it bursts into BLUE butterflies.
  function* shootFlower(w, a, wall, fl, speed) {
    yield () => !wall.alive || wall.x < a.R - 30;
    if (!wall.alive) return;
    const ret = w.deco({
      x: wall.x,
      y: fl.y,
      onUpdate(b) {
        b.x = wall.x;
      },
      drawFn(b) {
        drawReticle(b.x, b.y, b.t / 0.6, b.t > 0.4, true, a);
      },
    });
    yield 0.6;
    ret.alive = false;
    if (!wall.alive || !fl.alive) return;
    fl.alive = false;
    const x = wall.x;
    const y = fl.y;
    DF.Audio.play('punchmed', { vol: 0.4, pitch: 1.8 });
    DF.Audio.play('wing', { vol: 0.35, pitch: 1.5 });
    w.deco({
      x, y, life: 0.15,
      drawFn(b) {
        G.rect(Math.round(b.x), Math.round(b.y) - 1, Math.round(a.R + 12 - b.x), 2, '#ffe040', 1 - b.t / 0.15);
      },
    });
    w.fx.sparkles(x, y, 6, '#80c0ff', 80);
    const vx = -(speed + 55);
    const freq = 4.2;
    let made = 0;
    for (const [amp, ph] of U.shuffle([[20, 0], [20, Math.PI], [28, Math.PI / 2], [28, -Math.PI / 2], [12, 0]])) {
      if (!w.clearOf(x, vx, (tau) => y + Math.sin(tau * freq + ph) * amp, 8, 7, 6)) continue;
      w.spawn(B.butterfly(x, y, vx, amp, freq, ph));
      if (++made >= 2) break;
    }
  }

  // ======================================================================
  // Attack patterns. Each is a generator: (wave, battle, arena, soul).
  // ======================================================================
  const WAVES = (DF.WAVES = {});
  const WHITE_WORDS = ['WRONG', 'QUIZ', 'DOUBT', 'TYPO', 'ERROR', 'NOPE', 'LATE', 'FAIL', 'F-', 'REDO'];
  const GREEN_WORDS = ['A+', 'SMART', 'PASS', 'NEAT', 'GOOD'];

  // ---- Phase 1 ------------------------------------------------------------
  WAVES.bamboo = function* (w, bt, a) {
    w.hintOnce('dash', 'Hold [Z] to charge, let go to DASH!  DASH through BLUE bamboo!');
    yield* bambooRun(w, a, { walls: 6, speed: 125, every: 1.45, gap: [44, 52], blues: 1 });
    yield 0.4;
  };

  WAVES.jarona = function* (w, bt) {
    w.hintOnce('parry', 'DASH into FLOWERY just as he turns BLUE to PARRY!');
    bt.hideEnemy(bt.flowery);
    for (let i = 0; i < 5; i++) {
      const c = w.charger({ who: 'flowery', y: w.soul.y, speed: 380 + i * 25, tele: 0.8 - i * 0.05, track: true, voice: i === 0 || i === 4 });
      yield () => c.state !== 'tele';
      yield 1.05;
    }
    yield 0.9;
    bt.showEnemy(bt.flowery);
  };

  WAVES.petals = function* (w, bt, a) {
    w.hintOnce('graze', 'Brush close past bullets to build TP!');
    let n = 0;
    while (w.t < 8) {
      const blue = n % 3 === 2;
      const vx = blue ? -U.rand(120, 150) : -U.rand(150, 200);
      const amp = blue ? 0 : U.rand(6, 16);
      const y = w.pickY((yy) => w.clearLine(a.R + 10, yy, vx, 0, 6, 6 + amp, 8), a.T + 8, a.B - 8);
      if (y !== null) {
        if (blue) {
          w.spawn(B.bluePetal(a.R + 10, y, vx, 0));
        } else {
          const b = w.spawn(B.petal(a.R + 10, y, vx, 0));
          b.baseY = y;
          b.amp = amp;
          b.freq = U.rand(2, 4);
          b.onUpdate = (p) => {
            p.y = p.baseY + Math.sin(p.t * p.freq) * p.amp;
          };
        }
      }
      n++;
      yield 0.18;
    }
    yield* w.settle(2.5);
  };

  // ---- Phase 2 ------------------------------------------------------------
  WAVES.spiral = function* (w, bt, a) {
    const ex = a.R - 40;
    const ey = a.cy;
    const em = w.deco({
      x: ex,
      y: ey,
      drawFn(b) {
        G.draw(G.frameAt('bloom/blue', b.t, 8, true), b.x, b.y, { scale: 1, ox: 0.5, oy: 0.5, rot: b.t * 4, tint: '#ffffff', alpha: Math.min(1, b.t * 4) });
      },
    });
    let ang = U.rand(0, Math.PI * 2);
    const dir = U.chance(0.5) ? 1 : -1;
    let n = 0;
    while (w.t < 8) {
      for (let k = 0; k < 2; k++) {
        const aa = ang + k * Math.PI;
        const sp = 100;
        const vx = Math.cos(aa) * sp;
        const vy = Math.sin(aa) * sp;
        n++;
        if (!w.clearLine(ex, ey, vx, vy, 6, 6, 8)) continue;
        if (n % 7 === 0) w.spawn(B.bluePetal(ex, ey, vx, vy));
        else w.spawn(B.petal(ex, ey, vx, vy));
      }
      ang += 0.2 * dir;
      yield 0.06;
    }
    em.alive = false;
    yield* w.settle(3);
  };

  WAVES.jarona2 = function* (w, bt, a) {
    bt.hideEnemy(bt.flowery);
    for (let i = 0; i < 6; i++) {
      const c = w.charger({ who: 'flowery', y: w.soul.y, speed: 460 + i * 18, tele: 0.62, track: true, voice: i === 0 });
      yield () => c.state !== 'tele';
      yield 0.5;
      for (let k = 0; k < 3; k++) {
        const y = w.rY(10);
        const v = w.aimAt(a.R + 10, y, 185);
        w.spawn(B.petal(a.R + 10, y, v.vx, v.vy, { aimed: true }));
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
          s.forceY = dir * 70;
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
      const blue = n % 5 === 4;
      const vx = blue ? -115 : -U.rand(160, 210);
      const vy = w.windDir * (blue ? 35 : 55);
      const size = blue ? 9 : 6;
      const y = w.pickY((yy) => w.clearLine(a.R + 12, yy, vx, vy, size, size, 8), a.T + 6, a.B - 6);
      if (y !== null) {
        if (blue) w.spawn(B.blueOrb(a.R + 12, y, vx, vy));
        else w.spawn(B.petal(a.R + 12, y, vx, vy));
      }
      n++;
      yield 0.16;
    }
    s.forceY = 0;
    w.windDir = 0;
    yield* w.settle(2);
  };

  // ---- Phase 3: Aqua & Seth -------------------------------------------------
  // Seth's words fly along lanes; each is only launched into a lane that leaves the safe line open.
  function* bookWords(w, a, until, gap, greenEvery, margin) {
    const lanes = a.lanes;
    const laneH = a.h / lanes;
    const speeds = [120, 140, 110, 132];
    const last = [];
    let n = 0;
    while (w.t < until) {
      const green = n % greenEvery === greenEvery - 1;
      const text = U.choose(green ? GREEN_WORDS : WHITE_WORDS);
      const width = G.textWidth(text, 'main', 32);
      const x0 = a.R + width / 2 + 8;
      for (const lane of U.shuffle(Array.from({ length: lanes }, (_, i) => i))) {
        const prev = last[lane];
        if (prev && prev.alive && prev.x + prev.w / 2 > x0 - width / 2 - 28) continue;
        const y = a.T + laneH * (lane + 0.5);
        const v = speeds[lane % speeds.length];
        if (!green && !w.clearLine(x0, y, -v, 0, width / 2, 9, margin || 6)) continue;
        last[lane] = w.spawn(B.word(x0, y, -v, text, green));
        break;
      }
      n++;
      yield U.rand(gap * 0.85, gap * 1.15);
    }
  }
  WAVES.books = function* (w, bt, a) {
    w.hintOnce('words', 'Dodge WHITE words.  Grab GREEN words for TP!');
    w.line = wanderLine(a, 0.6);
    a.lanes = 4;
    yield* DF.tween(a, { laneAlpha: 1 }, 0.3);
    yield* bookWords(w, a, 8.3, 0.4, 4);
    yield* w.settle(3.5);
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
    w.spawn(B.knife(a.R + 6, y, v.vx, v.vy, { aimed: true }));
    DF.Audio.play('smallswing', { vol: 0.4, minGap: 0.05 });
  }

  // How long a hop has to last for the knife wall behind this lily pad to pass under the SOUL.
  function hopTime(lily, s) {
    const wall = lily.wall;
    if (!wall || !wall.alive) return 0.6;
    const back = Math.max(0, s.x - s.homeX) / 300;
    const pass = (wall.x + wall.w / 2 + s.r - s.homeX) / -wall.vx;
    return U.clamp(Math.max(back, pass) + 0.15, 0.6, 1.6);
  }
  WAVES.knives = function* (w, bt, a) {
    w.hintOnce('lily', 'DASH onto a LILY PAD to hop over the knives!');
    let spd = 150;
    let prevY = w.soul.y;
    for (let i = 0; i < 5; i++) {
      const k = 150 / spd;
      // Each pad sits a little way from the last, so dodging Aqua's knife is part of getting there.
      let y = prevY + U.choose([-1, 1]) * U.rand(40, 100);
      if (y < a.T + 22 || y > a.B - 22) y = prevY - (y - prevY);
      y = U.clamp(y, a.T + 22, a.B - 22);
      prevY = y;
      const lily = w.spawn(B.lily(a.R + 24, y, -spd));
      lily.wall = w.spawn(B.knifeWall(w, a.R + 24 + 44, -spd));
      lily.hopFor = hopTime;
      // Aqua throws while you're in the air, so the knife lands between two pads.
      if (i > 0) {
        w.run(
          (function* () {
            yield 1.3 * k;
            yield* aquaKnife(w, a);
          })()
        );
      }
      yield 2.2;
      spd = 150 * Math.pow(1.07, w.hops + 1);
    }
    yield* w.settle(3);
  };

  WAVES.aquaseth = function* (w, bt, a) {
    w.line = wanderLine(a, 0.6);
    a.lanes = 4;
    yield* DF.tween(a, { laneAlpha: 1 }, 0.3);
    w.run(
      (function* () {
        yield 1.2;
        while (w.t < 8) {
          yield* aquaKnife(w, a);
          yield 1.0;
        }
      })()
    );
    yield* bookWords(w, a, 8.3, 0.6, 3, 14);
    yield* w.settle(3.5);
    yield* DF.tween(a, { laneAlpha: 0 }, 0.3);
    a.lanes = 0;
  };

  // ---- Phase 4: Orange & Green ------------------------------------------------
  // Orange's one-two: a glove above and below the SOUL. Hold still and let them pass.
  function* glovePinch(w, a) {
    const s = w.soul;
    const y = U.clamp(s.y, a.T + 30, a.B - 30);
    const now = w.t;
    const pass = (a.R + 14 - s.homeX + 30) / 230;
    w.line = pointLine([[now, y], [now + pass, y]]);
    for (const side of [-1, 1]) {
      const g = w.spawn(B.glove(a.R + 14, y + side * 50, -230, -side * 40));
      g.onUpdate = (b) => {
        b.vy = U.approach(b.vy, 0, 160 * DF.STEP);
      };
    }
    DF.Audio.play('glove', { vol: 0.5 });
    yield pass;
  }
  WAVES.punches = function* (w, bt, a) {
    w.hintOnce('orange', "ORANGE's punches can be PARRIED too!");
    const orange = bt.enemyById('orange');
    bt.hideEnemy(bt.flowery);
    if (orange) bt.hideEnemy(orange);
    const steps = ['orange', 'flowery', 'gloves', 'orange', 'flowery', 'gloves', 'orange'];
    for (let i = 0; i < steps.length; i++) {
      const who = steps[i];
      if (who === 'gloves') {
        w.hintOnce('gloves', 'A one-two!  Stay between the gloves!');
        yield* glovePinch(w, a);
        yield 0.3;
        continue;
      }
      const c = w.charger({
        who,
        y: w.soul.y,
        speed: who === 'orange' ? 540 : 450,
        tele: who === 'orange' ? 0.55 : 0.68,
        track: true,
        voice: i === 1,
      });
      yield () => c.state !== 'tele';
      yield 1.0;
    }
    yield 1.2;
    bt.showEnemy(bt.flowery);
    if (orange) bt.showEnemy(orange);
  };

  // Pans thrown in arcs that land across the board; the odd dish heals.
  function* pans(w, a, until, every, dishEvery, margin) {
    const s = w.soul;
    let n = 0;
    while (w.t < until) {
      const vx = -U.rand(150, 190);
      const x0 = a.R + 10;
      const tau = (x0 - s.homeX) / -vx;
      const ay = 200;
      const y0 = U.rand(a.cy - 10, a.B - 6);
      // Aim each arc at a landing height as it crosses the SOUL's column.
      const vyFor = (target) => U.clamp((target - y0 - 0.5 * ay * tau * tau) / tau, -300, 60);
      const target = w.pickY((ty) => w.clearLine(x0, y0, vx, vyFor(ty), 9, 9, margin, ay), a.T + 10, a.B - 10);
      if (target !== null) w.spawn(B.pan(x0, y0, vx, vyFor(target), { ay }));
      n++;
      if (n % dishEvery === 0) w.spawn(B.dish(a.R + 16, w.rY(20), -85, 0));
      yield every;
    }
  }
  WAVES.kitchen = function* (w, bt, a) {
    w.hintOnce('heal', "GREEN's dishes heal you.  Pans do not!");
    yield* pans(w, a, 8.2, 0.32, 5, 8);
    yield* w.settle(2.5);
  };

  WAVES.orangegreen = function* (w, bt, a) {
    const orange = bt.enemyById('orange');
    const plan = [1.4, 4.4, 7.4];
    const opts = { who: 'orange', speed: 520, tele: 0.6, track: true };
    for (const at of plan) w.reserveCharge(at, opts);
    w.run(pans(w, a, 8.4, 0.42, 6, 8));
    for (const at of plan) {
      yield () => w.t >= at;
      if (orange) bt.hideEnemy(orange);
      const c = w.charger(Object.assign({ y: w.soul.y }, opts));
      yield () => c.state !== 'tele';
      yield 0.9;
      if (orange) bt.showEnemy(orange);
    }
    yield* w.settle(2.5);
  };

  // ---- Phase 5: Yellow & Blue --------------------------------------------------
  // Six shots across the board at once, with two neighbouring slots left open.
  function* volley(w, a) {
    const slots = 8;
    const sh = a.h / slots;
    const s = w.soul;
    const cur = U.clamp(Math.floor((s.y - a.T) / sh), 0, slots - 1);
    const open = U.clamp(cur + U.randInt(-3, 2), 0, slots - 2);
    const ys = [];
    for (let i = 0; i < slots; i++) if (i !== open && i !== open + 1) ys.push(a.T + sh * (i + 0.5));
    const now = w.t;
    const openY = a.T + sh * (open + 1);
    w.line = pointLine([[now, s.y], [now + 0.6, openY], [now + 0.75 + (a.R + 10 - s.homeX) / 330 + 0.3, openY]]);
    w.deco({
      x: a.cx,
      y: a.cy,
      life: 0.75,
      drawFn(b) {
        for (const y of ys) G.rect(a.L, Math.round(y) - 1, a.w, 2, '#ffe040', 0.2 + 0.5 * (Math.floor(b.t * 14) % 2));
      },
    });
    DF.Audio.play('charge', { vol: 0.3, pitch: 1.8 });
    yield 0.75;
    for (const y of ys) w.shot(a.R + 10, y, -330, 0, false).volley = true;
    DF.Audio.play('punchmed', { vol: 0.45, pitch: 1.5 });
  }
  WAVES.showdown = function* (w, bt, a) {
    w.hintOnce('shot', 'DASH into BLUE bullets to knock them back!');
    for (let i = 0; i < 8; i++) {
      const sh = w.yellowShot({ blue: i % 3 === 2, aim: 0.62 - Math.min(i, 5) * 0.04, lock: 0.26 });
      yield () => sh.fired;
      yield 0.4;
      if (i % 3 === 1) {
        yield* volley(w, a);
        yield 0.9;
      }
    }
    yield* w.settle(2);
  };

  WAVES.butterflies = function* (w, bt, a) {
    w.hintOnce('butterfly', 'YELLOW shoots the flowers loose!  BLUE butterflies break with a DASH!');
    const speed = 118;
    yield* bambooRun(w, a, {
      walls: 6,
      speed,
      every: 1.55,
      gap: [40, 48],
      onWall(wall, p, i) {
        if (i === 0) return;
        const fy = w.pickY((yy) => p.openings.every((op) => yy + 18 < op.y1 || yy - 18 > op.y2), a.T + 14, a.B - 14, 12);
        if (fy === null) return;
        const fl = { y: fy, alive: true };
        wall.flowers.push(fl);
        w.run(shootFlower(w, a, wall, fl, speed));
      },
    });
    yield 0.4;
  };

  // Blue's pirouettes throw rings of petals from a spinning flower.
  function* rings(w, a, until, gap, n, sp) {
    const em = w.deco({
      x: a.R - 30,
      y: a.cy,
      drawFn(b) {
        G.draw(G.frameAt('bloom/blue', b.t, 8, true), b.x, b.y, { scale: 1, ox: 0.5, oy: 0.5, rot: -b.t * 5, alpha: Math.min(1, b.t * 4) });
      },
    });
    let k = 0;
    while (w.t < until) {
      em.y = a.cy + Math.sin(w.t * 1.3) * (a.h / 2 - 30);
      const blue = k % 2 === 1;
      const off = k * 0.26;
      for (let i = 0; i < n; i++) {
        const ang = off + (i * Math.PI * 2) / n;
        const vx = Math.cos(ang) * sp;
        const vy = Math.sin(ang) * sp;
        if (!w.clearLine(em.x, em.y, vx, vy, 7, 7, 8)) continue;
        if (blue) w.spawn(B.bluePetal(em.x, em.y, vx, vy));
        else w.spawn(B.pinkPetal(em.x, em.y, vx, vy));
      }
      DF.Audio.play('wing', { vol: 0.25, pitch: 1.6, minGap: 0.1 });
      k++;
      yield gap;
    }
    em.alive = false;
  }
  WAVES.ballet = function* (w, bt, a) {
    w.hintOnce('ballet', "BLUE's pirouettes: break the BLUE rings, or PARRY her!");
    const blue = bt.enemyById('blue');
    const plan = [3.0, 6.0];
    const opts = { who: 'blue', speed: 430, tele: 0.75, track: true };
    for (const at of plan) w.reserveCharge(at, opts);
    w.run(rings(w, a, 8.0, 0.7, 12, 105));
    for (const at of plan) {
      yield () => w.t >= at;
      if (blue) bt.hideEnemy(blue);
      const c = w.charger(Object.assign({ y: w.soul.y }, opts));
      yield () => c.state !== 'tele';
      yield 1.2;
      if (blue) bt.showEnemy(blue);
    }
    yield () => w.t >= 8.0;
    yield* w.settle(3);
  };

  // ---- Phase 6: Flowery alone ----------------------------------------------------
  WAVES.bamboo_hard = function* (w, bt, a) {
    w.hintOnce('hard', 'Tighter gaps now.  All-BLUE walls need a DASH!');
    yield* bambooRun(w, a, { walls: 8, speed: 150, every: 1.12, gap: [30, 36], blues: 1, blueOnly: 0.35, blueFrom: 1, cacti: 0.7 });
    yield 0.4;
  };

  WAVES.jarona3 = function* (w, bt, a) {
    bt.hideEnemy(bt.flowery);
    for (let i = 0; i < 4; i++) {
      const c1 = w.charger({ who: 'flowery', y: w.soul.y, speed: 500, tele: 0.6, track: true, voice: i === 0 || i === 3 });
      yield () => c1.state !== 'tele';
      yield 0.45;
      const c2 = w.charger({ who: 'flowery', y: w.soul.y, speed: 540, tele: 0.55, track: true });
      yield () => c2.state !== 'tele';
      yield 0.55;
      for (let k = 0; k < 3; k++) {
        const y = w.rY(10);
        const v = w.aimAt(a.R + 10, y, 200);
        w.spawn(B.petal(a.R + 10, y, v.vx, v.vy, { aimed: true }));
        yield 0.1;
      }
      yield 0.7;
    }
    yield 0.9;
    bt.showEnemy(bt.flowery);
  };

  // PRISM BLOW: colored beams on every lane but a safe one, then a bamboo wall to thread.
  WAVES.prism = function* (w, bt, a, s) {
    w.hintOnce('prism', 'PRISM BLOW!  Get to the lane with no warning line!');
    const lanes = 5;
    const lh = a.h / lanes;
    const cols = U.RAINBOW;
    const speed = 160;
    for (let round = 0; round < 4; round++) {
      const cur = U.clamp(Math.floor((s.y - a.T) / lh), 0, lanes - 1);
      let safe = cur + U.choose([-2, -1, 1, 2]);
      if (safe < 0 || safe >= lanes) safe = cur - (safe - cur);
      safe = U.clamp(safe, 0, lanes - 1);
      let c = 0;
      for (let i = 0; i < lanes; i++) {
        if (i === safe) continue;
        w.beam(a.T + lh * (i + 0.5), cols[(c++ + round * 2) % cols.length], 0.9, 0.4, lh - 6);
      }
      DF.Audio.play('charge', { vol: 0.35, pitch: 1.3 });
      // The wall reaches the SOUL just after the beams fade, its gap near the safe lane.
      const gh = 40;
      const laneY = a.T + lh * (safe + 0.5);
      const gy = U.clamp(laneY + U.rand(-40, 40), a.T + gh / 2 + 4, a.B - gh / 2 - 4);
      w.bamboo({ speed, x: a.R + 20, openings: [{ y1: gy - gh / 2, y2: gy + gh / 2, type: round % 2 ? 'blue' : 'gap' }] });
      const now = w.t;
      const arrive = now + (a.R + 20 - s.homeX) / speed;
      const pass = (14 + s.r * 2 + 6) / speed;
      w.line = pointLine([[now, s.y], [now + 0.6, laneY], [now + 1.3, laneY], [arrive - pass, gy], [arrive + pass, gy]]);
      yield arrive - now + 0.25;
    }
    yield 0.4;
  };
})();
