/* Device_Flower - drawing the battle: background, battlers, board, UI, TP bar and karaoke. */
(function () {
  'use strict';
  const DF = window.DF;
  const G = DF.G;
  const U = DF.U;

  const STRIP = '#332033';
  const V = (DF.BattleView = {});

  // ---- background: the roof of the Flower Castle at sunset ---------------------------
  // Static layers are painted once per sunset stage; the sun, clouds, the Dark Fountain,
  // petals and sparkles are animated on top.
  const HORIZON = 182; // far edge of the rooftop
  const FX = 320; // the Fountain's column
  const bgPetals = [];
  for (let i = 0; i < 30; i++) {
    bgPetals.push({ x: Math.random() * 640, y: Math.random() * 330, s: 1 + Math.random(), sp: 14 + Math.random() * 30, ph: Math.random() * 6 });
  }
  const clouds = [];
  for (let i = 0; i < 6; i++) clouds.push({ x: Math.random() * 760, y: 26 + i * 20 + Math.random() * 10, w: 90 + Math.random() * 140, sp: 3 + Math.random() * 5 });

  function mix(c1, c2, k) {
    const a = parseInt(c1.slice(1), 16);
    const b = parseInt(c2.slice(1), 16);
    const r = Math.round(((a >> 16) & 255) * (1 - k) + ((b >> 16) & 255) * k);
    const g = Math.round(((a >> 8) & 255) * (1 - k) + ((b >> 8) & 255) * k);
    const bl = Math.round((a & 255) * (1 - k) + (b & 255) * k);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
  }
  function layer(draw) {
    const c = document.createElement('canvas');
    c.width = 640;
    c.height = 480;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    draw(x);
    return c;
  }
  const cache = {};
  function layers(dusk) {
    const key = Math.round(dusk * 10);
    if (cache[key]) return cache[key];
    const d = key / 10;
    const m = (a, b) => mix(a, b, d);
    const sky = layer((x) => {
      const g = x.createLinearGradient(0, 0, 0, HORIZON);
      g.addColorStop(0, m('#2a1450', '#0c0620'));
      g.addColorStop(0.45, m('#9a3c78', '#44174a'));
      g.addColorStop(0.78, m('#f07a5a', '#a0384a'));
      g.addColorStop(1, m('#ffd488', '#e0703c'));
      x.fillStyle = g;
      x.fillRect(0, 0, 640, HORIZON + 4);
    });
    const far = layer((x) => {
      // Two mountain ranges, then the towers of the castle town.
      const ridge = (col, base, amp, seed) => {
        x.fillStyle = col;
        x.beginPath();
        x.moveTo(0, HORIZON);
        for (let i = 0; i <= 64; i++) {
          const px = i * 10;
          const py = base - Math.abs(Math.sin(i * 0.37 + seed)) * amp - Math.sin(i * 0.11 + seed * 2) * amp * 0.5;
          x.lineTo(px, py);
        }
        x.lineTo(640, HORIZON);
        x.fill();
      };
      ridge(m('#b85a80', '#5a2450'), 150, 26, 1.3);
      ridge(m('#7a2e62', '#361238'), 166, 16, 4.1);
      x.fillStyle = m('#4a1a48', '#200a26');
      for (const [px, h, w] of [[40, 30, 22], [120, 22, 16], [196, 36, 24], [452, 28, 20], [540, 40, 26], [612, 24, 18]]) {
        // Little tiered pagodas.
        for (let k = 0; k < 3; k++) {
          const yy = HORIZON - 8 - k * (h / 3);
          const ww = w - k * 5;
          x.fillRect(px - ww / 2 + 3, yy - h / 3 + 3, ww - 6, h / 3 - 3);
          x.beginPath();
          x.moveTo(px - ww / 2 - 4, yy - 2);
          x.lineTo(px, yy - h / 3 - 2);
          x.lineTo(px + ww / 2 + 4, yy - 2);
          x.fill();
        }
        x.fillRect(px - 1, HORIZON - 12 - h - 6, 2, 8);
      }
    });
    const near = layer((x) => {
      // The great torii the Fountain rises through.
      const red = m('#e2502c', '#9a2c24');
      const dark = m('#7a2018', '#4a1014');
      const top = '#1c0c18';
      for (const px of [262, 378]) {
        x.fillStyle = dark;
        x.fillRect(px - 7, 70, 14, HORIZON - 70);
        x.fillStyle = red;
        x.fillRect(px - 5, 70, 9, HORIZON - 70);
        x.fillStyle = '#1c0c18';
        x.fillRect(px - 8, HORIZON - 10, 16, 10);
      }
      x.fillStyle = red;
      x.fillRect(236, 96, 168, 9); // nuki
      x.fillStyle = dark;
      x.fillRect(236, 103, 168, 2);
      x.fillRect(314, 70, 12, 26); // gakuzuka
      x.fillStyle = red;
      x.fillRect(222, 62, 196, 9); // shimaki
      // kasagi: the black top beam, curving up at the ends.
      x.fillStyle = top;
      x.beginPath();
      x.moveTo(206, 48);
      x.quadraticCurveTo(320, 62, 434, 48);
      x.lineTo(430, 58);
      x.quadraticCurveTo(320, 70, 210, 58);
      x.closePath();
      x.fill();
      x.fillStyle = m('#ffb070', '#c05a40');
      x.fillRect(250, 57, 140, 1);
      // The railing along the far edge of the roof.
      const rail = m('#c0382c', '#7a1c20');
      x.fillStyle = '#1c0c18';
      x.fillRect(0, HORIZON - 2, 640, 4);
      for (let px = 6; px < 640; px += 38) {
        if (px > 240 && px < 400) continue; // open where the torii stands
        x.fillStyle = rail;
        x.fillRect(px, HORIZON - 22, 6, 22);
        x.fillStyle = '#e8b040';
        x.fillRect(px - 1, HORIZON - 26, 8, 4);
      }
      x.fillStyle = rail;
      x.fillRect(0, HORIZON - 20, 244, 4);
      x.fillRect(396, HORIZON - 20, 244, 4);
      x.fillRect(0, HORIZON - 10, 244, 3);
      x.fillRect(396, HORIZON - 10, 244, 3);
      // The rooftop: sunset light on wooden boards, fading into shadow.
      const g = x.createLinearGradient(0, HORIZON, 0, 480);
      g.addColorStop(0, m('#a0524a', '#50243a'));
      g.addColorStop(0.25, m('#6a2c40', '#34162c'));
      g.addColorStop(1, m('#2a1026', '#140816'));
      x.fillStyle = g;
      x.fillRect(0, HORIZON + 2, 640, 480 - HORIZON);
      x.strokeStyle = m('#3a1628', '#1c0a18');
      x.lineWidth = 2;
      for (let k = 1; k < 16; k++) {
        const yy = HORIZON + 2 + Math.pow(k, 1.55) * 3.6;
        if (yy > 480) break;
        x.beginPath();
        x.moveTo(0, Math.round(yy));
        x.lineTo(640, Math.round(yy));
        x.stroke();
      }
      for (let i = -12; i <= 12; i++) {
        x.beginPath();
        x.moveTo(FX + i * 34, HORIZON + 2);
        x.lineTo(FX + i * 120, 480);
        x.stroke();
      }
      // Warm sheen where the sun hits the boards.
      const sh = x.createRadialGradient(470, HORIZON + 10, 4, 470, HORIZON + 10, 220);
      sh.addColorStop(0, m('#ffb070', '#c05a40'));
      sh.addColorStop(1, 'rgba(0,0,0,0)');
      x.globalAlpha = 0.35;
      x.fillStyle = sh;
      x.fillRect(200, HORIZON, 440, 160);
      x.globalAlpha = 1;
      // Cherry trees hanging into the frame from the corners.
      const blossom = (cx, cy, r, n, seed) => {
        let s2 = seed;
        const rnd = () => ((s2 = (s2 * 9301 + 49297) % 233280) / 233280);
        for (let i = 0; i < n; i++) {
          const a = rnd() * Math.PI * 2;
          const rr = Math.sqrt(rnd()) * r;
          const bx = cx + Math.cos(a) * rr;
          const by = cy + Math.sin(a) * rr * 0.6;
          const br = 7 + rnd() * 9;
          x.fillStyle = m('#b8507e', '#6a2a50');
          x.beginPath();
          x.arc(bx + 2, by + 3, br, 0, Math.PI * 2);
          x.fill();
          x.fillStyle = m(rnd() < 0.5 ? '#ff9cc4' : '#f282b0', '#a04a78');
          x.beginPath();
          x.arc(bx, by, br, 0, Math.PI * 2);
          x.fill();
          x.fillStyle = m('#ffd0e4', '#c07098');
          x.beginPath();
          x.arc(bx - br * 0.3, by - br * 0.35, br * 0.35, 0, Math.PI * 2);
          x.fill();
        }
      };
      x.strokeStyle = '#2a1020';
      x.lineWidth = 6;
      x.beginPath();
      x.moveTo(640, 10);
      x.quadraticCurveTo(560, 30, 470, 22);
      x.moveTo(560, 26);
      x.quadraticCurveTo(540, 60, 500, 70);
      x.stroke();
      x.lineWidth = 5;
      x.beginPath();
      x.moveTo(0, 8);
      x.quadraticCurveTo(70, 30, 150, 18);
      x.stroke();
      blossom(560, 30, 90, 46, 7);
      blossom(500, 64, 34, 12, 3);
      blossom(70, 18, 80, 34, 11);
    });
    cache[key] = { sky, far, near };
    return cache[key];
  }

  /*
   * The Dark Fountain: a column of black that bubbles up forever, edged in white.
   * o: { x, base, grow (0..1 of its height), white (0..1 while it is being sealed), size }
   */
  function fountain(t, pulse, dusk, o) {
    o = o || {};
    const ctx = G.ctx;
    const fx = o.x === undefined ? FX : o.x;
    const base = o.base === undefined ? HORIZON - 4 : o.base;
    const grow = o.grow === undefined ? 1 : o.grow;
    const size = o.size || 1;
    const white = o.white || 0;
    if (grow <= 0) return;
    const topY = base - (base + 8) * grow;
    const hw = (y) => (30 + (base - y) * 0.14 + Math.sin(y * 0.06 + t * 3) * 3 + Math.sin(y * 0.021 - t * 1.7) * 4) * size * (0.6 + 0.4 * grow);
    // Aura.
    const aura = ctx.createLinearGradient(fx - 110 * size, 0, fx + 110 * size, 0);
    aura.addColorStop(0, 'rgba(0,0,0,0)');
    aura.addColorStop(0.5, 'rgba(10,0,20,' + (0.35 + dusk * 0.2) * (1 - white) + ')');
    aura.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = aura;
    ctx.fillRect(fx - 110 * size, topY, 220 * size, base - topY);
    // Column and bubbles share one white outline: white shapes first, black on top.
    const bubbles = [];
    for (let i = 0; i < 14; i++) {
      const side = i % 2 ? 1 : -1;
      const y = base - ((t * 70 + i * 31) % (base + 20));
      if (y < topY + 6) continue;
      bubbles.push({ x: fx + side * (hw(y) - 3), y, r: (4 + ((i * 7) % 4) + pulse * 1.5) * size });
    }
    const col = new Path2D();
    col.moveTo(fx - hw(base), base);
    for (let y = base; y >= topY; y -= 4) col.lineTo(fx - hw(y), y);
    col.quadraticCurveTo(fx, topY - 14 * size, fx + hw(topY), topY);
    for (let y = topY; y <= base; y += 4) col.lineTo(fx + hw(y), y);
    col.closePath();
    const ink = white > 0 ? mix('#000000', '#ffffff', white) : '#000000';
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke(col);
    for (const b of bubbles) G.circle(b.x, b.y, b.r + 2, '#ffffff');
    ctx.fillStyle = ink;
    ctx.fill(col);
    for (const b of bubbles) G.circle(b.x, b.y, b.r, ink);
    // Streaks of light racing up the middle.
    for (let i = 0; i < 14; i++) {
      const y = base - ((t * 150 + i * 53) % (base + 30));
      if (y < topY) continue;
      const off = (((i * 37) % 50) - 25) / 30;
      const len = 10 + ((i * 13) % 16);
      G.rect(Math.round(fx + off * hw(y) * 0.6), Math.round(y), 2, len, '#ffffff', 0.5);
    }
    // Splash at the foot of the column.
    for (let i = 0; i < 6; i++) {
      const k = (t * 1.3 + i / 6) % 1;
      const dir = i % 2 ? 1 : -1;
      const px = fx + dir * (26 + k * 40) * size;
      const py = base - Math.sin(k * Math.PI) * 18 * size;
      G.circle(px, py, (4 * (1 - k) + 1) * size, '#ffffff');
      G.circle(px, py, 3 * (1 - k) * size, ink);
    }
  }

  /*
   * The whole rooftop. o: { dusk (0..1), omega, fountain: {..} | null (the one behind the
   * torii), front: [{..}] (fountains standing on the roof itself) }
   */
  V.rooftop = function (t, o) {
    const ctx = G.ctx;
    const pulse = DF.Music.kickPulse();
    const dusk = o.dusk || 0;
    const omega = !!o.omega;
    const L = layers(dusk);
    ctx.drawImage(L.sky, 0, 0);
    if (omega) {
      ctx.save();
      ctx.globalAlpha = 0.25;
      for (let i = 0; i < 7; i++) G.rect(0, i * 27, 640, 27, U.RAINBOW[(i + Math.floor(t * 6)) % 7]);
      ctx.restore();
    }
    // The setting sun (lower with every phase).
    const sx = 470;
    const sy = 118 + dusk * 52;
    const sg = ctx.createRadialGradient(sx, sy, 8, sx, sy, 150);
    sg.addColorStop(0, 'rgba(255,230,150,' + (0.6 + pulse * 0.1) + ')');
    sg.addColorStop(0.4, 'rgba(255,150,80,0.3)');
    sg.addColorStop(1, 'rgba(255,90,60,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(sx - 150, sy - 150, 300, 300);
    G.circle(sx, sy, 40, mix('#ffe9a0', '#ff9a50', dusk));
    G.circle(sx, sy + 6, 36, mix('#ffd070', '#ff7a40', dusk), 0.6);
    // Long thin clouds catching the light.
    for (const c of clouds) {
      c.x -= c.sp * DF.STEP;
      if (c.x + c.w < 0) c.x = 640 + Math.random() * 120;
      G.rect(Math.round(c.x), Math.round(c.y), Math.round(c.w), 4, mix('#ffb48c', '#a04870', dusk), 0.55);
      G.rect(Math.round(c.x + 16), Math.round(c.y - 3), Math.round(c.w * 0.6), 3, mix('#ffd8b0', '#c06a80', dusk), 0.45);
    }
    ctx.drawImage(L.far, 0, 0);
    if (o.fountain) fountain(t, pulse, dusk, o.fountain);
    ctx.drawImage(L.near, 0, 0);
    if (o.front) for (const f of o.front) fountain(t, pulse, dusk, f);
    // Petals drifting across the roof.
    for (const p of bgPetals) {
      p.x -= p.sp * DF.STEP * 0.6;
      p.y += Math.sin(t * 1.3 + p.ph) * 0.15 + p.sp * DF.STEP * 0.2;
      if (p.x < -10) {
        p.x = 650;
        p.y = Math.random() * 300;
      }
      if (p.y > 330) p.y = -10;
      G.draw(G.frameAt('petal/spin', t + p.ph, 8, true), p.x, p.y, { scale: p.s, ox: 0.5, oy: 0.5, alpha: 0.75, tint: omega ? U.rainbow(Math.floor(p.ph * 3)) : null });
    }
  };
  V.background = function (bt, t, omega) {
    V.rooftop(t, { dusk: omega ? 1 : U.clamp(((bt.phase || 1) - 1) / 5, 0, 1), omega, fountain: {} });
    if (bt.hard) V.redWash();
  };
  // HARD MODE: everything takes on the color of DETERMINATION.
  V.redWash = function () {
    const ctx = G.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    G.rect(0, 0, 640, 480, '#ff9090');
    ctx.globalCompositeOperation = 'source-over';
    G.rect(0, 0, 640, 480, '#ff0000', 0.06 + 0.03 * Math.sin(DF.time * 5));
    ctx.restore();
  };
  // FLOWERY LOADing his SAVE: a VHS-style rewind with the MERCY counting back down.
  V.drawRewind = function (bt) {
    const r = bt.rewind;
    const ctx = G.ctx;
    G.rect(0, 0, 640, 480, '#200000', 0.3);
    for (let i = 0; i < 14; i++) {
      const y = (i * 43 + r.t * 1400) % 480;
      G.rect(0, Math.round(y), 640, 4 + (i % 3) * 5, '#ffffff', 0.1 + (i % 2) * 0.08);
    }
    ctx.fillStyle = '#ff3030';
    for (const ox of [0, 22]) {
      ctx.beginPath();
      ctx.moveTo(40 + ox, 44);
      ctx.lineTo(60 + ox, 32);
      ctx.lineTo(60 + ox, 56);
      ctx.fill();
    }
    G.text('LOAD', 94, 26, { size: 32, color: '#ff3030', outline: '#000', outlineWidth: 5 });
    const m = Math.round(U.lerp(r.from, r.to, U.clamp(r.t, 0, 1)));
    G.text('MERCY ' + m + '%', 604, 26, { size: 32, align: 'right', color: '#ffff00', outline: '#000', outlineWidth: 5 });
  };
  V.fountain = function (t, o) {
    fountain(t, DF.Music.kickPulse(), 1, o);
  };

  // Sparkles that orbit FLOWERY and swell on the beat.
  V.drawSparkles = function (e, t) {
    if (!e.visible) return;
    const c = e.center();
    const pulse = DF.Music.kickPulse();
    for (let i = 0; i < 7; i++) {
      const a = t * 0.9 + (i * Math.PI * 2) / 7;
      const r = 46 + Math.sin(t * 2 + i) * 8;
      const x = c.x + Math.cos(a) * r;
      const y = c.y + Math.sin(a) * r * 0.8;
      const k = 0.6 + pulse * 0.8 + Math.sin(t * 6 + i * 2) * 0.2;
      G.draw(G.frameAt('fx/sparkle', t * 0.7 + i * 0.3, 10, true), x, y, { scale: 1 + k, ox: 0.5, oy: 0.5, alpha: 0.85, tint: e.rainbow ? U.rainbow(i * 3) : e.determined ? '#ff3030' : '#fff8c0' });
    }
  };

  // ---- whole frame ------------------------------------------------------------------
  V.draw = function (bt) {
    const ctx = G.ctx;
    const shake = bt.fx.offset();
    V.background(bt, bt.bgT, bt.omega);
    ctx.save();
    ctx.translate(shake.x, shake.y);

    if (bt.climb) {
      bt.climb.draw();
    } else {
      // Battlers.
      V.drawSparkles(bt.flowery, bt.bgT);
      for (const e of bt.enemies) e.draw();
      if (bt.ralseiBody) V.drawRalseiBody(bt);
      for (const m of bt.party) m.draw();
      bt.fx.draw('back');
      // Board.
      if (bt.arenaVisible) {
        bt.arena.drawBack();
        if (bt.wave) bt.wave.draw();
        bt.arena.drawBorder();
        if (bt.wave) bt.wave.drawHint();
        bt.soul.draw('right');
        if (bt.soul.grazeFlash > 0 && bt.soul.visible) {
          G.draw('heart/graze', bt.soul.x, bt.soul.y, { scale: 0.5, ox: 0.5, oy: 0.5, rot: -Math.PI / 2, alpha: bt.soul.grazeFlash * 0.8 });
        }
      } else if (bt.soul.visible) {
        bt.soul.draw('right');
      }
      if (bt.deathSoul) {
        const d = bt.deathSoul;
        G.draw(d.broken ? 'heart/break' : 'heart/heart', d.x, d.y, { scale: 1, ox: 0.5, oy: 0.5, tint: '#ffa020', rot: -Math.PI / 2 });
      }
      bt.fx.draw('mid');
      for (const b of bt.bubbles) b.draw();
      if (bt.overlay) bt.overlay.draw();
    }
    ctx.restore();

    if (bt.rewind) V.drawRewind(bt);
    V.drawUI(bt);
    V.drawTP(bt);
    if (!bt.hideKaraoke) V.drawKaraoke(bt);
    bt.fx.draw('top');
    bt.fx.drawFlash();
    if (bt.fade > 0) G.rect(0, 0, 640, 480, '#000', bt.fade);
  };

  V.drawRalseiBody = function (bt) {
    const r = bt.ralseiBody;
    G.draw('rplat/splat_1', r.x, r.y, { ox: 0.5, oy: 1, alpha: r.alpha === undefined ? 1 : r.alpha });
    if (Math.floor(r.t * 2) % 2 === 0) G.bitmapText('plain', 'z', r.x + 30, r.y - 40 - (r.t * 6) % 10, { color: '#ffffff', fill: true, alpha: 0.7 });
  };

  // ---- karaoke ----------------------------------------------------------------------
  V.drawKaraoke = function (bt) {
    const ly = DF.Music.lyric();
    if (!ly) return;
    const size = 16;
    const w = G.textWidth(ly.text, 'main', size);
    const x = Math.round(320 - w / 2);
    const y = 8;
    const ctx = G.ctx;
    G.rect(x - 8, y - 3, w + 16, 22, '#000000', 0.45);
    G.text(ly.text, x, y, { size, color: '#a090a8' });
    const cut = Math.round(w * ly.progress);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y - 4, cut, 26);
    ctx.clip();
    let col = bt.hard ? '#ff4040' : '#ffe040';
    if (ly.chorus) col = bt.hard ? (Math.floor(DF.time * 8) % 2 ? '#ff2020' : '#ffffff') : U.RAINBOW[Math.floor(DF.time * 8) % U.RAINBOW.length];
    G.text(ly.text, x, y, { size, color: col });
    ctx.restore();
    if (ly.chorus && DF.Music.kickPulse() > 0.6) G.rect(x - 8, y - 3, w + 16, 22, '#ffffff', 0.08);
  };

  // ---- TP bar -----------------------------------------------------------------------
  V.drawTP = function (bt) {
    const x = Math.round(38 + bt.tpX);
    const y = 40;
    if (x < -40) return;
    const pct = U.clamp(bt.tpShown / 100, 0, 1);
    const h = Math.round(196 * pct);
    const max = bt.tp >= 100;
    G.drawPart('ui/tp_fill', x, y, 0, 0, 25, 196 - h, '#800000');
    G.drawPart('ui/tp_fill', x, y + 196 - h, 0, 196 - h, 25, h, max ? '#ffd020' : '#ffa040');
    if (bt.tpPreview > 0) {
      const ph = Math.round(196 * Math.min(pct, bt.tpPreview / 100));
      const a = 0.5 + Math.sin(DF.time * 12) * 0.3;
      G.ctx.save();
      G.ctx.globalAlpha = a;
      G.drawPart('ui/tp_fill', x, y + 196 - h, 0, 196 - h, 25, ph, '#ffffff');
      G.ctx.restore();
    }
    G.draw('ui/tp_outline', x, y, { scale: 1 });
    G.draw('ui/tp_text', x - 30, y + 30, { scale: 1 });
    const n = Math.floor(bt.tpShown + 0.0001);
    if (n < 100) {
      G.text(String(n), x - 30, y + 70, { size: 32 });
      G.text('%', x - 25, y + 95, { size: 32 });
    } else {
      G.text('M', x - 28, y + 70, { size: 32, color: '#ffff00' });
      G.text('A', x - 24, y + 90, { size: 32, color: '#ffff00' });
      G.text('X', x - 20, y + 110, { size: 32, color: '#ffff00' });
    }
  };

  // ---- bottom UI --------------------------------------------------------------------
  V.drawUI = function (bt) {
    const oy = Math.round(bt.uiY - 325);
    if (bt.uiY >= 480) return;
    const ctx = G.ctx;
    ctx.save();
    ctx.translate(0, oy);
    // Action strip + text area backgrounds.
    G.rect(0, 325, 640, 2, STRIP);
    G.rect(0, 327, 640, 35, '#000');
    G.rect(0, 362, 640, 3, STRIP);
    G.rect(0, 365, 640, 115, '#000');
    const n = bt.party.length;
    const off = n === 3 ? 0 : n === 2 ? 108 : 213;
    const gap = n === 2 ? 1 : 0;
    bt.party.forEach((m, i) => V.drawActionBox(bt, m, i, off + i * (213 + gap), 325));
    V.drawTextArea(bt);
    ctx.restore();
  };

  V.drawActionBox = function (bt, m, i, bx, by) {
    const ctx = G.ctx;
    const sel = bt.state === 'SELECT' && bt.current === i;
    const col = m.color;
    ctx.save();
    ctx.translate(bx, by);
    // Selection matrix.
    G.rect(2, 2, 209, 35, '#000');
    if (sel) {
      for (let k = 0; k < 12; k++) {
        const siner = bt.selSiner + k * (10 * Math.PI);
        const s = Math.sin(siner / 60);
        if (Math.cos(siner / 60) < 0) {
          ctx.globalAlpha = Math.max(0, s);
          G.rect(Math.round(1 - s * 30 + 30), 0, 2, 37, col);
          G.rect(Math.round(211 + s * 30 - 30), 0, 2, 37, col);
          ctx.globalAlpha = 1;
        }
      }
      G.rect(0, 2, 2, 35, col);
      G.rect(211, 2, 2, 35, col);
      G.rect(0, 5, 213, 2, col);
    }
    // Buttons (revealed when the display box rises).
    const btns = bt.buttonsFor(m);
    const selBtn = bt.lastBtn[m.id] || 0;
    const startX = 213 / 2 - ((btns.length - 1) * 35) / 2 - 1;
    btns.forEach((b, k) => {
      const x = Math.floor(startX + k * 35) + 0.5 - 15.5;
      const disabled = b === 'fight' && bt.fightLocked;
      let tex = 'btn/' + b;
      if (disabled) tex += '_d';
      else if (sel && k === selBtn) tex += '_h';
      G.draw(tex, Math.round(x), 8, { scale: 1 });
    });
    // Display box: head, name, HP.
    const y = Math.round(bt.boxY[i] || 0);
    G.rect(0, y, 213, 2, sel ? col : STRIP);
    if (sel) {
      G.rect(0, y + 2, 2, 34, col);
      G.rect(211, y + 2, 2, 34, col);
    }
    G.rect(2, y + 2, 209, 35, '#000');
    G.rect(128, y + 22, 76, 9, '#800000');
    if (m.hp > 0) G.rect(128, y + 22, Math.ceil((m.hp / m.maxhp) * 76), 9, col);
    const low = m.hp <= m.maxhp / 4;
    const hpCol = m.hp <= 0 ? '#ff0000' : low ? '#ffff00' : '#ffffff';
    const hs = String(m.hp);
    G.bitmapText('smallnumbers', hs, 152 - (hs.length - 1) * 8, y + 9, { color: hpCol, fill: true });
    G.bitmapText('smallnumbers', '/', 161, y + 9, { color: '#ffffff', fill: true });
    const ms = String(m.maxhp);
    G.bitmapText('smallnumbers', ms, 205 - G.bitmapWidth('smallnumbers', ms), y + 9, { color: hpCol, fill: true });
    let icon = 'icon/' + m.id + '_' + (m.down ? 'head_hurt' : m.headIcon === 'head' ? 'head' : m.headIcon);
    if (!G.has(icon)) icon = 'icon/' + m.id + '_head';
    G.draw(icon, 13, y + 11, { scale: 1 });
    G.draw('name/' + m.id, 51, y + 14, { scale: 1 });
    G.draw('ui/hp', 109, y + 22, { scale: 1 });
    ctx.restore();
  };

  V.drawTextArea = function (bt) {
    const menu = bt.menu;
    const heart = (x, y) => G.draw('heart/heart', x, y, { scale: 1, tint: '#ff0000' });
    if (bt.attackRows) {
      DF.Minigames.drawAttackRows(bt);
      return;
    }
    if (menu && bt.state === 'SELECT' && menu.mode === 'ENEMY') {
      G.text('HP', 424, 364, { size: 32, sy: 0.5 });
      G.text('MERCY', 524, 364, { size: 32, sy: 0.5 });
      bt.enemies.forEach((e, i) => {
        const yy = 375 + i * 30;
        const on = e.selectable;
        G.text(e.name, 80, yy, { size: 32, color: !on ? '#808080' : e.determined ? '#ff4040' : '#ffffff' });
        const nw = G.textWidth(e.name, 'main', 32);
        if (e.mercy >= 100) G.draw('ui/sparestar', 80 + nw + 20, yy + 10, { scale: 1 });
        if (on) {
          const hp = e.hp / e.maxhp;
          G.rect(420, yy + 5, 81, 16, '#800000');
          G.rect(420, yy + 5, Math.ceil(hp * 81), 16, '#00ff00');
          G.text(Math.round(hp * 100) + '%', 424, yy + 5, { size: 32, sy: 0.5 });
        }
        G.rect(520, yy + 5, 81, 16, on ? '#ff5020' : '#7f7f7f');
        G.rect(520, yy + 5, Math.round((e.mercy / 100) * 81), 16, '#ffff00');
        G.text(Math.round(e.mercy) + '%', 524, yy + 5, { size: 32, sy: 0.5, color: '#800000' });
      });
      heart(55, 385 + menu.sel * 30);
      return;
    }
    if (menu && bt.state === 'SELECT' && menu.mode === 'LIST') {
      const items = menu.items;
      const page = Math.floor(menu.sel / 6);
      for (let i = page * 6; i < Math.min(items.length, page * 6 + 6); i++) {
        const it = items[i];
        const col = (i % 2) * 230;
        const row = Math.floor((i - page * 6) / 2);
        let tx = 30 + col;
        const yy = 375 + row * 30;
        const able = !it.disabled && !(it.tp && it.tp > bt.tp + 0.001);
        if (it.party && it.party.length) {
          for (const pid of it.party) {
            G.draw('icon/' + pid + '_head', tx, yy + 4, { scale: 1, alpha: able ? 1 : 0.5 });
            tx += 30;
          }
        }
        G.text(it.name, tx, yy, { size: 32, color: able ? '#ffffff' : '#808080' });
      }
      const cur = items[menu.sel];
      if (cur) {
        const lines = (cur.desc || '').split('\n');
        lines.forEach((l, k) => G.text(l, 500, 375 + k * 32, { size: 32, color: '#808080' }));
        if (cur.tp) G.text(cur.tp + '% TP', 500, 375 + lines.length * 32, { size: 32, color: '#ffa040' });
      }
      const row = Math.floor((menu.sel - page * 6) / 2);
      heart(5 + (menu.sel % 2) * 230, 385 + row * 30);
      if (items.length > (page + 1) * 6) G.draw('ui/arrow_down', 470, 445 + Math.sin(DF.time * 6) * 2, { scale: 1 });
      if (page > 0) G.draw('ui/arrow_down', 470, 395 - Math.sin(DF.time * 6) * 2, { scale: 1, flipY: true });
      return;
    }
    if (menu && bt.state === 'SELECT' && menu.mode === 'PARTY') {
      bt.party.forEach((m, i) => {
        const yy = 375 + i * 30;
        G.text(m.name, 80, yy, { size: 32 });
        G.rect(400, yy + 5, 101, 16, '#800000');
        const p = Math.max(-1, m.hp / m.maxhp);
        if (p > 0) G.rect(400, yy + 5, Math.ceil(p * 101), 16, '#00ff00');
      });
      heart(55, 385 + menu.sel * 30);
      return;
    }
    const tb = bt.textbox;
    if (tb.face) G.draw(tb.face, 26, 374, { scale: 2 });
    if (tb.typer) tb.typer.draw();
    if (menu && menu.mode === 'CHOICE') {
      const base = 378 + Math.max(1, menu.lines) * 32 + 2;
      menu.options.forEach((o, i) => {
        const x = 80 + (i % 2) * 250;
        const y = base + Math.floor(i / 2) * 30;
        G.text(o, x, y, { size: 32, color: i === menu.sel ? '#ffff00' : '#ffffff' });
      });
      heart(55 + (menu.sel % 2) * 250, base + 10 + Math.floor(menu.sel / 2) * 30);
    }
  };
})();
