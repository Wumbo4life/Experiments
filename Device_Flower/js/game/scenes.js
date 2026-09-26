/* Device_Flower - title, help, settings, credits, game over and ending screens. */
(function () {
  'use strict';
  const DF = window.DF;
  const G = DF.G;
  const U = DF.U;
  const Input = DF.Input;
  const Audio = DF.Audio;

  function menuHeart(x, y) {
    G.draw('heart/heart', x, y, { scale: 1, tint: '#ff0000' });
  }

  // ---- shared petal backdrop -------------------------------------------------------
  class Petals {
    constructor(n) {
      this.list = [];
      for (let i = 0; i < n; i++) this.list.push(this.make(true));
    }
    make(any) {
      return { x: any ? Math.random() * 700 : 660, y: Math.random() * 480, sp: 20 + Math.random() * 40, s: 1 + Math.random(), ph: Math.random() * 6, c: U.choose(['#ffd0e0', '#ffe080', '#ffffff', '#ffb0c0']) };
    }
    update(dt) {
      for (const p of this.list) {
        p.x -= p.sp * dt;
        p.y += Math.sin(DF.time + p.ph) * 0.3 + p.sp * 0.25 * dt;
        if (p.x < -20 || p.y > 500) Object.assign(p, this.make(false), { y: Math.random() * 400 - 40 });
      }
    }
    draw(alpha) {
      for (const p of this.list) G.draw(G.frameAt('petal/falling', DF.time + p.ph, 8, true), p.x, p.y, { scale: p.s, ox: 0.5, oy: 0.5, tint: p.c, alpha: alpha || 0.7 });
    }
  }

  function drawLogo(y, t) {
    const ctx = G.ctx;
    const text = 'DEVICE_FLOWER';
    G.setFont('main', 64);
    const w = ctx.measureText(text).width;
    const x = 320 - w / 2;
    ctx.save();
    ctx.textBaseline = 'top';
    ctx.lineWidth = 8;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1a0620';
    ctx.strokeText(text, x, y);
    const g = ctx.createLinearGradient(0, y, 0, y + 60);
    g.addColorStop(0, '#fff6b0');
    g.addColorStop(0.5, '#ffd020');
    g.addColorStop(1, '#ff8a20');
    ctx.fillStyle = g;
    ctx.fillText(text, x, y);
    // Shine sweeping across.
    const sx = ((t * 180) % 900) - 150;
    ctx.globalCompositeOperation = 'source-atop';
    const sg = ctx.createLinearGradient(sx, 0, sx + 60, 0);
    sg.addColorStop(0, 'rgba(255,255,255,0)');
    sg.addColorStop(0.5, 'rgba(255,255,255,0.8)');
    sg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(x, y, w, 64);
    ctx.restore();
  }

  // ---- Boot: wait for assets + a first input (browsers need it to start audio) ----------
  class BootScene {
    constructor() {
      this.t = 0;
      this.ready = false;
      this.err = null;
    }
    update(dt) {
      this.t += dt;
      this.ready = DF.assetsReady && DF.Audio.ready;
      if (this.ready && (Input.anyPressed() || DF.pointerClicked)) {
        DF.pointerClicked = false;
        Audio.unlock();
        DF.setScene(new TitleScene());
      }
    }
    draw() {
      G.rect(0, 0, 640, 480, '#000');
      if (!DF.assetsReady) {
        G.ctx.fillStyle = '#fff';
        G.ctx.font = '16px monospace';
        G.ctx.fillText('Loading...', 20, 30);
        return;
      }
      const A = DF.Audio;
      if (!this.ready) {
        G.text('LOADING SOUNDS  ' + A.loaded + ' / ' + A.total, 320, 230, { size: 16, align: 'center', color: '#808080' });
        G.rect(220, 256, 200, 4, '#303030');
        G.rect(220, 256, Math.round(200 * (A.total ? A.loaded / A.total : 1)), 4, '#ffa040');
        return;
      }
      const blink = Math.floor(this.t * 2) % 2 === 0;
      G.text('DEVICE_FLOWER', 320, 190, { size: 32, align: 'center', color: '#ffd020' });
      if (blink) G.text('PRESS [Z] OR CLICK TO START', 320, 250, { size: 16, align: 'center' });
      G.text('(sound on!)', 320, 280, { size: 16, align: 'center', color: '#808080' });
    }
  }
  DF.BootScene = BootScene;

  // ---- Title ---------------------------------------------------------------------------
  class TitleScene {
    constructor() {
      this.t = 0;
      this.sel = 0;
      this.items = ['START', 'HOW TO PLAY', 'SETTINGS', 'CREDITS'];
      this.petals = new Petals(30);
      this.leaving = false;
      this.fade = 1;
      if (DF.Music.songKey !== 'title' || !DF.Music.playing) DF.Music.play('title');
    }
    update(dt) {
      this.t += dt;
      this.petals.update(dt);
      if (this.leaving) return;
      this.fade = Math.max(0, this.fade - dt * 2);
      if (Input.pressed('up')) {
        this.sel = (this.sel + this.items.length - 1) % this.items.length;
        Audio.play('ui_move');
      } else if (Input.pressed('down')) {
        this.sel = (this.sel + 1) % this.items.length;
        Audio.play('ui_move');
      }
      if (Input.pressed('confirm')) {
        Audio.play('ui_select');
        const it = this.items[this.sel];
        if (it === 'START') this.start();
        else if (it === 'HOW TO PLAY') DF.setScene(new HelpScene(this));
        else if (it === 'SETTINGS') DF.setScene(new SettingsScene(this));
        else if (it === 'CREDITS') DF.setScene(new CreditsScene(this));
      }
    }
    start() {
      this.leaving = true;
      DF.Music.stop(0.6);
      DF.fadeTo(() => new DF.Battle({}), 0.8);
    }
    draw() {
      const ctx = G.ctx;
      const g = ctx.createLinearGradient(0, 0, 0, 480);
      g.addColorStop(0, '#0c0418');
      g.addColorStop(0.6, '#34102e');
      g.addColorStop(1, '#7a2a36');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 640, 480);
      ctx.save();
      ctx.globalAlpha = 0.35;
      const off = (this.t * 15) % 50;
      for (let x = -50; x < 690; x += 50) for (let y = -50; y < 530; y += 50) G.draw('ui/bgtile', Math.round(x + off), Math.round(y + off), { scale: 1 });
      ctx.restore();
      this.petals.draw(0.6);
      // Flowery, cape flapping.
      G.draw(G.frameAt('flowery/idle', this.t, 8, true), 500, 400, { scale: 4, ox: 0.5, oy: 1 });
      drawLogo(60, this.t);
      G.text('A fan remake of the Flowery fight from DELTARUNE Chapter 5', 320, 136, { size: 16, align: 'center', color: '#e0c0e0' });
      this.items.forEach((it, i) => {
        const y = 230 + i * 40;
        G.text(it, 90, y, { size: 32, color: i === this.sel ? '#ffff00' : '#ffffff' });
        if (i === this.sel) menuHeart(64, y + 9);
      });
      G.text('[Z] Confirm   [X] Back   [ARROWS] Move   [M] Mute', 20, 440, { size: 16, color: '#b0a0b0' });
      G.text('Fan-made. Not affiliated with Toby Fox.', 20, 458, { size: 16, color: '#806880' });
      if (this.fade > 0) G.rect(0, 0, 640, 480, '#000', this.fade);
    }
  }
  DF.TitleScene = TitleScene;

  // ---- How to play ----------------------------------------------------------------------
  const HELP = [
    {
      title: 'THE BASICS',
      lines: [
        'Each turn, pick a command for everyone:',
        '[c:orange]FIGHT[/c]  [c:orange]ACT[/c]/[c:orange]MAGIC[/c]  [c:orange]ITEM[/c]  [c:orange]SPARE[/c]  [c:orange]DEFEND[/c]',
        '',
        "FLOWERY can't be beaten by FIGHTing.",
        "Raise his [c:yellow]MERCY[/c] with each phase's ACT.",
        'Z-ACTs (head icons) use the whole team.',
        'DEFEND softens hits and gives 16% TP.',
      ],
    },
    {
      title: 'THE ORANGE SOUL',
      lines: [
        'On enemy turns your SOUL is [c:orange]ORANGE[/c].',
        'It faces right and the board rushes past it.',
        '',
        '[c:yellow][UP]/[DOWN][/c]  move      [c:yellow][X][/c]  move slowly',
        '[c:yellow]Hold [Z][/c]  charge,  [c:yellow]let go[/c]  DASH',
        'Tap for a short hop, charge to go far.',
        'DASH breaks [c:blue]BLUE[/c] things and PARRIES.',
      ],
    },
    {
      title: 'PARRY & TP',
      lines: [
        'FLOWERY turns [c:blue]BLUE[/c] just before impact.',
        'DASH into him right then to PARRY.',
        'The later you dash, the more TP you get.',
        '',
        'Grazing bullets also builds TP.',
        'Some ACTs cost TP. JUSTICE needs [c:yellow]100%[/c]!',
        'Every attack leaves a way through!',
      ],
    },
  ];
  class HelpScene {
    constructor(back) {
      this.back = back;
      this.page = 0;
      this.t = 0;
      this.typers = null;
      this.build();
    }
    build() {
      this.typers = HELP[this.page].lines.map((l, i) => new DF.Typer(l, { x: 60, y: 120 + i * 34, width: 560, font: 'main', size: 32, speed: 400, voice: null, indent: false }));
      for (const t of this.typers) t.skip();
    }
    update(dt) {
      this.t += dt;
      this.back.petals.update(dt);
      if (Input.pressed('right') || Input.pressed('confirm')) {
        if (this.page < HELP.length - 1) {
          this.page++;
          this.build();
          Audio.play('ui_move');
        } else if (Input.pressed('confirm')) {
          Audio.play('ui_select');
          DF.setScene(this.back);
        }
      } else if (Input.pressed('left')) {
        if (this.page > 0) {
          this.page--;
          this.build();
          Audio.play('ui_move');
        }
      } else if (Input.pressed('cancel')) {
        Audio.play('ui_cancel');
        DF.setScene(this.back);
      }
    }
    draw() {
      G.rect(0, 0, 640, 480, '#0c0418');
      this.back.petals.draw(0.25);
      G.rect(30, 40, 580, 380, '#000000', 0.85);
      G.strokeRect(30, 40, 580, 380, '#ffffff', 2);
      G.text(HELP[this.page].title, 320, 58, { size: 32, align: 'center', color: '#ffd020' });
      for (const t of this.typers) t.draw();
      G.text('Page ' + (this.page + 1) + '/' + HELP.length + '   [LEFT]/[RIGHT] turn   [X] back', 320, 438, { size: 16, align: 'center', color: '#a090a0' });
      if (this.page === 1) {
        // Tiny demo: an orange SOUL dashing.
        const k = (this.t % 1.6) / 1.6;
        const dx = k < 0.3 ? (k / 0.3) * 80 : 80 * Math.max(0, 1 - (k - 0.3) / 0.4);
        G.draw('heart/heart', 470 + dx, 392, { scale: 2, ox: 0.5, oy: 0.5, rot: -Math.PI / 2, tint: '#ffa020' });
        G.draw('petal/blue_1', 560, 392, { scale: 2, ox: 0.5, oy: 0.5, alpha: k < 0.25 ? 1 : 0.2 });
      }
    }
  }

  // ---- Settings ---------------------------------------------------------------------------
  class SettingsScene {
    constructor(back) {
      this.back = back;
      this.sel = 0;
    }
    rows() {
      const s = DF.settings;
      return [
        { name: 'MUSIC', val: Math.round(s.music * 100) + '%', adj: (d) => (s.music = U.clamp(Math.round((s.music + d * 0.1) * 10) / 10, 0, 1)) },
        { name: 'SOUND', val: Math.round(s.sfx * 100) + '%', adj: (d) => (s.sfx = U.clamp(Math.round((s.sfx + d * 0.1) * 10) / 10, 0, 1)) },
        { name: 'SCREEN SHAKE', val: s.shake ? 'ON' : 'OFF', adj: () => (s.shake = !s.shake) },
        { name: 'TOUCH CONTROLS', val: s.touch.toUpperCase(), adj: (d) => (s.touch = ['auto', 'on', 'off'][(['auto', 'on', 'off'].indexOf(s.touch) + (d || 1) + 3) % 3]) },
        { name: 'BACK', val: '' },
      ];
    }
    update() {
      this.back.petals.update(DF.STEP);
      const rows = this.rows();
      if (Input.pressed('up')) {
        this.sel = (this.sel + rows.length - 1) % rows.length;
        Audio.play('ui_move');
      } else if (Input.pressed('down')) {
        this.sel = (this.sel + 1) % rows.length;
        Audio.play('ui_move');
      }
      const r = rows[this.sel];
      let d = 0;
      if (Input.pressed('left')) d = -1;
      if (Input.pressed('right')) d = 1;
      if (Input.pressed('confirm') && r.name !== 'BACK') d = r.name === 'MUSIC' || r.name === 'SOUND' ? 0 : 1;
      if (d && r.adj) {
        r.adj(d);
        DF.Audio.applyVolumes();
        DF.applyTouchSetting();
        DF.saveSettings();
        Audio.play('ui_select', { vol: 0.8 });
      }
      if ((Input.pressed('confirm') && r.name === 'BACK') || Input.pressed('cancel')) {
        Audio.play('ui_cancel');
        DF.setScene(this.back);
      }
    }
    draw() {
      G.rect(0, 0, 640, 480, '#0c0418');
      this.back.petals.draw(0.25);
      G.text('SETTINGS', 320, 60, { size: 32, align: 'center', color: '#ffd020' });
      this.rows().forEach((r, i) => {
        const y = 140 + i * 44;
        const on = i === this.sel;
        G.text(r.name, 110, y, { size: 32, color: on ? '#ffff00' : '#ffffff' });
        if (r.val) G.text(r.val, 530, y, { size: 32, align: 'right', color: on ? '#ffff00' : '#c0c0c0' });
        if (on) menuHeart(82, y + 9);
      });
      G.text('[LEFT]/[RIGHT] change   [X] back', 320, 420, { size: 16, align: 'center', color: '#a090a0' });
    }
  }

  // ---- Credits ------------------------------------------------------------------------------
  const CREDITS = [
    ['[c:yellow]DEVICE_FLOWER[/c]', 'A non-commercial fan remake of the Flowery fight'],
    ['', 'from DELTARUNE Chapter 5.'],
    ['[c:yellow]DELTARUNE[/c]', 'Toby Fox. All characters, sprites and voice'],
    ['', 'clips belong to their creators.'],
    ['[c:yellow]SPRITES & SFX[/c]', 'Ripped assets as shared by the fan projects'],
    ['', 'Kristal (KristalTeam), Featherfall (Potato)'],
    ['', 'and deltarun-episode-5 (Woganog).'],
    ['[c:yellow]FONTS[/c]', '8bitoperator JVE / Monospaced JVE by nipcen'],
    ['', '(CC BY-NC-SA).'],
    ['[c:yellow]MUSIC[/c]', '"Bloom Beat" - an original chiptune written for'],
    ['', 'this remake and synthesized live in your browser.'],
    ['[c:yellow]CODE[/c]', 'Plain JavaScript + Canvas + WebAudio.'],
  ];
  class CreditsScene {
    constructor(back) {
      this.back = back;
      this.lines = CREDITS.map(
        ([a, b], i) => [a ? new DF.Typer(a, { x: 40, y: 70 + i * 30, width: 200, font: 'main', size: 16, voice: null, indent: false }) : null, new DF.Typer(b, { x: 200, y: 70 + i * 30, width: 420, font: 'main', size: 16, voice: null, indent: false })]
      );
      for (const [a, b] of this.lines) {
        if (a) a.skip();
        b.skip();
      }
    }
    update() {
      this.back.petals.update(DF.STEP);
      if (Input.pressed('confirm') || Input.pressed('cancel')) {
        Audio.play('ui_cancel');
        DF.setScene(this.back);
      }
    }
    draw() {
      G.rect(0, 0, 640, 480, '#0c0418');
      this.back.petals.draw(0.25);
      G.text('CREDITS', 320, 24, { size: 32, align: 'center', color: '#ffd020' });
      for (const [a, b] of this.lines) {
        if (a) a.draw();
        b.draw();
      }
      G.text('[Z] back', 320, 440, { size: 16, align: 'center', color: '#a090a0' });
    }
  }

  // ---- Game over -----------------------------------------------------------------------------
  class GameOverScene {
    constructor(checkpoint, stats) {
      this.cp = checkpoint;
      this.stats = stats;
      this.t = 0;
      this.sel = 0;
      this.music = Audio.play('mus_defeat', { bus: 'music', vol: 0.9 });
      this.text = null;
    }
    update(dt) {
      this.t += dt;
      if (this.t > 2.2 && !this.text) {
        this.text = new DF.Typer("[spd:20]Kris...! Don't give up!\nThe Fountain is right there...", { x: 90, y: 250, width: 500, font: 'mono', size: 32, voice: 'voice_susie', indent: false });
      }
      if (this.text) this.text.update(dt);
      if (!this.text || !this.text.done) {
        if (this.text && Input.pressed('cancel')) this.text.skip();
        return;
      }
      if (Input.pressed('left') || Input.pressed('right')) {
        this.sel = 1 - this.sel;
        Audio.play('ui_move');
      }
      if (Input.pressed('confirm')) {
        Audio.play('ui_select');
        this.music.stop(0.5);
        if (this.sel === 0) {
          const cp = this.cp;
          DF.fadeTo(() => new DF.Battle({ phase: cp.phase, retry: true, items: cp.items, hints: cp.hints, fightLocked: cp.fightLocked, tp: cp.tp, stats: this.stats }), 0.6);
        } else DF.fadeTo(() => new TitleScene(), 0.6);
      }
    }
    draw() {
      G.rect(0, 0, 640, 480, '#000');
      const a = Math.min(1, this.t / 1.5);
      G.text('GAME OVER', 320, 90, { size: 64, align: 'center', color: '#ffffff', alpha: a });
      if (this.text) this.text.draw();
      if (this.text && this.text.done) {
        const opts = ['CONTINUE', 'GIVE UP'];
        opts.forEach((o, i) => {
          const x = 180 + i * 200;
          G.text(o, x, 380, { size: 32, color: i === this.sel ? '#ffff00' : '#ffffff' });
          if (i === this.sel) menuHeart(x - 26, 389);
        });
        G.text('(Continue restarts phase ' + this.cp.phase + ' of 6)', 320, 430, { size: 16, align: 'center', color: '#808080' });
      }
    }
  }
  DF.GameOverScene = GameOverScene;

  // ---- Ending ----------------------------------------------------------------------------------
  // Asgore and the Knight have no sprites here; they're drawn as silhouettes against the sunset.
  const FLOOR = 314;

  function drawAsgore(x, y, alpha) {
    if (alpha <= 0) return;
    const ctx = G.ctx;
    ctx.save();
    ctx.globalAlpha *= alpha;
    const dark = '#1a0c1c';
    const cape = new Path2D();
    cape.moveTo(x - 50, y);
    cape.lineTo(x - 38, y - 102);
    cape.quadraticCurveTo(x, y - 122, x + 38, y - 102);
    cape.lineTo(x + 52, y);
    cape.closePath();
    ctx.fillStyle = dark;
    ctx.fill(cape);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ff9a50';
    ctx.stroke(cape);
    G.circle(x, y - 128, 20, dark);
    // Horns.
    ctx.fillStyle = '#e8dcc0';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x + side * 12, y - 142);
      ctx.quadraticCurveTo(x + side * 30, y - 150, x + side * 26, y - 164);
      ctx.quadraticCurveTo(x + side * 20, y - 150, x + side * 6, y - 146);
      ctx.fill();
    }
    // Golden hair and beard catching the last of the sun.
    ctx.fillStyle = '#e8b848';
    ctx.beginPath();
    ctx.arc(x, y - 132, 19, Math.PI * 1.05, Math.PI * 1.95);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - 16, y - 124);
    ctx.quadraticCurveTo(x, y - 90, x + 16, y - 124);
    ctx.fill();
    G.rect(x - 9, y - 131, 4, 2, '#ffffff');
    G.rect(x + 5, y - 131, 4, 2, '#ffffff');
    ctx.restore();
  }

  function drawKnight(x, y, alpha, swing) {
    if (alpha <= 0) return;
    const ctx = G.ctx;
    ctx.save();
    ctx.globalAlpha *= alpha;
    const p = new Path2D();
    const pts = [[-20, 0], [-14, -50], [-32, -58], [-24, -70], [-30, -96], [-14, -104], [-12, -126], [0, -144], [12, -126], [14, -104], [30, -96], [26, -72], [32, -58], [16, -50], [22, 0], [6, 0], [0, -36], [-6, 0]];
    p.moveTo(x + pts[0][0], y + pts[0][1]);
    for (const [dx, dy] of pts) p.lineTo(x + dx, y + dy);
    p.closePath();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke(p);
    ctx.fillStyle = '#000000';
    ctx.fill(p);
    G.rect(x - 7, y - 121, 14, 2, '#ffffff');
    // The sword: raised, then brought down.
    const ang = -2.2 + swing * 2.6;
    const hx = x + 22;
    const hy = y - 70;
    const ex = hx + Math.cos(ang) * 86;
    const ey = hy + Math.sin(ang) * 86;
    G.line(hx, hy, ex, ey, '#000000', 9);
    G.line(hx, hy, ex, ey, '#ffffff', 5);
    ctx.restore();
  }

  // Two halves of a golden flower, lying in the grass.
  function drawGoldenFlower(x, y, alpha, glow) {
    if (alpha <= 0) return;
    const ctx = G.ctx;
    ctx.save();
    ctx.globalAlpha *= alpha;
    G.rect(x - 46, y - 4, 40, 3, '#3a8a2a');
    G.rect(x - 30, y - 8, 8, 4, '#5ab03a');
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(x + side * 9, y - 12 + (side > 0 ? 3 : 0));
      ctx.rotate(side * 0.3);
      ctx.beginPath();
      ctx.rect(side < 0 ? -30 : 1, -30, 29, 60);
      ctx.clip();
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
        G.circle(Math.cos(a) * 11, Math.sin(a) * 11, 10, '#a07010');
        G.circle(Math.cos(a) * 11, Math.sin(a) * 11, 8, '#ffd040');
      }
      G.circle(0, 0, 7, '#ff9a20');
      ctx.restore();
    }
    if (glow > 0) G.circle(x, y - 12, 30 + glow * 10, '#fff4b0', 0.25 * glow);
    ctx.restore();
  }

  function drawPinkTree(x, y, t) {
    const ctx = G.ctx;
    ctx.fillStyle = '#3a1a24';
    ctx.beginPath();
    ctx.moveTo(x - 16, y);
    ctx.quadraticCurveTo(x - 6, y - 70, x - 30, y - 140);
    ctx.lineTo(x - 18, y - 144);
    ctx.quadraticCurveTo(x + 6, y - 90, x + 10, y - 150);
    ctx.lineTo(x + 22, y - 146);
    ctx.quadraticCurveTo(x + 16, y - 70, x + 18, y);
    ctx.fill();
    let seed = 5;
    const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    for (let i = 0; i < 60; i++) {
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(rnd()) * 110;
      const bx = x + Math.cos(a) * r;
      const by = y - 170 + Math.sin(a) * r * 0.5 + Math.sin(t * 1.5 + i) * 1.5;
      const br = 9 + rnd() * 10;
      G.circle(bx + 2, by + 3, br, '#b8507e');
      G.circle(bx, by, br, rnd() < 0.5 ? '#ff9cc4' : '#f282b0');
      G.circle(bx - br * 0.3, by - br * 0.35, br * 0.35, '#ffd0e4');
    }
    for (let i = 0; i < 16; i++) {
      const px = x - 120 + ((i * 53 + t * 25) % 260);
      const py = y - 160 + ((i * 37 + t * 40) % 170);
      G.draw(G.frameAt('petal/spin', t + i, 8, true), px, py, { scale: 2, ox: 0.5, oy: 0.5, alpha: 0.8 });
    }
  }

  // A little flower each of the six Flowers turns back into.
  function drawBud(x, y, color) {
    G.rect(x - 1, y - 12, 2, 12, '#3a8a2a');
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      G.circle(x + Math.cos(a) * 5, y - 16 + Math.sin(a) * 5, 4, color);
    }
    G.circle(x, y - 16, 3, '#fff4a0');
  }

  class EndingScene {
    constructor(stats) {
      this.stats = stats;
      this.t = 0;
      this.scripts = new DF.ScriptPool();
      this.fx = new DF.FX();
      this.box = null;
      this.face = null;
      this.showEnd = false;
      this.white = 1;
      this.dark = 0;
      this.shot = 'roof';
      this.f1 = { grow: 1, white: 0 };
      this.f2 = { x: 548, base: FLOOR + 2, grow: 0, white: 0, size: 0.7 };
      this.actors = {
        kris: { f: 'kplat/crouch_1', x: 214, y: FLOOR, flip: false, alpha: 1 },
        susie: { f: 'splat/idle', x: 152, y: FLOOR, flip: false, alpha: 1 },
        ralsei: { f: 'rplat/splat_1', x: 88, y: FLOOR + 2, flip: false, alpha: 1 },
        flowery: { f: 'flowery/crouch_1', x: 440, y: FLOOR, flip: true, alpha: 1, rot: 0, fill: null },
      };
      this.asgore = { x: 720, y: FLOOR, alpha: 0 };
      this.knight = { x: 548, y: FLOOR, alpha: 0, swing: 0 };
      this.gang = null;
      this.flower = { alpha: 1, glow: 0 };
      this.petals = new Petals(18);
      this.scripts.run(this.flow());
    }
    *say(pages, face) {
      for (const p of pages) {
        this.face = face || null;
        this.box = new DF.Typer(p, { x: face ? 142 : 30, y: 368, width: face ? 480 : 580, font: 'mono', size: 32, lineH: 32, speed: 34, voice: 'voice_default' });
        for (;;) {
          yield null;
          if (!this.box.done) {
            if (Input.pressed('cancel')) this.box.skip();
            continue;
          }
          if (Input.pressed('confirm')) break;
        }
      }
      this.box = null;
      this.face = null;
    }
    *walk(actor, x, frames, speed) {
      const from = actor.f;
      actor.f = frames;
      actor.flip = x < actor.x;
      yield* DF.tween(actor, { x }, Math.abs(x - actor.x) / (speed || 160));
      actor.f = from;
    }
    *flow() {
      const A = this.actors;
      yield* DF.tween(this, { white: 0 }, 1.2);
      yield 0.5;
      yield* this.say(['* The rainbow light drains out of FLOWERY.']);
      Audio.voice('vc_hah');
      yield* this.say(['* Hah... hah...\n* Nice moves, Kris...!'], 'face/flowery_30');
      A.flowery.f = 'flowery/stand_1';
      A.flowery.flip = false;
      Audio.play('bump', { vol: 0.6 });
      yield 0.4;
      Audio.voice('vc_kris');
      yield* this.say(["* Get up, Kris! Get UP!\n* We're not done yet!"], 'face/flowery_23');
      yield* this.say(["* I promised your dad I'd\n  keep that Fountain open!\n* And I keep my promises!"], 'face/flowery_24');
      // Asgore.
      yield* this.say(['* ...Flowery.']);
      yield* DF.tween(this.asgore, { x: 578, alpha: 1 }, 1.4, 'outQuad');
      A.flowery.flip = true;
      Audio.voice('vc_my_king');
      yield* this.say(['* ...My king?'], 'face/flowery_21');
      yield* this.say(["* Asgore: That's enough, old\n  friend. Look at them.\n* They're only children."]);
      yield* this.say(['* But... I only wanted to\n  help you...', "* I didn't want anybody\n  to be sad..."], 'face/flowery_33');
      yield* this.say(['* Asgore: I know. You always\n  have. Now let them finish\n  what they came to do.']);
      // The Flowers let go of their borrowed colors.
      this.gang = { alpha: 0, k: 0 };
      Audio.play('sparkle', { vol: 0.7 });
      yield* DF.tween(this.gang, { alpha: 1 }, 0.6);
      yield* this.say(["* The six Flowers' borrowed colors fade..."]);
      Audio.play('petaldrain', { vol: 0.6 });
      for (const sp of GANG_SPOTS) this.fx.sparkles(sp[0], sp[1] - 20, 6, '#ffffff', 90);
      yield* DF.tween(this.gang, { k: 1 }, 0.8);
      yield* this.say(['* ...and they settle onto the roof as\n  ordinary flowers once more.']);
      // Kris seals the Fountain.
      A.kris.f = 'kplat/idle';
      yield 0.3;
      yield* this.walk(A.kris, 300, 'kplat/run', 150);
      A.kris.f = 'kplat/pose_1';
      yield* this.say(['* Kris faces the Fountain.']);
      Audio.play('bell', { vol: 0.8 });
      Audio.play('sparkle_gem', { vol: 0.7 });
      yield* DF.tween(this.f1, { white: 1 }, 0.9);
      this.fx.screenFlash('#ffffff', 0.8, 1.5);
      yield* DF.tween(this.f1, { grow: 0 }, 1.1, 'inCubic');
      Audio.play('levelup', { vol: 0.6 });
      yield* this.say(['* The Fountain was sealed!']);
      // ...and another one tears open.
      Audio.play('screenshake', { vol: 0.8 });
      Audio.play('ominous', { vol: 0.8 });
      this.fx.screenShake(10);
      yield* DF.tween(this.f2, { grow: 1 }, 1.3, 'outCubic');
      A.ralsei.f = 'rplat/idle';
      A.ralsei.y = FLOOR;
      A.kris.f = 'kplat/idle';
      A.kris.flip = false;
      yield* this.say(["[v:voice_susie]* Susie: What the-!? ANOTHER one!?", '[v:voice_ralsei]* Ralsei: (Ow...) Wh-what happened!?']);
      // The Knight.
      Audio.play('ominous', { vol: 0.9 });
      yield* DF.tween(this.knight, { alpha: 1, x: 520 }, 1.0);
      yield* this.say(['* A figure of pure darkness steps out.']);
      Audio.play('grab', { vol: 0.9 });
      yield* DF.tween(this.knight, { x: 572 }, 0.25, 'inQuad');
      this.fx.screenShake(6);
      yield* DF.all(DF.tween(this.knight, { x: 548, alpha: 0 }, 0.8, 'inQuad'), DF.tween(this.asgore, { x: 552, alpha: 0 }, 0.8, 'inQuad'));
      yield* this.say(['* THE KNIGHT dragged ASGORE into the\n  Fountain!']);
      // Flowery goes after them.
      Audio.voice('vc_my_king', { vol: 1 });
      yield* this.walk(A.flowery, 500, 'flowery/run', 260);
      A.flowery.f = 'flowery/stand_1';
      A.flowery.flip = false;
      yield* this.say(['* MY KING!!'], 'face/flowery_22');
      this.knight.x = 560;
      Audio.play('ominous', { vol: 0.9 });
      yield* DF.tween(this.knight, { alpha: 1 }, 0.4);
      DF.Music.play('battle', { section: 'chorus3' });
      yield* this.say(['* Let him GO!\n* You want the king?\n  Go through ME!'], 'face/flowery_22');
      yield* this.say(['* All my power!\n* FLOWER POWER...\n  NINE-NINE-NINE!!'], 'face/flowery_17');
      A.flowery.f = 'flowery/poweringup';
      A.flowery.fill = 'rainbow';
      Audio.voice('fl_omega');
      Audio.play('omegarona', { vol: 0.8 });
      for (let i = 0; i < 4; i++) {
        this.fx.petalBurst(520, FLOOR - 70, 12, U.RAINBOW);
        this.fx.shockRing(540, FLOOR - 70, U.RAINBOW[i * 2], 90, 0.4);
        yield 0.25;
      }
      this.fx.screenFlash('#ffffff', 0.6, 3);
      A.flowery.fill = null;
      A.flowery.f = 'flowery/stand_1';
      yield* this.say(['* ...THE KNIGHT did not even flinch.']);
      // One stroke.
      yield* DF.tween(this.knight, { swing: 1 }, 0.12, 'inQuad');
      Audio.play('criticalswing', { vol: 1 });
      Audio.play('scytheburst', { vol: 0.9 });
      this.fx.screenFlash('#ffffff', 1, 1.2);
      this.fx.screenShake(14);
      DF.Music.stop(0.6);
      A.flowery.f = 'flowery/jumpdown_1';
      yield* DF.tween(A.flowery, { x: 380, y: FLOOR - 40, rot: -2 }, 0.5, 'outQuad');
      Audio.voice('vc_im_falling');
      yield* DF.tween(this, { white: 1 }, 0.8);
      // Under the pink tree.
      this.shot = 'tree';
      this.knight.alpha = 0;
      A.kris.x = -60;
      A.kris.flip = false;
      A.susie.x = -120;
      A.susie.flip = false;
      A.ralsei.x = -170;
      A.ralsei.flip = false;
      yield 0.8;
      yield* DF.tween(this, { white: 0 }, 1.6);
      yield* this.say(['* When the light cleared...', '* ...a golden flower lay under the\n  pink tree. Torn clean in half.']);
      yield* DF.all(this.walk(A.kris, 330, 'kplat/run', 240), this.walk(A.susie, 272, 'splat/run', 240), this.walk(A.ralsei, 222, 'rplat/run', 240));
      A.kris.f = 'kplat/crouch_1';
      yield* this.say(['[v:voice_susie]* Susie: Flowery...!?']);
      Audio.voice('vc_hah');
      yield* this.say(["* Heh... heh... Hey, Kris.\n* Don't make that face."], 'face/flowery_35');
      yield* this.say(['* Wanna hear a secret?\n* I was holding back.\n  The whole time.'], 'face/flowery_34');
      yield* this.say(["* Couldn't hurt my best\n  friend's kid, right?\n* Some hero I'd be..."], 'face/flowery_29');
      yield* this.say(['* Go bring your dad home,\n  Kris.\n* With style, okay...?'], 'face/flowery_30');
      Audio.voice('vc_goodbye');
      yield* DF.tween(this.flower, { glow: 1 }, 0.8);
      for (let i = 0; i < 3; i++) {
        this.fx.petalBurst(430, FLOOR - 14, 8, ['#ffd040', '#fff4b0']);
        yield 0.3;
      }
      yield* DF.tween(this.flower, { alpha: 0.35, glow: 0 }, 1.2);
      yield* this.say(['* ...']);
      yield* DF.tween(this, { white: 1 }, 0.8);
      // Back on the roof, the second Fountain still gapes.
      this.shot = 'roof';
      this.gang = null;
      A.flowery.alpha = 0;
      A.kris.x = 360;
      A.kris.f = 'kplat/pose_1';
      A.susie.x = 280;
      A.susie.f = 'splat/idle';
      A.ralsei.x = 230;
      A.ralsei.f = 'rplat/idle';
      yield* DF.tween(this, { white: 0 }, 1.0);
      yield* this.say(['* THE KNIGHT was gone. So was ASGORE.', '* Kris sealed the second Fountain.']);
      Audio.play('bell', { vol: 0.8 });
      yield* DF.tween(this.f2, { white: 1 }, 0.8);
      this.fx.screenFlash('#ffffff', 0.7, 1.5);
      yield* DF.tween(this.f2, { grow: 0 }, 1.0, 'inCubic');
      yield 1.2;
      DF.Music.play('ending');
      this.showEnd = true;
      this.endT = 0;
    }
    update(dt) {
      this.t += dt;
      this.petals.update(dt);
      this.fx.update(dt);
      this.scripts.update(dt);
      if (this.box) this.box.update(dt);
      if (this.showEnd) {
        this.endT += dt;
        if (this.endT > 3 && Input.pressed('confirm')) {
          Audio.play('ui_select');
          DF.Music.stop(1);
          DF.fadeTo(() => new TitleScene(), 1);
        }
      }
    }
    frameOf(a) {
      if (G.has(a.f)) return a.f;
      const fps = a.f.indexOf('run') >= 0 ? 12 : 6;
      return G.frameAt(a.f, this.t, fps, true);
    }
    drawActor(a) {
      if (a.alpha <= 0) return;
      const f = this.frameOf(a);
      DF.drawAt(f, a.x, a.y, { flip: a.flip, alpha: a.alpha, rot: a.rot || 0, fill: a.fill === 'rainbow' ? U.rainbow() : a.fill, fillAmt: a.fill ? 0.5 : 0 });
    }
    draw() {
      const ctx = G.ctx;
      const shake = this.fx.offset();
      ctx.save();
      ctx.translate(shake.x, shake.y);
      const A = this.actors;
      if (this.shot === 'tree') {
        DF.BattleView.rooftop(this.t, { dusk: 1, fountain: null });
        G.rect(0, 0, 640, 480, '#140820', 0.35);
        drawPinkTree(470, FLOOR + 6, this.t);
        drawGoldenFlower(430, FLOOR, this.flower.alpha, this.flower.glow);
        for (const a of [A.ralsei, A.susie, A.kris]) this.drawActor(a);
      } else {
        DF.BattleView.rooftop(this.t, { dusk: 1, fountain: this.f1.grow > 0 ? this.f1 : null, front: this.f2.grow > 0 ? [this.f2] : [] });
        if (this.gang) {
          const ids = ['aqua', 'seth', 'orange', 'green', 'yellow', 'blue'];
          ids.forEach((id, i) => {
            const [x, y] = GANG_SPOTS[i];
            if (this.gang.k < 1) G.draw(G.frameAt('gang/' + id, this.t, DF.GANG[id].fps, true), x, y, { scale: 1, ox: 0.5, oy: 1, alpha: this.gang.alpha * (1 - this.gang.k) });
            if (this.gang.k > 0) {
              ctx.save();
              ctx.globalAlpha = this.gang.k;
              drawBud(x, y, DF.GANG[id].color);
              ctx.restore();
            }
          });
        }
        drawAsgore(this.asgore.x, this.asgore.y, this.asgore.alpha);
        drawKnight(this.knight.x, this.knight.y, this.knight.alpha, this.knight.swing);
        for (const a of [A.ralsei, A.susie, A.kris, A.flowery]) this.drawActor(a);
      }
      this.fx.draw('back');
      this.fx.draw('mid');
      this.fx.draw('top');
      ctx.restore();
      this.fx.drawFlash();
      if (this.box) {
        G.rect(16, 350, 608, 118, '#000');
        G.strokeRect(16, 350, 608, 118, '#ffffff', 3);
        if (this.face) G.draw(this.face, 32, 362, { scale: 2 });
        this.box.draw();
      }
      if (this.showEnd) {
        const a = Math.min(1, this.endT / 1.5);
        G.rect(0, 0, 640, 480, '#000', a * 0.9);
        this.petals.draw(0.5 * a);
        drawLogo(50, this.t);
        G.text('THE END', 320, 130, { size: 32, align: 'center', color: '#ffffff', alpha: a });
        const s = this.stats;
        const rows = [
          ['TIME', U.fmtTime(s.time)],
          ['TURNS', s.turns],
          ['PARRIES', s.parries + '  (' + s.perfects + ' perfect)'],
          ['BLUE THINGS BROKEN', s.breaks],
          ['HITS TAKEN', s.hits],
          ['TP GAINED', Math.round(s.tpGained) + '%'],
          ['CONTINUES', s.retries],
        ];
        rows.forEach(([k, v], i) => {
          G.text(k, 150, 190 + i * 28, { size: 16, color: '#ffd020', alpha: a });
          G.text(String(v), 490, 190 + i * 28, { size: 16, align: 'right', color: '#ffffff', alpha: a });
        });
        if (this.endT > 3) G.text('Thanks for playing!  [Z] Title', 320, 420, { size: 16, align: 'center', color: Math.floor(this.t * 2) % 2 ? '#ffffff' : '#ffff80' });
      }
      if (this.white > 0) G.rect(0, 0, 640, 480, '#ffffff', this.white);
    }
  }
  const GANG_SPOTS = [[330, 262], [372, 250], [396, 270], [486, 252], [508, 270], [352, 236]];
  DF.EndingScene = EndingScene;
})();
