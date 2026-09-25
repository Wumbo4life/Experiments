/* Device_Flower - WebAudio sound effects, voice clips (with music ducking) and loops. */
(function () {
  'use strict';
  const DF = window.DF;

  const A = (DF.Audio = {
    ctx: null,
    master: null,
    sfxBus: null,
    musicBus: null,
    duckGain: null,
    buffers: {},
    offsets: {},
    loaded: 0,
    total: 0,
    ready: false,
    unlocked: false,
    muted: false,
    voiceNode: null,
    loops: {},
    lastPlay: {},
  });

  A.init = function () {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) {
      A.ready = true;
      return Promise.resolve();
    }
    try {
      A.ctx = new Ctx({ latencyHint: 'interactive' });
    } catch (e) {
      A.ctx = null;
      A.ready = true;
      return Promise.resolve();
    }
    const c = A.ctx;
    A.master = c.createGain();
    A.master.connect(c.destination);
    A.sfxBus = c.createGain();
    A.sfxBus.connect(A.master);
    A.musicBus = c.createGain();
    A.duckGain = c.createGain();
    A.musicBus.connect(A.duckGain);
    A.duckGain.connect(A.master);
    A.applyVolumes();

    const sounds = (window.DF_DATA && window.DF_DATA.sounds) || {};
    const names = Object.keys(sounds);
    A.total = names.length;
    // Decode a few at a time so the page stays responsive.
    let idx = 0;
    const worker = () => {
      if (idx >= names.length) return Promise.resolve();
      const name = names[idx++];
      return decode(name, sounds[name]).then(worker, worker);
    };
    const workers = [];
    for (let i = 0; i < 6; i++) workers.push(worker());
    return Promise.all(workers).then(() => {
      A.ready = true;
      // Free the base64 strings once decoded.
      if (window.DF_DATA) window.DF_DATA.sounds = null;
    });
  };

  function decode(name, b64) {
    const buf = DF.G.base64ToBuffer(b64);
    return new Promise((resolve) => {
      const done = (audio) => {
        if (audio) {
          A.buffers[name] = audio;
          A.offsets[name] = leadingSilence(audio);
        }
        A.loaded++;
        resolve();
      };
      try {
        const p = A.ctx.decodeAudioData(buf, done, () => done(null));
        if (p && p.catch) p.catch(() => done(null));
      } catch (e) {
        done(null);
      }
    });
  }

  // MP3 encoders pad the start with silence; skip it so SFX land on time.
  function leadingSilence(audio) {
    const d = audio.getChannelData(0);
    const lim = Math.min(d.length, Math.floor(audio.sampleRate * 0.25));
    for (let i = 0; i < lim; i++) {
      if (Math.abs(d[i]) > 0.003) return Math.max(0, i / audio.sampleRate - 0.003);
    }
    return 0;
  }

  A.unlock = function () {
    if (!A.ctx) return;
    if (A.ctx.state === 'suspended') A.ctx.resume().catch(() => {});
    A.unlocked = true;
  };

  A.applyVolumes = function () {
    if (!A.ctx) return;
    const s = DF.settings;
    const m = A.muted ? 0 : 1;
    A.sfxBus.gain.value = s.sfx * m;
    A.musicBus.gain.value = s.music * m;
  };
  A.toggleMute = function () {
    A.muted = !A.muted;
    A.applyVolumes();
    return A.muted;
  };

  /*
   * Play a sound. o: { vol, pitch, loop, bus ('sfx'|'music'), minGap }
   * Returns a handle with stop(fadeSeconds).
   */
  A.play = function (name, o) {
    o = o || {};
    if (!A.ctx || !A.buffers[name]) return { stop() {}, playing: false };
    const now = A.ctx.currentTime;
    if (o.minGap) {
      if (A.lastPlay[name] && now - A.lastPlay[name] < o.minGap) return { stop() {}, playing: false };
    }
    A.lastPlay[name] = now;
    const src = A.ctx.createBufferSource();
    src.buffer = A.buffers[name];
    src.playbackRate.value = o.pitch || 1;
    const g = A.ctx.createGain();
    g.gain.value = o.vol !== undefined ? o.vol : 1;
    src.connect(g);
    g.connect(o.bus === 'music' ? A.musicBus : A.sfxBus);
    const off = A.offsets[name] || 0;
    if (o.loop) {
      src.loop = true;
      src.loopStart = off;
      src.loopEnd = src.buffer.duration;
    }
    src.start(now, off);
    const handle = {
      playing: true,
      src,
      gain: g,
      duration: (src.buffer.duration - off) / (o.pitch || 1),
      stop(fade) {
        if (!this.playing) return;
        this.playing = false;
        try {
          const t = A.ctx.currentTime;
          if (fade) {
            g.gain.setValueAtTime(g.gain.value, t);
            g.gain.linearRampToValueAtTime(0, t + fade);
            src.stop(t + fade + 0.02);
          } else src.stop();
        } catch (e) {
          /* already stopped */
        }
      },
    };
    src.onended = () => {
      handle.playing = false;
    };
    return handle;
  };

  // Voice clips duck the music a little and never overlap each other.
  A.voice = function (name, o) {
    if (!A.ctx || !A.buffers[name]) return { stop() {}, playing: false, duration: 0 };
    if (A.voiceNode) A.voiceNode.stop(0.05);
    const h = A.play(name, Object.assign({ vol: 1 }, o || {}));
    A.voiceNode = h;
    const t = A.ctx.currentTime;
    const g = A.duckGain.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(0.45, t + 0.06);
    g.setValueAtTime(0.45, t + Math.max(0.1, h.duration - 0.1));
    g.linearRampToValueAtTime(1, t + h.duration + 0.25);
    return h;
  };

  // Named looping sounds (wind etc.).
  A.loop = function (key, name, vol) {
    if (A.loops[key]) return A.loops[key];
    A.loops[key] = A.play(name, { loop: true, vol: vol || 1 });
    return A.loops[key];
  };
  A.stopLoop = function (key, fade) {
    if (A.loops[key]) A.loops[key].stop(fade || 0.2);
    delete A.loops[key];
  };

  A.duration = (name) => (A.buffers[name] ? A.buffers[name].duration - (A.offsets[name] || 0) : 0);

  document.addEventListener('visibilitychange', () => {
    if (!A.ctx) return;
    if (document.hidden) A.ctx.suspend().catch(() => {});
    else if (A.unlocked) A.ctx.resume().catch(() => {});
  });
})();
