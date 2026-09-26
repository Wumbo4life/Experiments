/* Device_Flower - core helpers: math, easing, and a tiny generator-based script runner. */
(function () {
  'use strict';
  const DF = (window.DF = window.DF || {});

  DF.W = 640;
  DF.H = 480;
  DF.STEP = 1 / 60;
  DF.time = 0; // seconds of game time since boot

  const U = (DF.U = {
    clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
    lerp: (a, b, t) => a + (b - a) * t,
    approach: (v, target, amt) => (v < target ? Math.min(v + amt, target) : Math.max(v - amt, target)),
    rand: (a, b) => a + Math.random() * (b - a),
    randInt: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
    choose: (arr) => arr[Math.floor(Math.random() * arr.length)],
    chance: (p) => Math.random() < p,
    dist: (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1),
    angle: (x1, y1, x2, y2) => Math.atan2(y2 - y1, x2 - x1),
    sign: (v) => (v > 0 ? 1 : v < 0 ? -1 : 0),
    shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
    rgba(r, g, b, a) {
      return 'rgba(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ',' + (a === undefined ? 1 : a) + ')';
    },
    hsl(h, s, l, a) {
      return 'hsla(' + (((h % 360) + 360) % 360).toFixed(1) + ',' + s + '%,' + l + '%,' + (a === undefined ? 1 : a) + ')';
    },
    // The colour cycle Flowery uses when he goes OMEGA.
    RAINBOW: ['#ff0000', '#00b1ff', '#00ffff', '#38e6ff', '#fff500', '#ee5ce3', '#ff00f2'],
    rainbow(offset) {
      const i = Math.floor((DF.time * 30 + (offset || 0)) / 2) % U.RAINBOW.length;
      return U.RAINBOW[(i + U.RAINBOW.length) % U.RAINBOW.length];
    },
    // Circle vs. axis-aligned rectangle.
    circleRect(cx, cy, r, x, y, w, h) {
      const nx = U.clamp(cx, x, x + w);
      const ny = U.clamp(cy, y, y + h);
      const dx = cx - nx;
      const dy = cy - ny;
      return dx * dx + dy * dy < r * r;
    },
    // Distance-squared from a point to a segment.
    segDist2(px, py, x1, y1, x2, y2) {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const l2 = dx * dx + dy * dy || 1;
      const t = U.clamp(((px - x1) * dx + (py - y1) * dy) / l2, 0, 1);
      const ex = x1 + dx * t - px;
      const ey = y1 + dy * t - py;
      return ex * ex + ey * ey;
    },
    fmtTime(sec) {
      const m = Math.floor(sec / 60);
      const s = Math.floor(sec % 60);
      return m + ':' + (s < 10 ? '0' : '') + s;
    },
  });

  U.ease = {
    linear: (t) => t,
    inQuad: (t) => t * t,
    outQuad: (t) => 1 - (1 - t) * (1 - t),
    inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
    inCubic: (t) => t * t * t,
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
    outBack: (t) => {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    },
    outElastic: (t) => {
      if (t === 0 || t === 1) return t;
      return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
    },
  };

  /*
   * Script: runs a generator function step by step. Inside a script, `yield`:
   *   a number      -> wait that many seconds
   *   null          -> wait one step (the next() call receives dt)
   *   a function    -> wait until it returns truthy
   *   a generator   -> run it to completion (its return value is sent back)
   *   a Script      -> wait until that script is done
   */
  class Script {
    constructor(gen, name) {
      this.stack = [gen];
      this.wait = 0;
      this.cond = null;
      this.sub = null;
      this.done = false;
      this.name = name || '';
      this.sendValue = undefined;
    }
    stop() {
      this.done = true;
      this.stack.length = 0;
    }
    update(dt) {
      if (this.done) return;
      if (this.wait > 0) {
        this.wait -= dt;
        if (this.wait > 0) return;
      }
      if (this.cond) {
        if (!this.cond()) return;
        this.cond = null;
      }
      if (this.sub) {
        if (!this.sub.done) return;
        this.sub = null;
      }
      let guard = 0;
      while (this.stack.length) {
        if (++guard > 5000) throw new Error('Script "' + this.name + '" is looping without yielding');
        const top = this.stack[this.stack.length - 1];
        const res = top.next(this.sendValue);
        this.sendValue = undefined;
        if (res.done) {
          this.stack.pop();
          this.sendValue = res.value;
          continue;
        }
        const v = res.value;
        if (v === null || v === undefined) {
          this.sendValue = dt;
          return;
        }
        if (typeof v === 'number') {
          this.wait += v;
          if (this.wait > 0) return;
          continue;
        }
        if (typeof v === 'function') {
          if (v()) continue;
          this.cond = v;
          return;
        }
        if (v instanceof Script) {
          if (v.done) continue;
          this.sub = v;
          return;
        }
        if (typeof v.next === 'function') {
          this.stack.push(v);
          continue;
        }
        // Unknown value: treat as a one-step wait.
        return;
      }
      this.done = true;
    }
  }
  DF.Script = Script;

  // A bag of scripts updated together.
  class ScriptPool {
    constructor() {
      this.list = [];
    }
    run(gen, name) {
      const s = new Script(gen, name);
      this.list.push(s);
      s.update(0);
      return s;
    }
    update(dt) {
      for (let i = 0; i < this.list.length; i++) this.list[i].update(dt);
      if (this.list.some((s) => s.done)) this.list = this.list.filter((s) => !s.done);
    }
    clear() {
      for (const s of this.list) s.stop();
      this.list.length = 0;
    }
  }
  DF.ScriptPool = ScriptPool;

  // Tween properties of `obj` inside a script: `yield* DF.tween(o, {x: 10}, 0.5, 'outCubic')`.
  DF.tween = function* (obj, to, dur, ease) {
    const from = {};
    for (const k in to) from[k] = obj[k];
    const f = typeof ease === 'function' ? ease : U.ease[ease || 'linear'];
    let t = 0;
    if (dur <= 0) {
      for (const k in to) obj[k] = to[k];
      return;
    }
    while (t < dur) {
      const dt = yield null;
      t += dt || DF.STEP;
      const p = f(Math.min(1, t / dur));
      for (const k in to) obj[k] = from[k] + (to[k] - from[k]) * p;
    }
  };

  // Run several generators in parallel and wait for all of them.
  DF.all = function* (...gens) {
    const scripts = gens.filter(Boolean).map((g) => new Script(g));
    while (scripts.some((s) => !s.done)) {
      const dt = yield null;
      for (const s of scripts) s.update(dt || DF.STEP);
    }
  };

  // Simple persistent settings (localStorage can be unavailable; never rely on it).
  DF.settings = { music: 0.8, sfx: 0.9, shake: true, touch: 'auto' };
  DF.loadSettings = function () {
    try {
      const raw = window.localStorage.getItem('device_flower_settings');
      if (raw) Object.assign(DF.settings, JSON.parse(raw));
    } catch (e) {
      /* ignore */
    }
  };
  // The one SAVE FILE. In HARD MODE, FLOWERY takes it over until you beat him.
  DF.file = { owner: 'KRIS', hardClear: false, hardTries: 0 };
  DF.loadFile = function () {
    try {
      const raw = window.localStorage.getItem('device_flower_file');
      if (raw) Object.assign(DF.file, JSON.parse(raw));
    } catch (e) {
      /* ignore */
    }
  };
  DF.saveFile = function () {
    try {
      window.localStorage.setItem('device_flower_file', JSON.stringify(DF.file));
    } catch (e) {
      /* ignore */
    }
  };
  DF.saveSettings = function () {
    try {
      window.localStorage.setItem('device_flower_settings', JSON.stringify(DF.settings));
    } catch (e) {
      /* ignore */
    }
  };
})();
