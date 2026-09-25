/* Device_Flower - ACT minigames (Posey, BlowAway, Spin, Praise, Justice) and the FIGHT bar. */
(function () {
  'use strict';
  const DF = window.DF;
  const G = DF.G;
  const U = DF.U;
  const Input = DF.Input;
  const Audio = DF.Audio;

  const MG = (DF.Minigames = {});
  const DIRS = ['up', 'right', 'down', 'left'];
  const ARROW_ROT = { up: -Math.PI / 2, right: 0, down: Math.PI / 2, left: Math.PI };

  function panel(x, y, w, h, alpha) {
    const ctx = G.ctx;
    ctx.save();
    ctx.globalAlpha *= alpha === undefined ? 1 : alpha;
    G.rect(x, y, w, h, '#000000', 0.85);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    ctx.restore();
  }
  function arrow(x, y, dir, color, size, alpha) {
    const ctx = G.ctx;
    ctx.save();
    ctx.globalAlpha *= alpha === undefined ? 1 : alpha;
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(ARROW_ROT[dir]);
    const s = size || 10;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(s, 0);
    ctx.lineTo(-s * 0.2, -s * 0.8);
    ctx.lineTo(-s * 0.2, -s * 0.3);
    ctx.lineTo(-s, -s * 0.3);
    ctx.lineTo(-s, s * 0.3);
    ctx.lineTo(-s * 0.2, s * 0.3);
    ctx.lineTo(-s * 0.2, s * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  MG.arrow = arrow;
  function pressedDir() {
    for (const d of DIRS) if (Input.pressed(d)) return d;
    return null;
  }
  function timerBar(x, y, w, k, color) {
    G.rect(x, y, w, 6, '#400000');
    G.rect(x, y, Math.round(w * U.clamp(k, 0, 1)), 6, color || '#ffa040');
  }

  // ---- POSEY: stop a sweeping marker in the middle --------------------------------
  MG.posey = function* (bt, o) {
    const ids = o.z ? ['kris', 'susie', 'ralsei'] : ['kris'];
    const ov = { pos: 0, color: '#fff', active: false, marks: [], flash: 0 };
    const X = 200;
    const Y = 150;
    const W = 240;
    bt.overlay = {
      draw() {
        panel(X - 16, Y - 30, W + 32, 76);
        G.text(o.z ? 'TEAM POSE!' : 'POSE!', X + W / 2, Y - 26, { size: 16, align: 'center', color: '#ffff80' });
        G.rect(X, Y, W, 20, '#202020');
        G.rect(X + W / 2 - 30, Y, 60, 20, '#403000');
        G.rect(X + W / 2 - 14, Y, 28, 20, '#806000');
        G.rect(X + W / 2 - 5, Y, 10, 20, '#ffd020');
        for (const m of ov.marks) G.rect(Math.round(X + m.pos * W) - 1, Y - 4, 3, 28, m.color, 0.6);
        if (ov.active) {
          const mx = Math.round(X + ov.pos * W);
          G.rect(mx - 2, Y - 6, 5, 32, ov.color);
          G.draw('heart/heart', mx, Y + 38, { scale: 1, ox: 0.5, oy: 0.5, tint: ov.color, rot: Math.PI });
        }
      },
    };
    let total = 0;
    const grades = [];
    for (let i = 0; i < ids.length; i++) {
      const m = bt.member(ids[i]);
      if (m) m.setAnim('actready');
      ov.color = DF.PARTY[ids[i]].color;
      ov.pos = 0;
      ov.active = true;
      const speed = o.z ? 0.95 + i * 0.2 : 0.8;
      let t = 0;
      let pressed = false;
      yield 0.25;
      while (t < 1) {
        const dt = yield null;
        t += dt * speed;
        ov.pos = U.clamp(t, 0, 1);
        if (Input.pressed('confirm')) {
          pressed = true;
          break;
        }
      }
      ov.active = false;
      const d = Math.abs(ov.pos - 0.5) * W;
      const grade = !pressed ? 'MISS' : d <= 5 ? 'PERFECT' : d <= 14 ? 'GREAT' : d <= 30 ? 'GOOD' : 'MISS';
      ov.marks.push({ pos: ov.pos, color: ov.color });
      const pts = o.z ? { PERFECT: 4, GREAT: 3, GOOD: 2, MISS: 1 }[grade] : { PERFECT: 10, GREAT: 6, GOOD: 4, MISS: 1 }[grade];
      total += pts;
      grades.push(grade);
      if (m) m.setAnim('act');
      Audio.play('camera', { vol: 0.7 });
      bt.fx.screenFlash('#ffffff', grade === 'PERFECT' ? 0.9 : 0.5, 4);
      bt.fx.label(X + ov.pos * W, Y - 40, grade === 'MISS' ? 'MISS...' : grade + '!', grade === 'PERFECT' ? '#ffff40' : grade === 'MISS' ? '#a0a0a0' : '#80e0ff', { size: 16, life: 0.9 });
      if (grade === 'PERFECT') Audio.play('sparkle', { vol: 0.6 });
      yield 0.45;
    }
    yield 0.2;
    bt.overlay = null;
    return { mercy: total, grades, perfect: grades.every((g) => g === 'PERFECT') };
  };

  // ---- BLOWAWAY: mash Z to drag Flowery back toward the party -------------------------
  MG.blowaway = function* (bt, o) {
    const fl = bt.flowery;
    const start = fl.x;
    const need = 70;
    let x = start;
    let t = 0;
    const T = 3.2;
    let presses = 0;
    const ov = { k: 0 };
    for (const id of o.z ? ['kris', 'susie', 'ralsei'] : ['kris']) {
      const m = bt.member(id);
      if (m) m.setAnim('actready');
    }
    bt.overlay = {
      draw() {
        panel(196, 84, 248, 60);
        G.text('MASH [Z]!', 320, 88, { size: 16, align: 'center', color: Math.floor(t * 8) % 2 ? '#ffff80' : '#ffffff' });
        timerBar(212, 110, 216, 1 - t / T, '#ffa040');
        // Distance meter: how far Flowery has been pulled.
        G.rect(212, 122, 216, 10, '#303030');
        G.rect(212, 122, Math.round(216 * U.clamp((start - x) / need, 0, 1)), 10, (start - x) >= need ? '#ffff40' : '#40c0ff');
        G.rect(212 + 216 - 2, 120, 2, 14, '#ffffff');
      },
    };
    yield 0.2;
    while (t < T) {
      const dt = yield null;
      t += dt;
      if (Input.pressed('confirm')) {
        presses++;
        x -= o.z ? 11 : 7;
        Audio.play('noise', { vol: 0.35, pitch: 1 + presses * 0.01, minGap: 0.02 });
        bt.fx.add({ frame: 'fx/petalwing_1', anim: 'fx/petalwing', fps: 14, x: fl.x - 50, y: fl.y - U.rand(20, 90), vx: -U.rand(120, 220), vy: U.rand(-30, 30), life: 0.5, scale: 1 });
        for (const id of ['kris', 'susie', 'ralsei']) {
          const m = bt.member(id);
          if (m && (o.z || id === 'kris')) m.setAnim('act');
        }
      }
      x += 15 * dt;
      x = U.clamp(x, start - need - 40, start + 12);
      fl.x = x;
      fl.shake = Math.min(1.5, fl.shake + 0.02);
    }
    bt.overlay = null;
    const pulled = start - x;
    const success = pulled >= need;
    return { mercy: success ? 5 : pulled >= need / 2 ? 3 : 1, success, pulled };
  };

  // ---- SPIN: roll the arrows around the circle ----------------------------------------
  MG.spin = function* (bt, o) {
    const T = 3.6;
    let t = 0;
    let idx = 0;
    let rotations = 0;
    let wrongT = 0;
    const cx = 320;
    const cy = 150;
    const members = (o.z ? ['kris', 'susie', 'ralsei'] : ['kris']).map((id) => bt.member(id)).filter(Boolean);
    bt.overlay = {
      draw() {
        panel(cx - 80, cy - 70, 160, 150);
        G.text('SPIN!', cx, cy - 66, { size: 16, align: 'center', color: '#ffff80' });
        G.ring(cx, cy + 4, 34, '#606060', 2);
        for (let i = 0; i < 4; i++) {
          const d = DIRS[i];
          const ang = ARROW_ROT[d];
          const ax = cx + Math.cos(ang) * 34;
          const ay = cy + 4 + Math.sin(ang) * 34;
          const done = i < idx;
          const next = i === idx;
          const col = wrongT > 0 ? '#ff4040' : next ? '#ffff40' : done ? '#40a0ff' : '#808080';
          arrow(ax, ay, d, col, next ? 12 + Math.sin(t * 20) * 2 : 10);
        }
        G.text(String(rotations), cx, cy - 8, { size: 32, align: 'center', color: '#ffffff' });
        timerBar(cx - 64, cy + 58, 128, 1 - t / T);
      },
    };
    for (const m of members) m.setAnim('actready');
    yield 0.2;
    while (t < T) {
      const dt = yield null;
      t += dt;
      if (wrongT > 0) wrongT -= dt;
      const d = pressedDir();
      if (!d) continue;
      if (d === DIRS[idx]) {
        idx++;
        Audio.play('ui_move', { vol: 0.6, pitch: 1 + idx * 0.1 });
        for (const m of members) {
          m.flipX = !m.flipX;
          m.setAnim('act');
        }
        bt.flowery.flip = !bt.flowery.flip;
        if (idx >= 4) {
          idx = 0;
          rotations++;
          Audio.play('sparkle', { vol: 0.5 });
          bt.fx.label(cx, cy - 30, 'SPIN x' + rotations, '#ffff40', { size: 16, life: 0.7 });
        }
      } else {
        idx = 0;
        wrongT = 0.25;
        Audio.play('ui_cant', { vol: 0.5 });
      }
    }
    for (const m of members) m.flipX = false;
    bt.flowery.flip = false;
    bt.overlay = null;
    const r = rotations;
    const mercy = o.z ? (r >= 3 ? 5 : r >= 2 ? 3 : r >= 1 ? 2 : 0) : r >= 3 ? 3 : r >= 1 ? 1 : 0;
    return { mercy, rotations: r };
  };

  // ---- PRAISE: type the compliment arrows -------------------------------------------
  MG.praise = function* (bt, o) {
    const WORDS = { up: 'COOL!', right: 'SHINY!', down: 'STRONG!', left: 'STYLISH!' };
    const n = o.z ? 6 : 4;
    const seq = [];
    for (let i = 0; i < n; i++) seq.push(U.choose(DIRS));
    const res = [];
    const T = o.z ? 4.6 : 3.6;
    let t = 0;
    const cx = 320;
    const members = (o.z ? ['kris', 'susie', 'ralsei'] : ['kris']).map((id) => bt.member(id)).filter(Boolean);
    for (const m of members) m.setAnim('actready');
    bt.overlay = {
      draw() {
        const w = n * 34 + 20;
        panel(cx - w / 2, 110, w, 74);
        G.text('PRAISE!', cx, 114, { size: 16, align: 'center', color: '#ffff80' });
        for (let i = 0; i < n; i++) {
          const x = cx - w / 2 + 27 + i * 34;
          const col = res[i] === true ? '#ffff40' : res[i] === false ? '#ff4040' : i === res.length ? '#ffffff' : '#707070';
          arrow(x, 148, seq[i], col, i === res.length ? 12 : 10);
        }
        timerBar(cx - w / 2 + 10, 170, w - 20, 1 - t / T);
      },
    };
    yield 0.2;
    while (t < T && res.length < n) {
      const dt = yield null;
      t += dt;
      const d = pressedDir();
      if (!d) continue;
      const ok = d === seq[res.length];
      res.push(ok);
      if (ok) {
        Audio.play('ui_select', { vol: 0.5, pitch: 1 + res.length * 0.08 });
        const fl = bt.flowery;
        bt.fx.label(fl.x + U.rand(-50, 40), fl.y - U.rand(60, 120), WORDS[d], U.choose(['#ffff40', '#ff80ff', '#80ffff', '#80ff80']), { size: 16, life: 0.9 });
        for (const m of members) m.setAnim('act');
      } else {
        Audio.play('ui_cant', { vol: 0.5 });
      }
    }
    yield 0.25;
    bt.overlay = null;
    const c = res.filter(Boolean).length;
    const mercy = o.z ? (c === n ? 5 : c >= n - 2 ? 3 : 1) : c === n ? 3 : c >= n - 1 ? 2 : 1;
    return { mercy, correct: c, total: n };
  };

  // ---- JUSTICE: a very short trial -------------------------------------------------------
  MG.justice = function* (bt) {
    const yellow = bt.enemyById('yellow');
    const blue = bt.enemyById('blue');
    const court = { a: 0 };
    bt.overlay = {
      draw() {
        G.rect(0, 0, DF.W, 325, '#000000', 0.55 * court.a);
        if (court.a > 0.5) {
          G.text('- COURT IS IN SESSION -', 320, 18, { size: 16, align: 'center', color: '#ffe040', alpha: court.a });
        }
      },
    };
    bt.hideKaraoke = true;
    yield* DF.tween(court, { a: 1 }, 0.4);
    if (yellow) yellow.setPose('gang/yellow', 10, true);
    Audio.play('impact', { vol: 0.6 });
    yield* bt.say('* YELLOW: ORDER! Order in the court!');
    const questions = [
      { q: "* YELLOW: Who's on trial here?!", opts: ['FLOWERY', 'KRIS', 'SUSIE', 'YELLOW'], right: 0, ok: '* FLOWERY gasps theatrically.' },
      { q: '* YELLOW: Present the evidence!', opts: ['MOSS', 'A PENCIL', 'A KNIFE', 'A GLOVE'], right: 0, ok: '* You present the MOSS FLOWERY made you and\n  Susie eat. Everyone recoils.' },
      { q: '* YELLOW: And the sentence?', opts: ['JAIL', 'A HUG', 'A MEDAL', 'A NAP'], right: 0, ok: null },
    ];
    const wrong = [
      "* YELLOW: Objection! ...Wait, that's MY line.",
      '* BLUE: Integrity, please. Try again.',
      "* YELLOW: That don't sound right, pardner.",
    ];
    for (const qq of questions) {
      for (;;) {
        const pick = yield* bt.choose(qq.q, qq.opts);
        if (pick === qq.right) {
          Audio.play('ui_select', { vol: 0.8 });
          break;
        }
        Audio.play('error', { vol: 0.6 });
        if (blue) blue.shake = 3;
        yield* bt.say(U.choose(wrong));
      }
      if (qq.ok) yield* bt.say(qq.ok);
    }
    // Verdict.
    Audio.play('impact', { vol: 1 });
    bt.fx.screenShake(8);
    bt.fx.screenFlash('#ffe040', 0.6, 3);
    const verdict = { t0: DF.time };
    bt.overlay.draw2 = () => {
      const k = Math.min(1, (DF.time - verdict.t0) * 4);
      G.text('GUILTY!', 320, 60, { size: Math.round(32 + (1 - k) * 32), align: 'center', color: '#ff4040', outline: '#000', outlineWidth: 6, alpha: k });
    };
    const oldDraw = bt.overlay.draw;
    bt.overlay.draw = () => {
      oldDraw();
      bt.overlay.draw2();
    };
    yield 0.6;
    Audio.voice('vc_say_that_again');
    bt.flowery.shake = 3;
    yield 1.3;
    // Jail bars drop over Flowery.
    const fl = bt.flowery;
    const bars = { y: -200 };
    bt.overlay.draw = () => {
      oldDraw();
      bt.overlay.draw2();
      const top = fl.top() - 10;
      for (let i = 0; i < 6; i++) {
        const x = fl.x - 60 + i * 24;
        G.rect(x, top + bars.y, 6, fl.y - top + 10, '#909090');
        G.rect(x + 1, top + bars.y, 2, fl.y - top + 10, '#d0d0d0');
      }
      G.rect(fl.x - 66, top + bars.y, 132, 8, '#707070');
    };
    yield* DF.tween(bars, { y: 0 }, 0.35, 'inQuad');
    Audio.play('locker', { vol: 0.8 });
    bt.fx.screenShake(6);
    yield 1.4;
    yield* DF.tween(court, { a: 0 }, 0.3);
    bt.overlay = null;
    bt.hideKaraoke = false;
    return { mercy: 10 };
  };

  // ---- FIGHT: the Deltarune attack bar -------------------------------------------------
  MG.attack = function* (bt, attackers) {
    const rows = attackers.map((a, i) => ({
      m: a.member,
      target: a.target,
      x: 84 + (30 + i * U.choose([0, 10, 15])) * 8,
      done: false,
      points: 0,
      burst: 0,
      y: 365 + 38 * bt.party.indexOf(a.member),
    }));
    const speed = 8 * 30;
    bt.attackRows = rows;
    for (const r of rows) r.m.setAnim('attackready');
    let t = 0;
    while (rows.some((r) => !r.done) && t < 3) {
      const dt = yield null;
      t += dt;
      const pressed = Input.pressed('confirm');
      // One press hits the closest pending bolt (like Deltarune).
      let best = null;
      for (const r of rows) {
        if (r.done) continue;
        r.x -= speed * dt;
        if (r.x < 84 - 36) {
          r.done = true;
          r.points = 0;
        }
        if (!best || r.x < best.x) best = r;
      }
      if (pressed && best && !best.done) {
        const p = Math.abs(Math.round((best.x - 84) / 8));
        best.points = p === 0 ? 150 : Math.max(0, 120 - p * 4);
        best.done = true;
        best.burst = 1;
        Audio.play(p === 0 ? 'criticalswing' : 'ui_select', { vol: 0.6 });
      }
    }
    for (const r of rows) if (!r.done) r.done = true;
    // Swing!
    const results = [];
    for (const r of rows) {
      r.m.setAnim('attack');
      Audio.play('slash', { vol: 0.8 });
      const e = r.target;
      const c = e.center();
      bt.fx.add({ frame: 'fx/cut_1', anim: 'fx/cut', fps: 12, x: c.x + U.rand(-10, 10), y: c.y + U.rand(-10, 10), life: 0.3, scale: 2, fade: false });
      yield 0.15;
      const dmg = r.points > 0 ? Math.round((r.m.def.at * r.points) / 20 + U.randInt(0, 3)) : 0;
      if (dmg > 0) {
        Audio.play('damage', { vol: 0.8 });
        e.shake = 4;
        e.hp = Math.max(1, e.hp - dmg);
        bt.fx.number(c.x, c.y - 20, dmg, r.m.def.dmgColor);
      } else {
        bt.fx.msg(c.x, c.y - 20, 'msg/miss');
      }
      results.push({ member: r.m, dmg, target: e });
      yield 0.25;
    }
    yield 0.6;
    bt.attackRows = null;
    for (const r of rows) r.m.resetAnim();
    return results;
  };

  MG.drawAttackRows = function (bt) {
    const rows = bt.attackRows;
    if (!rows) return;
    G.rect(79, 403, 224, 2, '#000080');
    G.rect(79, 441, 224, 2, '#000080');
    for (const r of rows) {
      const y = r.y;
      G.draw('icon/' + r.m.id + '_head', 21, y + 19, { scale: 1, ox: 0.5, oy: 0.5 });
      G.draw('ui/press', 42, y, { scale: 1 });
      G.rect(80, y, 2, 38, r.m.def.color);
      G.rect(84, y, 2, 38, r.m.def.color, 0.5);
      if (!r.done) G.rect(Math.round(r.x), y, 6, 38, '#ffffff');
      else if (r.burst > 0) {
        r.burst = Math.max(0, r.burst - DF.STEP * 3);
        const s = (1 - r.burst) * 20;
        G.rect(Math.round(r.x - s / 2), y - s / 2, 6 + s, 38 + s, r.points >= 150 ? '#ffff40' : '#ffffff', r.burst);
      }
    }
  };
})();
