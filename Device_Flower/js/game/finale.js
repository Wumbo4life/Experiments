/* Device_Flower - the last stretch: Kris runs the castle roof while OMEGA FLOWERY attacks. */
(function () {
  'use strict';
  const DF = window.DF;
  const G = DF.G;
  const U = DF.U;
  const Input = DF.Input;
  const Audio = DF.Audio;

  // Where each platformer sprite's feet are (1x pixels), so every animation lines up.
  const ANCHOR = {
    'kplat/run': [16, 33],
    'kplat/idle': [22, 36],
    'kplat/crouch': [22, 36],
    'kplat/halt': [22, 36],
    'kplat/land': [33, 33],
    'kplat/pose': [13, 39],
    'kplat/jumpup': [20, 37],
    'kplat/jumpdown': [25, 42],
    'kplat/slashg': [38, 61],
    'kplat/slash': [44, 59],
    'kplat/clash': [8, 40],
    'kplat/hurtg': [20, 50],
    'kplat/hurt': [20, 49],
    'flowery/stand': [10, 60],
    'flowery/headdown': [13, 58],
    'flowery/crouch': [30, 86],
    'flowery/run': [25, 43],
    'flowery/jumpdown': [14, 61],
    'flowery/jumpup': [14, 61],
    'flowery/kick': [20, 66],
    'flowery/slash': [30, 74],
    'flowery/powerup': [16, 58],
    'flowery/poweringup': [17, 72],
    'flowery/pose': [22, 58],
    'splat/idle': [11, 43],
    'splat/run': [26, 43],
    'splat/attack': [40, 70],
    'rplat/idle': [11, 40],
    'rplat/run': [10, 42],
    'rplat/fall': [18, 41],
    'rplat/splat': [19, 16],
  };
  // Draw a frame standing on (x, y). o: the usual G.draw options (scale, flip, alpha, fill...).
  DF.drawAt = function (name, x, y, o) {
    o = Object.assign({ scale: 2 }, o || {});
    const a = ANCHOR[name.replace(/_\d+$/, '')];
    const sz = G.size(name);
    if (a && sz.w) {
      const ax = o.flip ? sz.w - a[0] : a[0];
      o.ox = ax / sz.w;
      o.oy = a[1] / sz.h;
    } else {
      o.ox = 0.5;
      o.oy = 1;
    }
    G.draw(name, Math.round(x), Math.round(y), o);
  };

  const GROUND = 366; // Kris's feet on the ridge of the roof
  const KX = 170;
  const GRAV = 2300;
  const JUMP_V = 760;
  const CHARGE_T = 0.45;
  const LANES = { low: GROUND - 26, high: GROUND - 96, last: GROUND - 52 };
  const SIZES = { low: [76, 26], high: [76, 26], last: [104, 44] };
  const PATTERN = ['low', 'high', 'low', 'double', 'high', 'low', 'low', 'high', 'double', 'low', 'high', 'double'];

  class Finale {
    constructor(bt) {
      this.bt = bt;
      this.fx = bt.fx;
      this.t = 0;
      this.done = false;
      this.failed = false;
      this.scroll = 0;
      this.speed = 300;
      this.k = { y: GROUND, vy: 0, ground: true, state: 'run', st: 0, charge: 0, charging: false, inv: 0, flash: 0 };
      this.om = { x: 540, y: 190, t: 0, visible: true, pose: 'hover', flash: 0, alpha: 1 };
      this.attacks = [];
      this.bar = 0;
      this.slow = 1;
      this.white = 1;
      this.freeze = 0;
      this.clash = null;
      this.finish = null;
      this.msg = { text: '[X] JUMP     [Z] SLASH     Hold [Z], let go: JUMP-SLASH', t: 0 };
      this.dodged = 0;
      this.speedLines = [];
      for (let i = 0; i < 12; i++) this.speedLines.push({ x: Math.random() * 640, y: 40 + Math.random() * 280, w: 30 + Math.random() * 60, sp: 500 + Math.random() * 400 });
      this.seq = new DF.Script(this.flow());
    }

    // ---- script -------------------------------------------------------------------
    *flow() {
      yield* DF.tween(this, { white: 0 }, 0.8);
      this.fx.label(320, 150, 'OMEGA FLOWERY attacks!', '#ffffff', { size: 32, life: 1.6, rise: 10 });
      yield 1.2;
      let i = 0;
      while (this.bar < 100) {
        const kind = PATTERN[i % PATTERN.length];
        i++;
        if (kind === 'double') {
          this.attack('low', 0.75);
          yield 0.72;
          this.attack('high', 0.6);
        } else {
          this.attack(kind, i < 3 ? 0.95 : 0.72);
        }
        yield () => this.attacks.every((a) => a.state === 'gone');
        yield 0.35;
      }
      yield* this.lastJarona();
    }

    attack(kind, tele) {
      const [w, h] = SIZES[kind];
      const a = { kind, x: 580, y: LANES[kind], w, h, state: 'tele', t: 0, tele, speed: kind === 'last' ? 430 : 610, blue: false, trail: [], rot: 0, vy: 0 };
      this.attacks.push(a);
      this.om.visible = false;
      Audio.play('charge', { vol: 0.35, pitch: kind === 'high' ? 1.4 : 1.1 });
      return a;
    }

    *lastJarona() {
      this.msg = { text: 'CRITICAL!  Slash the LAST JARONA as it turns BLUE!', t: 0 };
      yield 0.8;
      for (;;) {
        Audio.voice('fl_last_jarona');
        const a = this.attack('last', 1.5);
        yield () => a.state === 'gone' || a.state === 'clash';
        if (a.state === 'clash') break;
        yield 1.2;
        this.msg = { text: 'Again! Slash when it glows BLUE!', t: 0 };
      }
      yield* this.clashAndFinish();
    }

    *clashAndFinish() {
      const k = this.k;
      DF.Music.stop(0.3);
      Audio.play('impact', { vol: 1 });
      Audio.play('bell', { vol: 0.8 });
      this.fx.screenShake(12);
      this.fx.screenFlash('#ffffff', 0.8, 2.5);
      k.state = 'clash';
      k.st = 0;
      this.clash = { t: 0 };
      for (let i = 0; i < 10; i++) {
        this.fx.add({ frame: 'fx/star_1', anim: 'fx/star', fps: 12, loop: true, x: KX + 70, y: k.y - 50, vx: U.rand(-160, 200), vy: U.rand(-220, 60), grav: 500, life: 0.6, tint: U.choose(U.RAINBOW), scale: 2 });
      }
      yield 1.1;
      // Kris breaks through: one great slash across OMEGA FLOWERY.
      this.clash = null;
      k.state = 'finisher';
      k.st = 0;
      k.vy = -JUMP_V * 0.8;
      k.ground = false;
      Audio.play('ultraswing', { vol: 1 });
      yield 0.3;
      Audio.play('criticalswing', { vol: 0.9 });
      Audio.play('scytheburst', { vol: 0.8 });
      this.finish = { t: 0, x: KX + 120, y: GROUND - 70 };
      this.om.visible = false;
      for (const a of this.attacks) a.state = 'gone';
      this.fx.petalBurst(this.finish.x, this.finish.y, 46, U.RAINBOW);
      this.fx.screenFlash('#ffffff', 1, 1.5);
      this.fx.screenShake(14);
      Audio.voice('vc_im_falling');
      yield 2.4;
      yield* DF.tween(this, { white: 1 }, 1.0);
      yield 0.4;
      this.done = true;
    }

    // ---- update -------------------------------------------------------------------
    update(rawDt) {
      if (this.freeze > 0) {
        this.freeze -= rawDt;
        this.seq.update(0);
        return;
      }
      const dt = rawDt * this.slow;
      this.t += dt;
      this.msg.t += rawDt;
      this.seq.update(rawDt);
      if (this.done) return;
      const run = this.clash || this.finish ? 0.2 : 1;
      this.scroll += this.speed * dt * run;
      for (const l of this.speedLines) {
        l.x -= l.sp * dt * run;
        if (l.x + l.w < 0) {
          l.x = 640 + Math.random() * 100;
          l.y = 40 + Math.random() * 280;
        }
      }
      this.updateKris(dt);
      this.updateOmega(dt);
      for (const a of this.attacks) this.updateAttack(a, dt);
      this.attacks = this.attacks.filter((a) => a.state !== 'gone' || a === this.attacks[this.attacks.length - 1]);
      // Slow motion while the LAST JARONA glows blue.
      const last = this.attacks.find((a) => a.kind === 'last' && a.state === 'glide');
      this.slow = last && last.blue ? 0.35 : 1;
      if (this.finish) this.finish.t += dt;
      if (this.clash) this.clash.t += dt;
    }

    updateKris(dt) {
      const k = this.k;
      k.st += dt;
      if (k.inv > 0) k.inv = Math.max(0, k.inv - dt);
      if (k.flash > 0) k.flash = Math.max(0, k.flash - dt * 4);
      const busy = k.state === 'slashg' || k.state === 'slashair' || k.state === 'hurt' || k.state === 'clash' || k.state === 'finisher';
      if (!this.clash && !this.finish) {
        // [X]: jump.
        if (Input.pressed('cancel') && k.ground && !busy) {
          k.vy = -JUMP_V;
          k.ground = false;
          k.state = 'jump';
          k.st = 0;
          Audio.play('jump', { vol: 0.6 });
        }
        // [Z]: tap to slash, hold and let go to jump-slash.
        if (Input.pressed('confirm') && !busy) {
          k.charging = true;
          k.charge = 0;
        }
        if (k.charging) {
          if (Input.down('confirm')) k.charge = Math.min(1, k.charge + dt / CHARGE_T);
          if (!Input.down('confirm') || Input.released('confirm')) {
            const full = k.charge >= 1;
            k.charging = false;
            k.charge = 0;
            if (!busy) this.slash(full);
          }
        }
      }
      // Physics.
      if (!k.ground) {
        k.vy += GRAV * dt;
        k.y += k.vy * dt;
        if (k.y >= GROUND) {
          k.y = GROUND;
          k.vy = 0;
          k.ground = true;
          if (k.state === 'jump' || k.state === 'slashair' || k.state === 'finisher') {
            k.state = 'run';
            k.st = 0;
          }
        }
      }
      if (k.state === 'slashg' && k.st > 0.43) {
        k.state = 'run';
        k.st = 0;
      }
      if (k.state === 'slashair' && k.st > 0.5) {
        k.state = k.ground ? 'run' : 'jump';
        k.st = 0;
      }
      if (k.state === 'hurt' && k.st > 0.4) {
        k.state = k.ground ? 'run' : 'jump';
        k.st = 0;
      }
    }

    slash(full) {
      const k = this.k;
      if (full || !k.ground) {
        if (k.ground) {
          k.vy = -JUMP_V * 0.92;
          k.ground = false;
        }
        k.state = 'slashair';
        Audio.play('ultraswing', { vol: 0.5, pitch: 1.2 });
      } else {
        k.state = 'slashg';
        Audio.play('smallswing', { vol: 0.6 });
      }
      k.st = 0;
    }
    // The slash's reach, while its active frames are out.
    slashBox() {
      const k = this.k;
      if (k.state === 'slashg' && k.st > 0.03 && k.st < 0.26) return { x: KX - 6, y: k.y - 72, w: 124, h: 74 };
      if (k.state === 'slashair' && k.st > 0.04 && k.st < 0.36) return { x: KX - 16, y: k.y - 96, w: 136, h: 112 };
      return null;
    }
    hurtBox() {
      const k = this.k;
      return { x: KX - 12, y: k.y - 56, w: 26, h: 52 };
    }

    updateOmega(dt) {
      const om = this.om;
      om.t += dt;
      if (om.flash > 0) om.flash = Math.max(0, om.flash - dt * 3);
      const busy = this.attacks.some((a) => a.state === 'tele' || a.state === 'glide');
      if (!busy && !this.finish && !this.clash && this.t > 0.2) {
        if (!om.visible) {
          om.visible = true;
          om.x = 700;
        }
        om.x = U.approach(om.x, 540, 600 * dt);
        om.y = 180 + Math.sin(om.t * 2.3) * 22;
      }
    }

    updateAttack(a, dt) {
      const k = this.k;
      a.t += dt;
      if (a.state === 'tele') {
        a.x = U.approach(a.x, 560, 900 * dt);
        if (a.t >= a.tele) {
          a.state = 'glide';
          a.t = 0;
          if (a.kind !== 'last') Audio.voice(U.choose(['fl_jarona1', 'fl_jarona2', 'fl_jarona3', 'fl_jarona4']), { vol: 0.5 });
          Audio.play('heavyswing', { vol: 0.7, pitch: a.kind === 'last' ? 0.8 : 1 });
        }
      } else if (a.state === 'glide') {
        a.x -= a.speed * dt;
        const gap = a.x - a.w / 2 - (KX + 14);
        a.blue = gap < (a.kind === 'last' ? 170 : 130) && gap > -a.w;
        a.trail.push({ x: a.x, y: a.y, t: 0 });
        const box = { x: a.x - a.w / 2, y: a.y - a.h / 2, w: a.w, h: a.h };
        const sb = this.slashBox();
        if (sb && overlap(sb, box)) {
          this.parry(a);
        } else if (overlap(this.hurtBox(), box) && k.inv <= 0 && !a.hit) {
          a.hit = true;
          this.hurt(a.kind === 'last' ? 40 : 30);
        } else if (a.x < -90) {
          a.state = 'gone';
          if (!a.hit) {
            this.dodged++;
            if (a.kind !== 'last') this.addBar(5);
          }
        }
      } else if (a.state === 'parried') {
        a.x += 520 * dt;
        a.vy += 500 * dt;
        a.y += a.vy * dt;
        a.rot += dt * 14;
        if (a.t > 0.7) a.state = 'gone';
      }
      for (const p of a.trail) p.t += dt;
      while (a.trail.length && a.trail[0].t > 0.12) a.trail.shift();
    }

    parry(a) {
      const k = this.k;
      const bt = this.bt;
      bt.stats.parries++;
      const perfect = a.x - a.w / 2 - (KX + 14) < 40;
      if (perfect) bt.stats.perfects++;
      if (a.kind === 'last') {
        a.state = 'clash';
        this.freeze = 0.12;
        return;
      }
      a.state = 'parried';
      a.t = 0;
      a.vy = -260;
      k.flash = 1;
      k.inv = Math.max(k.inv, 0.2);
      this.freeze = 0.07;
      const gain = (a.kind === 'high' ? 24 : 18) + (perfect ? 6 : 0);
      this.addBar(gain);
      bt.gainTP(perfect ? 8 : 5);
      Audio.play('impact', { vol: 0.8 });
      Audio.play(perfect ? 'bell' : 'slash', { vol: 0.6 });
      this.fx.hit(a.x - a.w / 2, a.y, 0.7);
      this.fx.shockRing(a.x - a.w / 2, a.y, perfect ? '#ffff60' : '#80c0ff', 70, 0.35);
      this.fx.screenShake(5);
      this.fx.label(KX + 40, k.y - 110, perfect ? 'PERFECT!' : 'PARRY!', perfect ? '#ffff40' : '#80d0ff', { size: 16, rise: 26, life: 0.8 });
    }

    addBar(n) {
      const before = this.bar;
      this.bar = Math.min(100, this.bar + n);
      if (before < 80 && this.bar >= 80) Audio.play('tensionhorn', { vol: 0.4 });
    }

    hurt(dmg) {
      const k = this.k;
      const bt = this.bt;
      k.inv = 1.2;
      k.state = 'hurt';
      k.st = 0;
      k.charging = false;
      Audio.play('hurt', { vol: 0.8 });
      this.fx.screenShake(6);
      if (DF.debug && DF.debug.god) return;
      const alive = bt.party.filter((m) => !m.down);
      if (alive.length) bt.damageMember(U.choose(alive), dmg);
      bt.stats.hits++;
      if (bt.party.every((m) => m.down)) {
        this.failed = true;
        this.done = true;
        bt.soul.x = KX;
        bt.soul.y = k.y - 30;
      }
    }

    // ---- drawing ------------------------------------------------------------------
    draw() {
      const ctx = G.ctx;
      const prog = this.bar / 100;
      // Sky: the sun is almost down; OMEGA's colors wash over everything.
      const g = ctx.createLinearGradient(0, 0, 0, GROUND);
      g.addColorStop(0, '#120828');
      g.addColorStop(0.55, '#5a1c52');
      g.addColorStop(1, '#d0603c');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 640, 480);
      ctx.save();
      ctx.globalAlpha = 0.12;
      for (let i = 0; i < 7; i++) G.rect(0, i * 52, 640, 52, U.RAINBOW[(i + Math.floor(this.t * 5)) % 7]);
      ctx.restore();
      G.circle(460, GROUND - 40, 46, '#ff9a50', 0.9);
      // The Fountain ahead, growing as you close in.
      DF.BattleView.fountain(this.t, { x: 560 - prog * 30, base: GROUND - 24, grow: 1, size: 0.34 + prog * 0.22 });
      // Far pagodas (slow parallax).
      const far = (this.scroll * 0.15) % 160;
      ctx.fillStyle = '#2a0e2e';
      for (let i = -1; i < 6; i++) {
        const x = i * 160 - far + 40;
        const tiers = 2 + (((i % 3) + 3) % 3);
        for (let k = 0; k < tiers; k++) {
          const w = 44 - k * 9;
          const y = GROUND - 8 - k * 18;
          ctx.fillRect(x - w / 2 + 6, y - 12, w - 12, 12);
          ctx.beginPath();
          ctx.moveTo(x - w / 2 - 8, y - 10);
          ctx.quadraticCurveTo(x - w / 4, y - 14, x, y - 24);
          ctx.quadraticCurveTo(x + w / 4, y - 14, x + w / 2 + 8, y - 10);
          ctx.fill();
        }
        ctx.fillRect(x - 1, GROUND - 8 - tiers * 18 - 16, 2, 12);
      }
      for (const l of this.speedLines) G.rect(Math.round(l.x), Math.round(l.y), Math.round(l.w), 2, '#ffffff', 0.18);
      this.drawRoof();
      // Attacks behind Kris, OMEGA hovering.
      this.drawOmega();
      for (const a of this.attacks) this.drawAttack(a);
      this.drawKris();
      if (this.finish) this.drawFinish();
      this.drawHUD();
      if (this.white > 0) G.rect(0, 0, 640, 480, '#ffffff', this.white);
    }

    drawRoof() {
      const ctx = G.ctx;
      // The ridge Kris runs along, with gold caps and a fish ornament every so often.
      const off = this.scroll % 48;
      G.rect(0, GROUND, 640, 16, '#1a0c1c');
      G.rect(0, GROUND, 640, 3, '#e8b040');
      for (let x = -off; x < 640; x += 48) G.rect(Math.round(x), GROUND + 5, 30, 6, '#3a2440');
      // Tiles sloping down below.
      for (let row = 0; row < 7; row++) {
        const y = GROUND + 16 + row * 16;
        const shift = (this.scroll * 1.0 + row * 12) % 32;
        G.rect(0, y, 640, 16, row % 2 ? '#2e2448' : '#342a52');
        for (let x = -shift; x < 640; x += 32) {
          G.rect(Math.round(x), y, 3, 16, '#1a1430');
          G.rect(Math.round(x + 4), y + 2, 22, 3, '#5a4a80', 0.6);
        }
      }
      const orn = this.scroll % 900;
      const ox = 700 - orn;
      if (ox > -60 && ox < 700) {
        ctx.fillStyle = '#e8b040';
        ctx.beginPath();
        ctx.moveTo(ox, GROUND);
        ctx.quadraticCurveTo(ox - 10, GROUND - 30, ox + 8, GROUND - 40);
        ctx.quadraticCurveTo(ox + 4, GROUND - 22, ox + 18, GROUND - 16);
        ctx.lineTo(ox + 14, GROUND);
        ctx.fill();
      }
      // Petals blown past by the run.
      for (let i = 0; i < 14; i++) {
        const x = 640 - ((this.scroll * 1.6 + i * 97) % 700);
        const y = 60 + ((i * 53) % 280) + Math.sin(this.t * 2 + i) * 10;
        G.draw(G.frameAt('petal/spin', this.t + i, 10, true), x, y, { scale: 2, ox: 0.5, oy: 0.5, alpha: 0.7 });
      }
    }

    drawOmegaSprite(frame, x, y, scale, flip, alpha) {
      for (let i = 0; i < 4; i++) G.ring(x, y, 34 + i * 8 + Math.sin(this.t * 7 + i) * 3, U.RAINBOW[(i * 2 + Math.floor(this.t * 12)) % 7], 3, 0.3 * (alpha === undefined ? 1 : alpha));
      G.draw(frame, x, y, { scale, ox: 0.5, oy: 0.5, flip, fill: U.rainbow(), fillAmt: 0.5, alpha });
    }

    drawOmega() {
      const om = this.om;
      if (!om.visible) return;
      this.drawOmegaSprite(G.frameAt('flowery/poweringup', om.t, 10, true), om.x, om.y, 2, true);
    }

    drawAttack(a) {
      if (a.state === 'gone') return;
      const col = U.rainbow();
      if (a.state === 'tele') {
        const k = a.t / a.tele;
        G.rect(0, Math.round(a.y - a.h / 2), 640, Math.round(a.h), col, 0.1 + 0.12 * (Math.floor(k * 14) % 2));
        this.drawOmegaSprite(G.frameAt('flowery/powerup', a.t, 12, true), a.x, a.y, 1.6, true);
        G.draw('fx/alert', a.x - 10, a.y - 52, { scale: 2, ox: 0.5, oy: 0.5, alpha: Math.floor(k * 10) % 2 ? 1 : 0.4 });
        if (a.kind === 'last') G.text('LAST JARONA!!', 320, a.y - 60, { size: 32, align: 'center', color: U.rainbow(2), outline: '#000', outlineWidth: 5 });
        return;
      }
      const scale = a.kind === 'last' ? 2.4 : 1.7;
      const f = G.frameAt('flowery/omegajarona', a.t, 18, true);
      for (const p of a.trail) G.drawFill(f, p.x, p.y, U.rainbow(3), { scale, ox: 0.5, oy: 0.5, alpha: 0.35 * (1 - p.t / 0.12) });
      if (a.state === 'clash') {
        G.drawFill(f, KX + 90, this.k.y - 50, '#ffffff', { scale, ox: 0.5, oy: 0.5 });
        return;
      }
      G.drawFill(f, a.x, a.y, a.blue && a.state === 'glide' ? '#2a6aff' : col, { scale, ox: 0.5, oy: 0.5, rot: a.rot, alpha: a.state === 'parried' ? Math.max(0, 1 - a.t / 0.7) : 1 });
      if (a.blue && a.state === 'glide') G.circle(a.x - a.w / 2, a.y, 10 + Math.sin(this.t * 50) * 3, '#5aa0ff', 0.4);
    }

    drawKris() {
      const k = this.k;
      if (k.inv > 0 && Math.floor(k.inv * 15) % 2 === 0 && k.state !== 'hurt') return;
      let f;
      switch (k.state) {
        case 'slashg':
          f = G.frameAt('kplat/slashg', k.st, 30, false);
          break;
        case 'slashair':
        case 'finisher':
          f = G.frameAt('kplat/slash', k.st, 34, false);
          break;
        case 'hurt':
          f = k.ground ? 'kplat/hurtg_1' : 'kplat/hurt_1';
          break;
        case 'clash':
          f = G.frameAt('kplat/clash', k.st, 12, true);
          break;
        default:
          f = k.ground ? G.frameAt('kplat/run', this.t, 14, true) : k.vy < 0 ? G.frameAt('kplat/jumpup', k.st, 12, false) : G.frameAt('kplat/jumpdown', k.st, 12, false);
      }
      if (k.charging && k.charge > 0.1) {
        const full = k.charge >= 1;
        G.ring(KX, k.y - 30, full ? 30 + Math.sin(DF.time * 30) : 50 - k.charge * 20, full ? '#ffffff' : '#80d0ff', 2, full ? 0.9 : 0.5);
      }
      G.circle(KX, GROUND + 2, 16 - (GROUND - k.y) * 0.05, '#000000', 0.35);
      DF.drawAt(f, KX, k.y, { fill: '#ffffff', fillAmt: Math.max(k.flash, k.charging ? k.charge * 0.5 : 0) });
    }

    drawFinish() {
      const f = this.finish;
      const t = f.t;
      // Seven colored streaks where OMEGA FLOWERY was, then the plain FLOWERY falls.
      if (t < 0.8) {
        const ctx = G.ctx;
        ctx.save();
        ctx.globalAlpha = 1 - t / 0.8;
        for (let i = 0; i < 7; i++) G.line(KX, GROUND - 20 - i * 5, 640, f.y - 80 - i * 5, U.RAINBOW[i], 4);
        ctx.restore();
      }
      const y = f.y + Math.max(0, t - 0.5) * Math.max(0, t - 0.5) * 300;
      if (t > 0.3 && y < 520) G.draw('flowery/jumpdown_1', f.x + t * 20, y, { scale: 2, ox: 0.5, oy: 0.5, rot: t * 3, alpha: Math.min(1, (t - 0.3) * 4) });
      if (t > 1.0) G.text('OMEGA FLOWERY was defeated!', 320, 120, { size: 32, align: 'center', color: '#ffffff', alpha: Math.min(1, (t - 1.0) * 2), outline: '#000', outlineWidth: 5 });
    }

    drawHUD() {
      // Attack bar: fill it to the CRITICAL zone to finish him.
      const x = 170;
      const y = 40;
      const w = 300;
      G.rect(x - 4, y - 4, w + 8, 22, '#000000', 0.75);
      G.rect(x, y, w, 14, '#401020');
      G.rect(x + w * 0.8, y, w * 0.2, 14, '#802020');
      G.rect(x, y, Math.round((w * this.bar) / 100), 14, this.bar >= 80 ? U.rainbow() : '#ffd020');
      G.rect(x + w * 0.8, y - 3, 2, 20, '#ffffff');
      G.text('OMEGA', x - 10, y - 1, { size: 16, align: 'right', color: '#ffffff' });
      G.text(this.bar >= 80 ? 'CRITICAL!' : Math.floor(this.bar) + '%', x + w + 10, y - 1, { size: 16, color: this.bar >= 80 ? '#ff6060' : '#ffffff' });
      // Party HP.
      this.bt.party.forEach((m, i) => {
        const px = 12;
        const py = 426 + i * 24;
        G.rect(px - 4, py - 4, 150, 22, '#000000', 0.6);
        G.draw('icon/' + m.id + '_head', px, py - 2, { scale: 0.75 });
        G.rect(px + 30, py + 5, 76, 9, '#800000');
        if (m.hp > 0) G.rect(px + 30, py + 5, Math.ceil((m.hp / m.maxhp) * 76), 9, m.color);
        G.bitmapText('smallnumbers', String(m.hp), px + 112, py + 4, { color: m.hp <= 0 ? '#ff0000' : '#ffffff', fill: true });
      });
      if (this.msg.text && this.msg.t < 5) {
        const a = this.msg.t < 0.2 ? this.msg.t / 0.2 : this.msg.t > 4.3 ? (5 - this.msg.t) / 0.7 : 1;
        G.text(this.msg.text, 400, 440, { size: 16, align: 'center', color: '#ffff80', alpha: a, outline: '#000', outlineWidth: 4 });
      }
    }
  }

  function overlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  DF.Finale = Finale;
  DF.Finale.GROUND = GROUND;
})();
