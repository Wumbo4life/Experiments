/*
 * Device_Flower - an original chiptune-rock boss theme ("Bloom Beat"), synthesised live
 * with WebAudio, plus karaoke-style lyric timing.
 *
 * The real fight plays "Flower Man" with on-screen karaoke lyrics. That song is not ours to
 * copy, so this is a new composition with new lyrics that plays the same role.
 */
(function () {
  'use strict';
  const DF = window.DF;

  const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function noteToMidi(n) {
    const m = /^([A-G])([#b]?)(-?\d)$/.exec(n);
    if (!m) throw new Error('bad note ' + n);
    let v = NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    return v + 12 * (parseInt(m[3], 10) + 1);
  }
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function parseBar(str) {
    const out = [];
    let step = 0;
    for (const tok of str.trim().split(/\s+/)) {
      const [n, l] = tok.split(':');
      const len = parseInt(l, 10);
      if (n !== '-') out.push({ step, len, midi: noteToMidi(n) });
      step += len;
    }
    if (step !== 16) throw new Error('bar is ' + step + ' steps: ' + str);
    return out;
  }
  function parseChord(sym) {
    const m = /^([A-G][#b]?)(m|7|maj7|m7)?$/.exec(sym);
    let root = NOTE[m[1][0]] + (m[1][1] === '#' ? 1 : m[1][1] === 'b' ? -1 : 0);
    const q = m[2] || '';
    const tones = q === 'm' ? [0, 3, 7] : q === '7' ? [0, 4, 7, 10] : q === 'm7' ? [0, 3, 7, 10] : [0, 4, 7];
    return { root: (root + 12) % 12, tones };
  }

  // ---------------------------------------------------------------------
  // Song data
  // ---------------------------------------------------------------------
  const RIFF = [
    'E5:2 -:1 E5:1 G5:2 B5:2 A5:2 G5:2 F#5:2 G5:2',
    'E5:2 -:1 E5:1 G5:2 C6:2 B5:2 G5:2 E5:4',
    'D5:2 -:1 D5:1 F#5:2 A5:2 G5:2 F#5:2 D5:2 F#5:2',
    'D#5:4 F#5:4 B5:4 A5:2 F#5:2',
  ];
  const VERSE = [
    'B4:2 B4:2 B4:2 A4:2 G4:2 A4:2 B4:4',
    '-:2 G4:2 A4:2 B4:2 C5:4 B4:2 A4:2',
    'A4:2 A4:2 A4:2 G4:2 F#4:2 G4:2 A4:4',
    '-:2 B4:2 G4:2 E4:2 E4:8',
    'B4:2 B4:2 B4:2 D5:2 E5:4 D5:2 B4:2',
    'C5:2 C5:2 C5:2 B4:2 A4:2 G4:2 E4:4',
    'A4:2 B4:2 C5:2 E5:2 D5:4 C5:2 B4:2',
    'B4:4 D#5:4 F#5:4 -:4',
  ];
  const PRE = [
    'E5:2 E5:2 D5:2 C5:2 D5:2 E5:2 -:4',
    'E5:2 E5:2 D5:2 C5:2 D5:2 G5:2 -:4',
    'F#5:2 F#5:2 E5:2 D5:2 E5:2 F#5:2 A5:4',
    'A5:4 B5:4 A5:2 F#5:2 D5:4',
  ];
  const CHORUS = [
    'E5:2 G5:2 C6:4 B5:2 A5:2 G5:4',
    'F#5:2 A5:2 D6:4 C6:2 B5:2 A5:4',
    'B5:4 A5:2 B5:2 D6:4 B5:4',
    'G5:2 F#5:2 E5:4 -:2 E5:2 F#5:2 G5:2',
    'E5:2 G5:2 C6:4 B5:2 A5:2 G5:4',
    'F#5:2 A5:2 D6:4 E6:2 D6:2 C6:2 B5:2',
    'D#6:4 B5:2 A5:2 F#5:2 D#5:2 B4:4',
    'E5:12 -:4',
  ];
  const RIFF_CH = ['Em', 'C', 'D', 'B7'];
  const VERSE_CH = ['Em', 'C', 'D', 'Em', 'Em', 'C', 'Am', 'B7'];
  const PRE_CH = ['Am', 'C', 'D', 'D'];
  const CHORUS_CH = ['C', 'D', 'Bm', 'Em', 'C', 'D', 'B7', 'Em'];

  const L = (bar, bars, text) => ({ bar, bars, text });
  const CHORUS_LYRICS = [
    L(0, 2, 'BLOOM! BLOOM! FLOWER POWER!'),
    L(2, 2, 'Shining brighter by the hour!'),
    L(4, 2, 'Seven colors, one big family,'),
    L(6, 2, "watch us blossom, can't you see?"),
  ];

  const SONGS = {
    battle: {
      bpm: 160,
      loopTo: 4,
      sections: [
        { name: 'intro', chords: RIFF_CH, lead: RIFF, drums: 'intro', bass: 'eighths', gtr: 'power8', fill: true, crash: true },
        {
          name: 'verse1', chords: VERSE_CH, lead: VERSE, drums: 'verse', bass: 'eighths', gtr: 'stabs', crash: true,
          lyrics: [
            L(0, 2, 'Golden petals in the sunset glow,'),
            L(2, 2, 'sorry that I kept you waiting so!'),
            L(4, 2, 'Every friend I have is number one,'),
            L(6, 2, 'now the dance of fate has just begun!'),
          ],
        },
        {
          name: 'pre1', chords: PRE_CH, lead: PRE, drums: 'pre', bass: 'eighths', gtr: 'chug', arp: true, fill: true,
          lyrics: [L(0, 2, 'Strike a pose and let the petals fly!'), L(2, 2, 'JA-RO-NA! Across the sky!')],
        },
        { name: 'chorus1', chords: CHORUS_CH, lead: CHORUS, drums: 'chorus', bass: 'octaves', gtr: 'power8', double: true, crash: true, chorus: true, lyrics: CHORUS_LYRICS },
        { name: 'riff', chords: RIFF_CH, lead: RIFF, drums: 'intro', bass: 'eighths', gtr: 'power8', fill: true, crash: true },
        {
          name: 'verse2', chords: VERSE_CH, lead: VERSE, drums: 'verse', bass: 'gallop', gtr: 'stabs', crash: true,
          lyrics: [
            L(0, 2, 'Posing, spinning, praising all the day,'),
            L(2, 2, 'blow the gloomy clouds of doubt away!'),
            L(4, 2, 'Justice, kindness, bravery and grace,'),
            L(6, 2, 'every flower in its proper place!'),
          ],
        },
        {
          name: 'pre2', chords: PRE_CH, lead: PRE, drums: 'pre', bass: 'eighths', gtr: 'chug', arp: true, fill: true,
          lyrics: [L(0, 2, 'Lend me all your power, friends of mine!'), L(2, 2, "OMEGA! It's time to shine!")],
        },
        { name: 'chorus2', chords: CHORUS_CH, lead: CHORUS, drums: 'chorus', bass: 'octaves', gtr: 'power8', double: true, crash: true, chorus: true, fill: true, lyrics: CHORUS_LYRICS },
        {
          name: 'chorus3', chords: CHORUS_CH, lead: CHORUS, drums: 'chorus', bass: 'octaves', gtr: 'power8', double: true, crash: true, chorus: true, transpose: 1,
          lyrics: [
            L(0, 2, 'BLOOM! BLOOM! FLOWER POWER!'),
            L(2, 2, 'This is my finest hour!'),
            L(4, 2, 'Best friends ever, now and forever,'),
            L(6, 2, 'I will never let you go!'),
          ],
        },
        { name: 'outro', chords: RIFF_CH, lead: RIFF, drums: 'intro', bass: 'eighths', gtr: 'power8', transpose: 1, fill: true, crash: true },
      ],
    },
    title: {
      bpm: 112,
      loopTo: 0,
      sections: [
        { name: 'a', chords: CHORUS_CH, lead: null, drums: 'half', bass: 'sustain', gtr: 'none', arp: true },
        { name: 'b', chords: CHORUS_CH, lead: CHORUS, leadInst: 'soft', drums: 'half', bass: 'sustain', gtr: 'none', arp: true },
      ],
    },
    ending: {
      bpm: 96,
      loopTo: 0,
      sections: [
        { name: 'a', chords: CHORUS_CH, lead: CHORUS, leadInst: 'soft', drums: 'none', bass: 'sustain', gtr: 'none', arp: true },
        { name: 'b', chords: VERSE_CH, lead: VERSE, leadInst: 'soft', drums: 'half', bass: 'sustain', gtr: 'none', arp: true },
      ],
    },
  };
  for (const key in SONGS) {
    for (const s of SONGS[key].sections) {
      s.bars = s.chords.length;
      s.parsedLead = s.lead ? s.lead.map(parseBar) : null;
      s.parsedChords = s.chords.map(parseChord);
    }
  }

  const DRUMS = {
    intro: { k: 'x..x..x.x..x..x.', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
    verse: { k: 'x.....x.x.......', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
    pre: { k: 'x.......x.x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
    chorus: { k: 'x.....x.x.....x.', s: '....x.......x...', h: 'xxxxxxxxxxxxxxxx' },
    half: { k: 'x.........x.....', s: '........x.......', h: 'x...x...x...x...' },
    none: { k: '................', s: '................', h: '................' },
    fill: { k: 'x.......x.x.x.x.', s: '....x...xxxxxxxx', h: 'x.x.x.x.........' },
  };

  // ---------------------------------------------------------------------
  // Synth
  // ---------------------------------------------------------------------
  const M = (DF.Music = {
    songKey: null,
    song: null,
    playing: false,
    bpmMul: 1,
    sec: 0,
    bar: 0,
    step: 0,
    nextTime: 0,
    queue: [],
    pos: null,
    timer: null,
    out: null,
    buses: null,
    waves: null,
    noise: null,
    lastKick: -10,
  });

  function setup() {
    const A = DF.Audio;
    if (!A.ctx || M.out) return !!M.out;
    const c = A.ctx;
    M.out = c.createGain();
    M.out.connect(A.musicBus);
    const mk = (vol) => {
      const g = c.createGain();
      g.gain.value = vol;
      g.connect(M.out);
      return g;
    };
    const gtrPre = c.createGain();
    const shaper = c.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      const x = (i / 1023) * 2 - 1;
      curve[i] = Math.tanh(x * 4.5);
    }
    shaper.curve = curve;
    const gtrLp = c.createBiquadFilter();
    gtrLp.type = 'lowpass';
    gtrLp.frequency.value = 2600;
    const gtrOut = mk(0.05);
    gtrPre.connect(shaper);
    shaper.connect(gtrLp);
    gtrLp.connect(gtrOut);
    M.buses = {
      lead: mk(0.13),
      double: mk(0.05),
      soft: mk(0.16),
      bass: mk(0.2),
      arp: mk(0.045),
      gtr: gtrPre,
      drums: mk(0.55),
    };
    // Pulse waves (NES-style duty cycles).
    M.waves = {};
    for (const duty of [0.125, 0.25, 0.5]) {
      const n = 48;
      const real = new Float32Array(n);
      const imag = new Float32Array(n);
      for (let k = 1; k < n; k++) {
        real[k] = Math.sin(2 * Math.PI * k * duty) / (k * Math.PI);
        imag[k] = (1 - Math.cos(2 * Math.PI * k * duty)) / (k * Math.PI);
      }
      M.waves[duty] = c.createPeriodicWave(real, imag);
    }
    const len = c.sampleRate;
    M.noise = c.createBuffer(1, len, c.sampleRate);
    const d = M.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }

  function env(g, t, peak, attack, dur, release) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.setValueAtTime(peak, Math.max(t + attack, t + dur - release));
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
  }

  function tone(bus, type, midi, t, dur, vol, opts) {
    const c = DF.Audio.ctx;
    const o = c.createOscillator();
    if (typeof type === 'number') o.setPeriodicWave(M.waves[type]);
    else o.type = type;
    o.frequency.setValueAtTime(mtof(midi), t);
    if (opts && opts.detune) o.detune.value = opts.detune;
    const g = c.createGain();
    o.connect(g);
    let last = g;
    if (opts && opts.lp) {
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = opts.lp;
      g.connect(f);
      last = f;
    }
    last.connect(bus);
    const decayTo = opts && opts.sustain !== undefined ? opts.sustain : 0.7;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.006);
    g.gain.linearRampToValueAtTime(vol * decayTo, t + Math.min(dur * 0.5, 0.12));
    g.gain.setValueAtTime(vol * decayTo, Math.max(t + 0.01, t + dur - 0.04));
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    if (opts && opts.vibrato && dur > 0.3) {
      const lfo = c.createOscillator();
      const lg = c.createGain();
      lfo.frequency.value = 5.5;
      lg.gain.setValueAtTime(0, t);
      lg.gain.linearRampToValueAtTime(mtof(midi) * 0.012, t + dur * 0.6);
      lfo.connect(lg);
      lg.connect(o.frequency);
      lfo.start(t + 0.15);
      lfo.stop(t + dur + 0.05);
    }
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  function noiseHit(t, dur, vol, type, freq, q) {
    const c = DF.Audio.ctx;
    const s = c.createBufferSource();
    s.buffer = M.noise;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    if (q) f.Q.value = q;
    const g = c.createGain();
    s.connect(f);
    f.connect(g);
    g.connect(M.buses.drums);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.02);
  }

  function kick(t, vol) {
    const c = DF.Audio.ctx;
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(165, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    o.connect(g);
    g.connect(M.buses.drums);
    o.start(t);
    o.stop(t + 0.3);
    M.lastKick = t;
  }
  function snare(t, vol) {
    noiseHit(t, 0.16, 0.55 * vol, 'bandpass', 1800, 0.7);
    const c = DF.Audio.ctx;
    const o = c.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(210, t);
    o.frequency.exponentialRampToValueAtTime(140, t + 0.07);
    const g = c.createGain();
    g.gain.setValueAtTime(0.35 * vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    o.connect(g);
    g.connect(M.buses.drums);
    o.start(t);
    o.stop(t + 0.1);
  }
  const hat = (t, vol, open) => noiseHit(t, open ? 0.18 : 0.035, 0.12 * vol, 'highpass', 7500);
  const crash = (t) => noiseHit(t, 1.3, 0.22, 'highpass', 3200);

  // Schedule one 16th step.
  function scheduleStep(t) {
    const song = M.song;
    const sec = song.sections[M.sec];
    const stepDur = 60 / (song.bpm * M.bpmMul) / 4;
    const tr = sec.transpose || 0;
    const chord = sec.parsedChords[M.bar];
    const st = M.step;
    const lastBar = M.bar === sec.bars - 1;

    // Lead melody.
    if (sec.parsedLead) {
      for (const n of sec.parsedLead[M.bar]) {
        if (n.step !== st) continue;
        const dur = n.len * stepDur * 0.92;
        if (sec.leadInst === 'soft') {
          tone(M.buses.soft, 'triangle', n.midi + tr, t, dur, 0.9, { vibrato: true, sustain: 0.8 });
        } else {
          tone(M.buses.lead, 0.25, n.midi + tr, t, dur, 0.9, { vibrato: true });
          if (sec.double) tone(M.buses.double, 0.125, n.midi + tr - 12, t, dur, 0.9, { sustain: 0.6 });
        }
      }
    }
    // Bass.
    const root = chord.root + tr;
    const bassMidi = 36 + ((root - 36) % 12 + 12) % 12 + (((root % 12) + 12) % 12 < 4 ? 12 : 0);
    if (sec.bass === 'eighths' && st % 2 === 0) {
      tone(M.buses.bass, 'sawtooth', bassMidi, t, stepDur * 1.7, 0.9, { lp: 700, sustain: 0.6 });
    } else if (sec.bass === 'gallop' && (st % 4 === 0 || st % 4 === 2 || st % 4 === 3)) {
      tone(M.buses.bass, 'sawtooth', bassMidi, t, stepDur * 0.9, 0.9, { lp: 700, sustain: 0.6 });
    } else if (sec.bass === 'octaves' && st % 2 === 0) {
      tone(M.buses.bass, 'sawtooth', bassMidi + (st % 4 === 2 ? 12 : 0), t, stepDur * 1.7, 0.9, { lp: 800, sustain: 0.6 });
    } else if (sec.bass === 'sustain' && st === 0) {
      tone(M.buses.bass, 'triangle', bassMidi, t, stepDur * 15.5, 1.1, { sustain: 0.8 });
    }
    // Rhythm "guitar": distorted power chords.
    const gtrRoot = 40 + ((root - 40) % 12 + 12) % 12;
    const power = [gtrRoot, gtrRoot + 7, gtrRoot + 12];
    let hitGtr = false;
    let gLen = stepDur * 1.6;
    if (sec.gtr === 'power8' && st % 2 === 0) hitGtr = true;
    else if (sec.gtr === 'stabs' && (st === 0 || st === 6 || st === 10)) {
      hitGtr = true;
      gLen = stepDur * 1.2;
    } else if (sec.gtr === 'chug' && st % 2 === 0) {
      hitGtr = true;
      gLen = stepDur * 0.8;
    }
    if (hitGtr) {
      for (const m of power) {
        tone(M.buses.gtr, 'sawtooth', m, t, gLen, 0.5, { detune: -8, sustain: 0.8 });
        tone(M.buses.gtr, 'sawtooth', m, t, gLen, 0.5, { detune: 8, sustain: 0.8 });
      }
    }
    // Arpeggio.
    if (sec.arp && st % 2 === 0) {
      const tones = chord.tones;
      const idx = (st / 2) % (tones.length + 1);
      const deg = idx < tones.length ? tones[idx] : 12;
      const base = 72 + ((root - 72) % 12 + 12) % 12;
      tone(M.buses.arp, 0.5, base + deg, t, stepDur * 1.4, 0.9, { sustain: 0.3 });
    }
    // Drums.
    const pat = DRUMS[sec.fill && lastBar ? 'fill' : sec.drums] || DRUMS.none;
    if (pat.k[st] === 'x') kick(t, 0.95);
    if (pat.s[st] === 'x') snare(t, sec.fill && lastBar && st > 7 ? 0.5 + (st - 8) * 0.07 : 1);
    if (pat.h[st] === 'x') hat(t, st % 4 === 2 ? 1 : 0.7, sec.drums === 'chorus' && st % 4 === 2);
    if (st === 0 && ((sec.crash && M.bar === 0) || (sec.chorus && M.bar === 4))) crash(t);

    M.queue.push({ t, sec: M.sec, bar: M.bar, step: st });
    // Advance.
    M.step++;
    if (M.step >= 16) {
      M.step = 0;
      M.bar++;
      if (M.bar >= sec.bars) {
        M.bar = 0;
        M.sec++;
        if (M.sec >= song.sections.length) M.sec = song.loopTo;
      }
    }
    return stepDur;
  }

  function pump() {
    if (!M.playing || !DF.Audio.ctx) return;
    const c = DF.Audio.ctx;
    if (c.state !== 'running') {
      // Keep the song clock parked while audio is suspended.
      M.nextTime = Math.max(M.nextTime, c.currentTime + 0.05);
      return;
    }
    if (M.nextTime < c.currentTime - 0.3) M.nextTime = c.currentTime + 0.05; // recover from stalls
    while (M.nextTime < c.currentTime + 0.16) {
      M.nextTime += scheduleStep(M.nextTime);
    }
  }

  M.play = function (key, opts) {
    if (!setup()) return;
    opts = opts || {};
    M.stop(0);
    M.songKey = key;
    M.song = SONGS[key];
    M.sec = 0;
    if (opts.section) M.sec = Math.max(0, M.song.sections.findIndex((s) => s.name === opts.section));
    M.bar = 0;
    M.step = 0;
    M.bpmMul = opts.bpmMul || 1;
    M.queue.length = 0;
    M.pos = null;
    const c = DF.Audio.ctx;
    M.out.gain.cancelScheduledValues(c.currentTime);
    M.out.gain.setValueAtTime(1, c.currentTime);
    M.nextTime = c.currentTime + 0.08;
    M.playing = true;
    if (!M.timer) M.timer = setInterval(pump, 25);
    pump();
  };
  M.stop = function (fade) {
    if (!M.out) return;
    const c = DF.Audio.ctx;
    M.playing = false;
    M.pos = null;
    M.queue.length = 0;
    const g = M.out.gain;
    g.cancelScheduledValues(c.currentTime);
    g.setValueAtTime(g.value, c.currentTime);
    g.linearRampToValueAtTime(0.0001, c.currentTime + (fade || 0.05));
  };
  M.jumpTo = function (name) {
    if (!M.song) return;
    const i = M.song.sections.findIndex((s) => s.name === name);
    if (i >= 0) {
      M.sec = i;
      M.bar = 0;
      M.step = 0;
    }
  };
  M.setTempo = function (mul) {
    M.bpmMul = mul;
  };

  // Called every frame: advance the "now playing" position used for karaoke and visuals.
  M.update = function () {
    if (!M.playing || !DF.Audio.ctx) return;
    const now = DF.Audio.ctx.currentTime;
    while (M.queue.length && M.queue[0].t <= now) M.pos = M.queue.shift();
  };
  // 0..1 pulse that peaks on each kick drum.
  M.kickPulse = function () {
    if (!M.playing || !DF.Audio.ctx) return 0;
    const dt = DF.Audio.ctx.currentTime - M.lastKick;
    return dt < 0 ? 0 : Math.max(0, 1 - dt * 5);
  };
  // The karaoke line currently being "sung", with 0..1 progress.
  M.lyric = function () {
    if (!M.playing || !M.pos || !M.song) return null;
    const sec = M.song.sections[M.pos.sec];
    if (!sec || !sec.lyrics) return null;
    const p = M.pos.bar + M.pos.step / 16;
    for (const ln of sec.lyrics) {
      if (p >= ln.bar - 0.25 && p < ln.bar + ln.bars) {
        return { text: ln.text, progress: Math.max(0, Math.min(1, (p - ln.bar) / (ln.bars * 0.8))), chorus: !!sec.chorus, key: sec.name + ln.bar };
      }
    }
    return null;
  };
  M.sectionName = () => (M.pos && M.song ? M.song.sections[M.pos.sec].name : '');
})();
