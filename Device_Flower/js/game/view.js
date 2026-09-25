/* Device_Flower - drawing the battle: background, battlers, board, UI, TP bar and karaoke. */
(function () {
  'use strict';
  const DF = window.DF;
  const G = DF.G;
  const U = DF.U;

  const STRIP = '#332033';
  const V = (DF.BattleView = {});

  // ---- background: Deltarune grid over a festival sunset ------------------------------
  const bgPetals = [];
  for (let i = 0; i < 26; i++) {
    bgPetals.push({ x: Math.random() * 640, y: Math.random() * 330, s: 0.5 + Math.random(), sp: 12 + Math.random() * 30, ph: Math.random() * 6 });
  }
  V.background = function (bt, t, omega) {
    const ctx = G.ctx;
    const pulse = DF.Music.kickPulse();
    const g = ctx.createLinearGradient(0, 0, 0, 330);
    if (omega) {
      g.addColorStop(0, '#05010f');
      g.addColorStop(0.55, '#1a0a3a');
      g.addColorStop(1, '#3a1050');
    } else {
      g.addColorStop(0, '#0c0418');
      g.addColorStop(0.5, '#34102e');
      g.addColorStop(0.85, '#7a2a36');
      g.addColorStop(1, '#a0462a');
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 640, 480);
    // Sun (or a rainbow halo when OMEGA).
    const sx = 400;
    const sy = 318;
    if (omega) {
      for (let i = 0; i < 7; i++) {
        G.ring(sx, sy, 150 - i * 9 + pulse * 4, U.RAINBOW[(i + Math.floor(t * 8)) % 7], 5, 0.35);
      }
    } else {
      const sg = ctx.createRadialGradient(sx, sy, 10, sx, sy, 130);
      sg.addColorStop(0, 'rgba(255,220,120,' + (0.55 + pulse * 0.1) + ')');
      sg.addColorStop(0.5, 'rgba(255,140,60,0.35)');
      sg.addColorStop(1, 'rgba(255,90,60,0)');
      ctx.fillStyle = sg;
      ctx.fillRect(sx - 140, sy - 140, 280, 280);
      ctx.save();
      ctx.beginPath();
      ctx.arc(sx, sy, 78, 0, Math.PI * 2);
      ctx.clip();
      const sun = ctx.createLinearGradient(0, sy - 78, 0, sy + 78);
      sun.addColorStop(0, '#ffe890');
      sun.addColorStop(1, '#ff6a3a');
      ctx.fillStyle = sun;
      ctx.fillRect(sx - 80, sy - 80, 160, 160);
      // Retro stripes.
      ctx.fillStyle = '#7a2a36';
      for (let i = 0; i < 7; i++) {
        const yy = sy - 10 + i * 12 + ((t * 10) % 12);
        ctx.fillRect(sx - 80, Math.round(yy), 160, 2 + i);
      }
      ctx.restore();
    }
    // Deltarune battle grid, scrolling diagonally.
    ctx.save();
    ctx.globalAlpha = omega ? 0.35 : 0.5;
    const off = (t * 15) % 50;
    for (let x = -50; x < 690; x += 50) {
      for (let y = -50; y < 480; y += 50) {
        G.draw('ui/bgtile', Math.round(x + off), Math.round(y + off), { scale: 1, tint: omega ? U.rainbow(Math.floor((x + y) / 50)) : null });
      }
    }
    ctx.restore();
    // Castle / flower silhouettes along the horizon.
    ctx.fillStyle = omega ? '#0a0418' : '#1c0822';
    ctx.beginPath();
    ctx.moveTo(0, 480);
    const hills = [0, 300, 40, 280, 70, 292, 110, 262, 140, 276, 170, 250, 190, 270, 230, 284, 260, 266, 300, 288, 340, 276, 380, 290, 420, 270, 470, 286, 500, 258, 520, 244, 540, 258, 570, 272, 600, 262, 640, 280, 640, 480, 0, 480];
    for (let i = 0; i < hills.length; i += 2) ctx.lineTo(hills[i], hills[i + 1]);
    ctx.closePath();
    ctx.fill();
    // Castle tower at the right (the Fountain waits on top).
    ctx.fillRect(516, 206, 16, 60);
    ctx.fillRect(510, 200, 28, 8);
    ctx.beginPath();
    ctx.moveTo(508, 200);
    ctx.lineTo(524, 176);
    ctx.lineTo(540, 200);
    ctx.fill();
    // Drifting petals.
    for (const p of bgPetals) {
      p.x -= p.sp * DF.STEP * 0.6;
      p.y += Math.sin(t * 1.3 + p.ph) * 0.15 + p.sp * DF.STEP * 0.15;
      if (p.x < -10) {
        p.x = 650;
        p.y = Math.random() * 300;
      }
      if (p.y > 330) p.y = -10;
      G.draw(G.frameAt('petal/falling', t + p.ph, 8, true), p.x, p.y, { scale: p.s, ox: 0.5, oy: 0.5, alpha: 0.5, tint: omega ? U.rainbow(Math.floor(p.ph * 3)) : '#ffc0d0' });
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
    let col = '#ffe040';
    if (ly.chorus) col = U.RAINBOW[Math.floor(DF.time * 8) % U.RAINBOW.length];
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
        G.text(e.name, 80, yy, { size: 32, color: on ? '#ffffff' : '#808080' });
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
