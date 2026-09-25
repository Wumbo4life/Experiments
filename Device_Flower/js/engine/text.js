/*
 * Device_Flower - typewriter text with light markup, and speech bubbles.
 *
 * Markup: [c:yellow] / [c:#ff0] ... [/c]   colour
 *         [w:0.4]                         pause (seconds)
 *         [spd:40]                        characters per second
 *         [v:voice_susie]                 blip sound
 *         [i]                             show the rest instantly
 *         [shake]...[/shake]              wobbly letters
 */
(function () {
  'use strict';
  const DF = window.DF;
  const G = DF.G;

  const COLORS = {
    white: '#ffffff',
    yellow: '#ffff00',
    red: '#ff2020',
    blue: '#00a2e8',
    cyan: '#00ffff',
    green: '#00c000',
    lime: '#80ff80',
    orange: '#ffa040',
    purple: '#c060ff',
    pink: '#ff80ff',
    gray: '#808080',
    black: '#000000',
    gold: '#ffd020',
  };
  DF.COLORS = COLORS;

  function parse(text) {
    const out = [];
    let color = null;
    let shake = false;
    const re = /\[(\/?)(c|w|spd|v|i|shake)(?::([^\]]*))?\]/g;
    let last = 0;
    let m;
    const pushChars = (s) => {
      for (const ch of s) out.push({ ch, color, shake });
    };
    while ((m = re.exec(text))) {
      pushChars(text.slice(last, m.index));
      last = re.lastIndex;
      const close = m[1] === '/';
      const tag = m[2];
      const arg = m[3];
      if (tag === 'c') color = close ? null : COLORS[arg] || arg;
      else if (tag === 'shake') shake = !close;
      else if (tag === 'w') out.push({ wait: parseFloat(arg) || 0.2 });
      else if (tag === 'spd') out.push({ speed: parseFloat(arg) || 30 });
      else if (tag === 'v') out.push({ voice: arg || null });
      else if (tag === 'i') out.push({ instant: true });
    }
    pushChars(text.slice(last));
    return out;
  }
  DF.stripMarkup = (t) => t.replace(/\[(\/?)(c|w|spd|v|i|shake)(?::([^\]]*))?\]/g, '');

  class Typer {
    /*
     * opts: { x, y, width, font ('main'|'mono'|'bitmap:plain'), size, lineH, speed, voice,
     *         color, indent, align }
     */
    constructor(text, opts) {
      this.o = Object.assign(
        { x: 0, y: 0, width: 580, font: 'mono', size: 32, lineH: 32, speed: 32, voice: 'voice_default', color: '#fff', indent: true },
        opts || {}
      );
      this.bitmap = this.o.font.startsWith('bitmap:') ? this.o.font.slice(7) : null;
      this.tokens = parse(text);
      this.layout();
      this.shown = 0; // number of tokens consumed
      this.acc = 0;
      this.wait = 0;
      this.speed = this.o.speed;
      this.voice = this.o.voice;
      this.instant = false;
      this.blipT = 0;
      this.done = this.tokens.length === 0;
      this.time = 0;
    }
    charW(ch) {
      if (this.bitmap) return G.bitmapWidth(this.bitmap, ch) * (this.o.scale || 1);
      return G.textWidth(ch, this.o.font, this.o.size);
    }
    layout() {
      // Assign x/y to each character token, wrapping at word boundaries.
      const toks = this.tokens;
      const maxW = this.o.width;
      let x = 0;
      let line = 0;
      let lineStartIndent = 0;
      let paraStart = true;
      const indentW = this.o.indent ? this.charW('*') + this.charW(' ') : 0;
      let i = 0;
      while (i < toks.length) {
        const t = toks[i];
        if (t.ch === undefined) {
          i++;
          continue;
        }
        if (t.ch === '\n') {
          t.x = x;
          t.line = line;
          line++;
          x = 0;
          lineStartIndent = 0;
          paraStart = true;
          i++;
          continue;
        }
        if (paraStart) {
          // Hanging indent when the paragraph starts with "* ".
          const next = toks.slice(i, i + 2).map((q) => q.ch).join('');
          lineStartIndent = this.o.indent && next === '* ' ? indentW : 0;
          paraStart = false;
        }
        // Measure the word starting here.
        if (t.ch !== ' ') {
          let j = i;
          let w = 0;
          while (j < toks.length && toks[j].ch !== ' ' && toks[j].ch !== '\n') {
            if (toks[j].ch !== undefined) w += this.charW(toks[j].ch);
            j++;
          }
          if (x > lineStartIndent && x + w > maxW) {
            line++;
            x = lineStartIndent;
          }
        }
        t.x = x;
        t.line = line;
        x += this.charW(t.ch);
        i++;
      }
      this.lines = line + 1;
    }
    skip() {
      this.shown = this.tokens.length;
      this.done = true;
    }
    update(dt) {
      this.time += dt;
      if (this.done) return;
      if (this.wait > 0) {
        this.wait -= dt;
        return;
      }
      this.acc += dt * this.speed;
      this.blipT -= dt;
      let budget = this.instant ? 1e9 : Math.floor(this.acc);
      this.acc -= Math.floor(this.acc);
      let blipped = false;
      while (this.shown < this.tokens.length) {
        const t = this.tokens[this.shown];
        if (t.wait !== undefined) {
          this.shown++;
          if (!this.instant) {
            this.wait = t.wait;
            break;
          }
          continue;
        }
        if (t.speed !== undefined) {
          this.speed = t.speed;
          this.shown++;
          continue;
        }
        if (t.voice !== undefined) {
          this.voice = t.voice;
          this.shown++;
          continue;
        }
        if (t.instant) {
          this.instant = true;
          budget = 1e9;
          this.shown++;
          continue;
        }
        if (budget <= 0) break;
        this.shown++;
        if (t.ch !== ' ' && t.ch !== '\n') {
          budget--;
          if (!blipped && this.voice && this.blipT <= 0 && !this.instant && /[A-Za-z0-9]/.test(t.ch)) {
            DF.Audio.play(this.voice, { vol: 0.55 });
            this.blipT = 0.055;
            blipped = true;
          }
        }
      }
      if (this.shown >= this.tokens.length) this.done = true;
    }
    draw(ox, oy, alpha) {
      const o = this.o;
      const x0 = (ox !== undefined ? ox : o.x);
      const y0 = (oy !== undefined ? oy : o.y);
      for (let i = 0; i < this.shown; i++) {
        const t = this.tokens[i];
        if (t.ch === undefined || t.ch === ' ' || t.ch === '\n') continue;
        let dx = 0;
        let dy = 0;
        if (t.shake) {
          dx = Math.round(Math.sin(this.time * 40 + i * 1.7));
          dy = Math.round(Math.cos(this.time * 33 + i * 2.3));
        }
        const color = t.color || o.color;
        if (this.bitmap) {
          G.bitmapText(this.bitmap, t.ch, x0 + t.x + dx, y0 + t.line * o.lineH + dy, { color, fill: true, scale: o.scale || 1, alpha });
        } else {
          G.text(t.ch, x0 + t.x + dx, y0 + t.line * o.lineH + dy, { font: o.font, size: o.size, color, alpha });
        }
      }
    }
    // Width of the widest laid-out line (for sizing bubbles).
    measure() {
      let w = 0;
      for (const t of this.tokens) if (t.ch !== undefined && t.ch !== '\n') w = Math.max(w, t.x + this.charW(t.ch));
      return { w, h: this.lines * this.o.lineH };
    }
  }
  DF.Typer = Typer;

  /*
   * Speech bubble anchored at (ax, ay) = the tip of the tail.
   * side: 'left' (bubble sits left of the speaker, tail points right) or 'right' / 'up'.
   */
  class Bubble {
    constructor(text, ax, ay, opts) {
      this.o = Object.assign({ side: 'left', width: 190, voice: 'voice_default', speed: 40 }, opts || {});
      this.typer = new Typer(text, { font: 'bitmap:plain', width: this.o.width, lineH: 18, color: '#000', speed: this.o.speed, voice: this.o.voice, indent: false });
      const m = this.typer.measure();
      this.w = Math.max(40, Math.ceil(m.w) + 20);
      this.h = m.h + 14;
      this.ax = ax;
      this.ay = ay;
      this.t = 0;
    }
    get done() {
      return this.typer.done;
    }
    update(dt) {
      this.t += dt;
      this.typer.update(dt);
    }
    skip() {
      this.typer.skip();
    }
    rect() {
      const o = this.o;
      if (o.side === 'left') return { x: Math.round(this.ax - 14 - this.w), y: Math.round(this.ay - this.h / 2) };
      if (o.side === 'right') return { x: Math.round(this.ax + 14), y: Math.round(this.ay - this.h / 2) };
      return { x: Math.round(this.ax - this.w / 2), y: Math.round(this.ay - 14 - this.h) };
    }
    draw() {
      const ctx = G.ctx;
      const r = this.rect();
      const pop = Math.min(1, this.t * 10);
      ctx.save();
      ctx.globalAlpha *= pop;
      ctx.fillStyle = '#fff';
      roundRect(ctx, r.x, r.y, this.w, this.h, 8);
      ctx.fill();
      ctx.beginPath();
      if (this.o.side === 'left') {
        ctx.moveTo(r.x + this.w - 1, this.ay - 6);
        ctx.lineTo(this.ax, this.ay);
        ctx.lineTo(r.x + this.w - 1, this.ay + 5);
      } else if (this.o.side === 'right') {
        ctx.moveTo(r.x + 1, this.ay - 6);
        ctx.lineTo(this.ax, this.ay);
        ctx.lineTo(r.x + 1, this.ay + 5);
      } else {
        ctx.moveTo(this.ax - 6, r.y + this.h - 1);
        ctx.lineTo(this.ax, this.ay);
        ctx.lineTo(this.ax + 6, r.y + this.h - 1);
      }
      ctx.fill();
      ctx.restore();
      this.typer.draw(r.x + 10, r.y + 7, pop);
    }
  }
  DF.Bubble = Bubble;

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
  DF.roundRect = roundRect;
})();
