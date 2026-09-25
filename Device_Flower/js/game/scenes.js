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
        'Each turn, pick a command for every party member:',
        '[c:orange]FIGHT[/c]  [c:orange]ACT[/c]/[c:orange]MAGIC[/c]  [c:orange]ITEM[/c]  [c:orange]SPARE[/c]  [c:orange]DEFEND[/c]',
        '',
        "FLOWERY can't be beaten by FIGHTing.",
        'Raise his [c:yellow]MERCY[/c] with the right ACT each phase.',
        'Z-ACTs (with the head icons) use the whole team.',
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
        '[c:yellow][Z][/c]  DASH forward',
        '',
        'Dashing breaks [c:blue]BLUE[/c] things and PARRIES charges.',
      ],
    },
    {
      title: 'PARRY & TP',
      lines: [
        'When FLOWERY charges he turns [c:blue]BLUE[/c] just before',
        'impact. DASH into him right then to PARRY.',
        'Later = better: PERFECT parries give the most TP.',
        '',
        'Grazing bullets also builds TP.',
        'Some ACTs cost TP. JUSTICE needs [c:yellow]100%[/c]!',
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
        G.draw('heart/heart', 470 + dx, 360, { scale: 2, ox: 0.5, oy: 0.5, rot: -Math.PI / 2, tint: '#ffa020' });
        G.draw('petal/blue_1', 560, 360, { scale: 2, ox: 0.5, oy: 0.5, alpha: k < 0.25 ? 1 : 0.2 });
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
    ['[c:yellow]SPRITES & SFX[/c]', 'Ripped assets as shared by the fan engines'],
    ['', 'Kristal (KristalTeam) and Featherfall (Potato).'],
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
  class EndingScene {
    constructor(stats) {
      this.stats = stats;
      this.t = 0;
      this.scripts = new DF.ScriptPool();
      this.box = null;
      this.face = null;
      this.showEnd = false;
      this.white = 1;
      this.petals = new Petals(18);
      this.fl = { frame: 'flowery/crouch_1', x: 420, y: 330 };
      this.kris = { frame: 'kplat/idle_1', x: 220, y: 330 };
      this.scripts.run(this.flow());
    }
    *say(pages, face) {
      for (const p of pages) {
        this.face = face;
        this.box = new DF.Typer(p, { x: face ? 142 : 30, y: 368, width: face ? 480 : 580, font: 'mono', size: 32, lineH: 32, speed: 34, voice: face ? 'voice_default' : 'voice_default' });
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
    *flow() {
      yield* DF.tween(this, { white: 0 }, 1.2);
      yield 0.6;
      yield* this.say(['* The Omega light fades.', '* FLOWERY sways at the very top of the beanstalk.']);
      Audio.voice('vc_hah');
      yield* this.say(['* Hah... hah...\n* That was... some great style, Kris.'], 'face/flowery_30');
      yield* this.say(["* But... I can't give up!\n* Not while your dad's counting on me!"], 'face/flowery_26');
      yield* this.say(['* Get up! Come on! Round th-'], 'face/flowery_22');
      yield* this.say(['* ...A deep, gentle voice calls from below.']);
      Audio.voice('vc_my_king');
      this.fl.frame = 'flowery/stand_1';
      yield* this.say(['* ...My king?'], 'face/flowery_21');
      yield 0.6;
      DF.Music.play('ending');
      this.showEnd = true;
      this.endT = 0;
    }
    update(dt) {
      this.t += dt;
      this.petals.update(dt);
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
    draw() {
      const ctx = G.ctx;
      const g = ctx.createLinearGradient(0, 0, 0, 480);
      g.addColorStop(0, '#2a4a8a');
      g.addColorStop(0.7, '#e8a060');
      g.addColorStop(1, '#ffd890');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 640, 480);
      this.petals.draw(0.8);
      G.rect(0, 330, 640, 150, '#2e6a22');
      G.rect(0, 330, 640, 6, '#6ad04a');
      G.draw(this.fl.frame, this.fl.x, this.fl.y, { scale: 2, ox: 0.5, oy: 1, flip: this.fl.frame === 'flowery/crouch_1' });
      G.draw(this.kris.frame, this.kris.x, this.kris.y, { scale: 2, ox: 0.5, oy: 1 });
      if (this.box) {
        G.rect(16, 350, 608, 118, '#000');
        G.strokeRect(16, 350, 608, 118, '#ffffff', 3);
        if (this.face) G.draw(this.face, 32, 362, { scale: 2 });
        this.box.draw();
      }
      if (this.showEnd) {
        const a = Math.min(1, this.endT / 1.5);
        G.rect(0, 0, 640, 480, '#000', a * 0.9);
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
  DF.EndingScene = EndingScene;
})();
