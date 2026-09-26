/* Device_Flower - boot, scene switching and the fixed-step main loop. */
(function () {
  'use strict';
  const DF = window.DF;
  const G = DF.G;

  DF.scene = null;
  DF.assetsReady = false;
  let fader = null; // { t, dur, make, phase }

  DF.setScene = function (scene) {
    DF.scene = scene;
    DF.Input.endStep();
  };
  // Fade to black, swap scene, fade back in.
  DF.fadeTo = function (make, dur) {
    if (fader) return;
    fader = { t: 0, dur: dur || 0.6, make, swapped: false };
  };

  const canvas = document.getElementById('game');
  G.init(canvas);
  DF.loadSettings();

  function resize() {
    const root = document.getElementById('stage');
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const touchOn = document.body.classList.contains('touch-on');
    const portrait = vw < vh;
    // Leave room for the on-screen buttons: below the game in portrait, beside it in landscape.
    const gutter = 32; // 16px on each side
    const availH = touchOn && portrait ? vh * 0.62 : vh;
    const availW = touchOn && !portrait ? Math.max(vw * 0.55, vw - 440) : vw - gutter;
    let scale = Math.min(availW / DF.W, availH / DF.H);
    if (scale >= 1) scale = Math.max(1, Math.floor(scale * 4) / 4);
    canvas.style.width = Math.floor(DF.W * scale) + 'px';
    canvas.style.height = Math.floor(DF.H * scale) + 'px';
    root.style.alignItems = touchOn && portrait ? 'flex-start' : 'center';
  }
  window.addEventListener('resize', resize);

  DF.applyTouchSetting = function () {
    const mode = DF.settings.touch;
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const on = mode === 'on' || (mode === 'auto' && hasTouch);
    document.body.classList.toggle('touch-on', on);
    resize();
  };

  canvas.addEventListener('pointerdown', () => {
    DF.pointerClicked = true;
    DF.Audio.unlock();
  });
  DF.Input.onPress((a) => {
    DF.Audio.unlock();
    if (a === 'fullscreen') {
      const el = document.documentElement;
      if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen().catch(() => {});
      else if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
    }
  });

  // ---- loop ---------------------------------------------------------------------------
  let last = performance.now();
  let acc = 0;
  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.25) dt = 0.25;
    const speed = (DF.debug && DF.debug.speed) || 1;
    acc += dt * speed;
    let steps = 0;
    while (acc >= DF.STEP && steps < 8 * speed) {
      step(DF.STEP);
      acc -= DF.STEP;
      steps++;
    }
    if (steps === 8 * speed) acc = 0;
    render();
    requestAnimationFrame(frame);
  }
  function step(dt) {
    if (DF.debug && DF.debug.onStep) DF.debug.onStep();
    DF.Input.beginStep();
    DF.time += dt;
    DF.Music.update();
    if (fader) {
      fader.t += dt;
      if (!fader.swapped && fader.t >= fader.dur) {
        fader.swapped = true;
        DF.setScene(fader.make());
      }
      if (fader.t >= fader.dur * 2) fader = null;
    } else if (DF.scene) {
      try {
        DF.scene.update(dt);
      } catch (e) {
        showError(e);
      }
    }
    if (DF.scene && fader && fader.swapped && DF.scene.update && fader.t > fader.dur + 0.05) {
      // Let the new scene animate while fading in.
      try {
        DF.scene.update(dt);
      } catch (e) {
        showError(e);
      }
    }
    DF.Input.endStep();
  }
  function render() {
    const ctx = G.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    if (DF.scene) {
      try {
        DF.scene.draw();
      } catch (e) {
        showError(e);
      }
    }
    if (fader) {
      const k = fader.t < fader.dur ? fader.t / fader.dur : 1 - (fader.t - fader.dur) / fader.dur;
      G.rect(0, 0, DF.W, DF.H, '#000', Math.max(0, Math.min(1, k)));
    }
  }
  let shownError = false;
  function showError(e) {
    if (shownError) return;
    shownError = true;
    console.error(e);
    const box = document.getElementById('error');
    if (box) {
      box.textContent = 'Something went wrong: ' + (e && e.message ? e.message : e) + '\n(Reload the page to try again.)';
      box.style.display = 'block';
    }
  }
  window.addEventListener('error', (ev) => showError(ev.error || ev.message));

  // ---- boot ---------------------------------------------------------------------------
  DF.Input.setupTouch(document.getElementById('stage'));
  DF.applyTouchSetting();
  resize();
  DF.setScene(new DF.BootScene());
  requestAnimationFrame(frame);
  G.load()
    .then(() => {
      DF.buildPixelArt();
      DF.assetsReady = true;
      return DF.Audio.init();
    })
    .catch((e) => showError(e));

  // Handy for debugging from the console: DF.debug.phase(4)
  DF.debug = {
    phase(n) {
      DF.setScene(new DF.Battle({ phase: n, retry: true, tp: n >= 5 ? 100 : 0, fightLocked: true }));
    },
    tp(n) {
      if (DF.scene && DF.scene.tp !== undefined) DF.scene.tp = n;
    },
    climb() {
      const bt = new DF.Battle({ phase: 6, retry: true, tp: 100, fightLocked: true });
      DF.setScene(bt);
      bt.scripts.clear();
      bt.fade = 0;
      bt.startClimb = true;
      bt.scripts.run(DF.Cutscenes.climb(bt));
    },
    finale() {
      const bt = new DF.Battle({ phase: 6, retry: true, tp: 100, fightLocked: true });
      DF.setScene(bt);
      bt.scripts.clear();
      bt.fade = 0;
      bt.showUI(false);
      DF.Music.play('battle', { section: 'chorus3' });
      bt.scripts.run(
        (function* () {
          bt.climb = new DF.Finale(bt);
          yield () => bt.climb.done;
          if (bt.climb.failed) {
            bt.climb = null;
            yield* bt.gameOver();
            return;
          }
          bt.ended = true;
          DF.setScene(new DF.EndingScene(bt.stats));
        })()
      );
    },
    ending() {
      DF.setScene(new DF.EndingScene({ time: 900, turns: 24, parries: 14, perfects: 5, breaks: 11, hits: 6, tpGained: 320, retries: 0 }));
    },
  };
})();
