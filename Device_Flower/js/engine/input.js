/* Device_Flower - keyboard + touch input with per-step press detection. */
(function () {
  'use strict';
  const DF = window.DF;

  const MAP = {
    confirm: ['KeyZ', 'Enter', 'NumpadEnter', 'Space'],
    cancel: ['KeyX', 'ShiftLeft', 'ShiftRight', 'Backspace'],
    menu: ['KeyC', 'ControlLeft', 'ControlRight'],
    up: ['ArrowUp', 'KeyW'],
    down: ['ArrowDown', 'KeyS'],
    left: ['ArrowLeft', 'KeyA'],
    right: ['ArrowRight', 'KeyD'],
    pause: ['Escape', 'KeyP'],
    mute: ['KeyM'],
    fullscreen: ['KeyF'],
  };
  const CODE_TO_ACTION = {};
  for (const action in MAP) for (const code of MAP[action]) (CODE_TO_ACTION[code] = CODE_TO_ACTION[code] || []).push(action);

  const Input = (DF.Input = {
    held: {}, // action -> count of sources holding it
    queued: new Set(), // presses that happened since the last step
    pressedNow: new Set(),
    releasedQ: new Set(),
    releasedNow: new Set(),
    anyQueued: false,
    anyNow: false,
    listeners: [],

    down(action) {
      return (this.held[action] || 0) > 0;
    },
    pressed(action) {
      return this.pressedNow.has(action);
    },
    released(action) {
      return this.releasedNow.has(action);
    },
    anyPressed() {
      return this.anyNow;
    },
    // Horizontal / vertical axis from held directions.
    axis() {
      return {
        x: (this.down('right') ? 1 : 0) - (this.down('left') ? 1 : 0),
        y: (this.down('down') ? 1 : 0) - (this.down('up') ? 1 : 0),
      };
    },
    beginStep() {
      this.pressedNow = this.queued;
      this.queued = new Set();
      this.releasedNow = this.releasedQ;
      this.releasedQ = new Set();
      this.anyNow = this.anyQueued;
      this.anyQueued = false;
    },
    endStep() {
      this.pressedNow = new Set();
      this.releasedNow = new Set();
      this.anyNow = false;
    },
    press(action) {
      this.held[action] = (this.held[action] || 0) + 1;
      this.queued.add(action);
      this.anyQueued = true;
      for (const fn of this.listeners) fn(action);
    },
    release(action) {
      this.held[action] = Math.max(0, (this.held[action] || 0) - 1);
      this.releasedQ.add(action);
    },
    onPress(fn) {
      this.listeners.push(fn);
    },
    clearHeld() {
      for (const k in this.held) {
        if (this.held[k] > 0) this.releasedQ.add(k);
        this.held[k] = 0;
      }
      this.physical.clear();
    },
    physical: new Set(),
  });

  window.addEventListener('keydown', (e) => {
    const actions = CODE_TO_ACTION[e.code];
    if (!actions) return;
    if (e.ctrlKey && e.code !== 'ControlLeft' && e.code !== 'ControlRight') return; // leave browser shortcuts alone
    e.preventDefault();
    if (e.repeat || Input.physical.has(e.code)) return;
    Input.physical.add(e.code);
    for (const a of actions) Input.press(a);
  });
  window.addEventListener('keyup', (e) => {
    const actions = CODE_TO_ACTION[e.code];
    if (!actions) return;
    e.preventDefault();
    if (!Input.physical.has(e.code)) return;
    Input.physical.delete(e.code);
    for (const a of actions) Input.release(a);
  });
  window.addEventListener('blur', () => Input.clearHeld());

  // ---- touch controls ---------------------------------------------------
  Input.setupTouch = function (root) {
    const pad = document.createElement('div');
    pad.className = 'touch';
    pad.innerHTML =
      '<div class="dpad">' +
      '<button data-a="up" class="t-up" aria-label="Up">&#9650;</button>' +
      '<button data-a="left" class="t-left" aria-label="Left">&#9664;</button>' +
      '<button data-a="right" class="t-right" aria-label="Right">&#9654;</button>' +
      '<button data-a="down" class="t-down" aria-label="Down">&#9660;</button>' +
      '</div>' +
      '<div class="abtns">' +
      '<button data-a="cancel" class="t-x" aria-label="Cancel (X)">X</button>' +
      '<button data-a="confirm" class="t-z" aria-label="Confirm (Z)">Z</button>' +
      '</div>';
    root.appendChild(pad);
    const active = new Map(); // pointerId -> action
    const start = (e) => {
      const b = e.target.closest('button[data-a]');
      if (!b) return;
      e.preventDefault();
      const a = b.dataset.a;
      active.set(e.pointerId, a);
      b.classList.add('on');
      Input.press(a);
      if (DF.Audio) DF.Audio.unlock();
    };
    const end = (e) => {
      const a = active.get(e.pointerId);
      if (!a) return;
      active.delete(e.pointerId);
      pad.querySelectorAll('button[data-a="' + a + '"]').forEach((b) => b.classList.remove('on'));
      Input.release(a);
    };
    pad.addEventListener('pointerdown', start);
    pad.addEventListener('pointerup', end);
    pad.addEventListener('pointercancel', end);
    pad.addEventListener('pointerleave', end);
    pad.addEventListener('contextmenu', (e) => e.preventDefault());
    Input.touchPad = pad;
    return pad;
  };
})();
