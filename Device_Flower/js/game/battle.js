/* Device_Flower - the battle: turn flow, menus, actions, damage and TP. */
(function () {
  'use strict';
  const DF = window.DF;
  const G = DF.G;
  const U = DF.U;
  const Input = DF.Input;
  const Audio = DF.Audio;

  const ENEMY_SLOTS = {
    flowery: { x: 505, y: 262 },
    A: { x: 590, y: 164, mouthK: 0.75 },
    B: { x: 598, y: 318, mouthK: 0.45 },
  };

  class Battle {
    constructor(opts) {
      opts = opts || {};
      this.opts = opts;
      this.phase = opts.phase || 1;
      this.fx = new DF.FX();
      this.scripts = new DF.ScriptPool();
      const ids = this.phase >= 6 ? ['kris', 'susie'] : ['kris', 'susie', 'ralsei'];
      this.party = ids.map((id) => new DF.PartyBattler(id));
      this.ralseiOut = this.phase >= 6;
      this.flowery = new DF.EnemyBattler({ id: 'flowery', name: 'Flowery', x: ENEMY_SLOTS.flowery.x, y: ENEMY_SLOTS.flowery.y, mouthK: 0.8 });
      this.enemies = [this.flowery];
      this.tp = opts.tp || 0;
      this.tpShown = this.tp;
      this.items = (opts.items || DF.START_ITEMS).slice();
      this.hints = Object.assign({}, opts.hints || {});
      this.fightLocked = !!opts.fightLocked;
      this.turn = 0;
      this.phaseTurn = 0;
      this.enemyTurns = 0; // enemy turns taken in the current phase
      this.stats = Object.assign({ turns: 0, hits: 0, damageTaken: 0, parries: 0, perfects: 0, breaks: 0, tpGained: 0, time: 0, retries: 0 }, opts.stats || {});
      this.arena = new DF.Arena(320, 176, 344, 196);
      this.soul = new DF.OrangeSoul();
      this.soul.visible = false;
      this.wave = null;
      this.state = 'CUTSCENE';
      this.uiY = 480;
      this.uiTarget = 480;
      this.tpX = -63;
      this.tpTarget = -63;
      this.textbox = { typer: null, face: null };
      this.bubbles = [];
      this.overlay = null;
      this.attackRows = null;
      this.menu = null;
      this.actions = [];
      this.current = -1;
      this.selSiner = 0;
      this.boxY = [0, 0, 0];
      this.lastBtn = {};
      this.bgT = 0;
      this.fade = opts.retry ? 1 : 1;
      this.omega = false; // OMEGA FLOWERY only appears at the top of the climb
      // HARD MODE: FLOWERY holds the power of DETERMINATION (and your SAVE FILE).
      this.hard = !!opts.hard;
      this.loads = {}; // phases where he has already LOADed
      this.waveSpeed = this.hard ? 1.25 : 1;
      this.rewind = null;
      this.climb = null;
      this.ended = false;
      this.gameOverFlag = false;
      this.hideKaraoke = false;
      this.tpPreview = 0;
      this.layoutParty();
      this.placeAllies(DF.PHASES[this.phase].allies, true);
      if (this.phase === 2) this.flowery.x = 590 - (opts.blowPulls || 0) * 42;
      if (this.hard) {
        this.flowery.determined = true;
        this.flowery.tint = '#ff5a5a';
      }
      this.saveCheckpoint();
      this.scripts.run(this.mainFlow(), 'main');
    }

    // ---- setup helpers -----------------------------------------------------------
    layoutParty() {
      const n = this.party.length;
      this.party.forEach((m, i) => {
        const d = m.def;
        const y = n === 3 ? 50 + 80 * i : n === 2 ? 100 + 80 * i : 140;
        m.x = 80 + d.w;
        m.y = y + d.h * 2;
      });
    }
    member(id) {
      return this.party.find((m) => m.id === id) || null;
    }
    enemyById(id) {
      return this.enemies.find((e) => e.id === id) || null;
    }
    placeAllies(ids, instant) {
      this.enemies = this.enemies.filter((e) => e.id === 'flowery');
      ids.forEach((id, i) => {
        const slot = i === 0 ? ENEMY_SLOTS.A : ENEMY_SLOTS.B;
        const g = DF.GANG[id];
        const e = new DF.EnemyBattler({
          id, name: g.name, hp: 99, maxhp: 99, x: slot.x, y: slot.y, prefix: 'gang/' + id, fps: g.fps, selectable: false, mouthK: slot.mouthK,
        });
        if (!instant) e.offX = 220;
        this.enemies.push(e);
      });
    }
    allies() {
      return this.enemies.filter((e) => e.id !== 'flowery');
    }
    hideEnemy(e) {
      if (!e) return;
      e.visible = false;
      this.fx.petalBurst(e.center().x, e.center().y, 5);
    }
    showEnemy(e) {
      if (!e) return;
      e.visible = true;
      e.flash = 1;
      this.fx.petalBurst(e.center().x, e.center().y, 5);
    }
    saveCheckpoint() {
      this.checkpoint = {
        phase: this.phase,
        items: this.items.slice(),
        hints: Object.assign({}, this.hints),
        fightLocked: this.fightLocked,
        hard: this.hard,
        // Enough to ACT straight away after a retry.
        tp: this.phase >= 5 ? 60 : 40,
      };
    }
    waveDamage() {
      const d = [0, 28, 30, 32, 34, 36, 38][this.phase];
      return this.hard ? Math.round(d * 1.5) : d;
    }

    // ---- main flow ---------------------------------------------------------------
    *mainFlow() {
      yield* DF.Cutscenes.intro(this, this.opts);
      for (;;) {
        yield* this.partyTurn();
        yield* this.doActions();
        if (this.ended) return;
        if (this.startClimb) {
          yield* DF.Cutscenes.climb(this);
          return;
        }
        const P = DF.PHASES[this.phase];
        if (this.phase < 6 && this.flowery.mercy >= P.cap) {
          // HARD MODE: once per phase, FLOWERY LOADs his SAVE and takes the MERCY back.
          let loaded = false;
          if (this.hard && !this.loads[this.phase]) {
            this.loads[this.phase] = true;
            loaded = yield* DF.Cutscenes.determination(this);
          }
          if (!loaded) {
            this.phase++;
            this.phaseTurn = 0;
            this.enemyTurns = 0;
            yield* DF.Cutscenes['phase' + this.phase](this);
            this.saveCheckpoint();
            if (this.hard) yield* DF.Cutscenes.hardSave(this);
          }
        }
        yield* this.enemyTalk();
        yield* this.enemyTurn();
        if (this.gameOverFlag) return;
      }
    }

    *partyTurn() {
      this.turn++;
      this.phaseTurn++;
      this.stats.turns++;
      for (const m of this.party) {
        if (m.down) {
          const was = m.hp;
          m.hp = Math.min(m.maxhp, m.hp + Math.ceil(m.maxhp / 8));
          if (m.hp > 0 && was <= 0) {
            this.fx.msg(m.x + 36, m.y - 44, 'msg/up');
            Audio.play('power', { vol: 0.5 });
          }
        }
        m.defending = false;
        m.headIcon = 'head';
        m.resetAnim();
      }
      this.actions = this.party.map(() => null);
      this.showUI(true);
      this.setFlavor();
      this.current = this.nextSelectable(0);
      this.selectDone = false;
      if (this.current < 0) this.selectDone = true;
      this.menu = { mode: 'ACTION' };
      this.state = 'SELECT';
      yield () => this.selectDone;
      this.state = 'ACTING';
      this.menu = null;
      this.current = -1;
      this.tpPreview = 0;
    }

    setFlavor(text) {
      const P = DF.PHASES[this.phase];
      if (!text) text = this.nextFlavor || (this.turn === 1 && this.phaseTurn === 1 && this.phase === 1 ? '* FLOWERY blocks the way!\n* (Every ACT but Check costs TP.\n  DEFEND and graze to earn it!)' : U.choose(P.flavor));
      this.nextFlavor = null;
      this.flavorText = text;
      this.textbox.typer = new DF.Typer(text, { x: 30, y: 378, width: 590, font: 'mono', size: 32, lineH: 32, speed: 40 });
      this.textbox.face = null;
    }

    nextSelectable(from) {
      for (let i = from; i < this.party.length; i++) {
        const m = this.party[i];
        if (!m.down && !(this.actions[i] && this.actions[i].type === 'busy')) return i;
      }
      return -1;
    }
    prevSelectable(from) {
      for (let i = from; i >= 0; i--) {
        const m = this.party[i];
        if (!m.down && !(this.actions[i] && this.actions[i].type === 'busy')) return i;
      }
      return -1;
    }

    buttonsFor(m) {
      return ['fight', m.def.hasAct ? 'act' : 'magic', 'item', 'spare', 'defend'];
    }

    // ---- menu input ----------------------------------------------------------------
    updateMenu() {
      const menu = this.menu;
      if (menu && menu.mode === 'CHOICE') {
        this.updateChoice(menu);
        return;
      }
      if (!menu || this.current < 0) return;
      const m = this.party[this.current];
      if (menu.mode === 'ACTION') {
        const btns = this.buttonsFor(m);
        let sel = this.lastBtn[m.id] || 0;
        if (Input.pressed('left')) {
          sel = (sel + btns.length - 1) % btns.length;
          Audio.play('ui_move');
        } else if (Input.pressed('right')) {
          sel = (sel + 1) % btns.length;
          Audio.play('ui_move');
        }
        this.lastBtn[m.id] = sel;
        if (Input.pressed('confirm')) this.pickButton(m, btns[sel]);
        else if (Input.pressed('cancel')) this.undoPrevious();
      } else if (menu.mode === 'ENEMY') {
        const list = this.enemies;
        const n = list.length;
        if (Input.pressed('up') || Input.pressed('down')) {
          const dir = Input.pressed('up') ? -1 : 1;
          let i = menu.sel;
          for (let k = 0; k < n; k++) {
            i = (i + dir + n) % n;
            if (list[i].selectable && list[i].visible !== false) break;
          }
          if (i !== menu.sel) Audio.play('ui_move');
          menu.sel = i;
        }
        if (Input.pressed('confirm')) {
          const e = list[menu.sel];
          if (!e.selectable) {
            Audio.play('ui_cant');
            return;
          }
          Audio.play('ui_select');
          menu.onPick(e);
        } else if (Input.pressed('cancel')) {
          Audio.play('ui_cancel', { vol: 0.7 });
          this.menu = menu.back || { mode: 'ACTION' };
          this.tpPreview = 0;
        }
      } else if (menu.mode === 'LIST') {
        const items = menu.items;
        const n = items.length;
        let s = menu.sel;
        const col = s % 2;
        if (Input.pressed('left') || Input.pressed('right')) {
          const t = col === 0 ? s + 1 : s - 1;
          if (t >= 0 && t < n) {
            s = t;
            Audio.play('ui_move');
          }
        } else if (Input.pressed('up')) {
          if (s - 2 >= 0) {
            s -= 2;
            Audio.play('ui_move');
          }
        } else if (Input.pressed('down')) {
          if (s + 2 < n) {
            s += 2;
            Audio.play('ui_move');
          } else if (col === 1 && s + 1 < n) {
            s = n - 1;
            Audio.play('ui_move');
          }
        }
        menu.sel = s;
        const it = items[s];
        this.tpPreview = it && it.tp ? it.tp : 0;
        if (Input.pressed('confirm')) {
          if (!it || it.disabled || (it.tp && it.tp > this.tp + 0.001)) {
            Audio.play('ui_cant');
            return;
          }
          Audio.play('ui_select');
          menu.onPick(it);
        } else if (Input.pressed('cancel')) {
          Audio.play('ui_cancel', { vol: 0.7 });
          this.menu = menu.back || { mode: 'ACTION' };
          this.tpPreview = 0;
        }
      } else if (menu.mode === 'PARTY') {
        const n = this.party.length;
        if (Input.pressed('up')) {
          menu.sel = (menu.sel + n - 1) % n;
          Audio.play('ui_move');
        } else if (Input.pressed('down')) {
          menu.sel = (menu.sel + 1) % n;
          Audio.play('ui_move');
        }
        if (Input.pressed('confirm')) {
          Audio.play('ui_select');
          menu.onPick(this.party[menu.sel]);
        } else if (Input.pressed('cancel')) {
          Audio.play('ui_cancel', { vol: 0.7 });
          this.menu = menu.back || { mode: 'ACTION' };
        }
      }
    }

    updateChoice(menu) {
      const n = menu.options.length;
      const s = menu.sel;
      if (Input.pressed('left') || Input.pressed('right')) {
        menu.sel = s % 2 === 0 ? Math.min(n - 1, s + 1) : s - 1;
        Audio.play('ui_move');
      } else if (Input.pressed('up')) {
        if (s - 2 >= 0) menu.sel = s - 2;
        Audio.play('ui_move');
      } else if (Input.pressed('down')) {
        if (s + 2 < n) menu.sel = s + 2;
        Audio.play('ui_move');
      }
      const typer = this.textbox.typer;
      if (typer && !typer.done && Input.pressed('cancel')) typer.skip();
      if (Input.pressed('confirm') && (!typer || typer.done)) menu.picked = menu.sel;
    }

    enemyMenu(onPick, back) {
      let sel = this.enemies.findIndex((e) => e.selectable);
      if (sel < 0) sel = 0;
      this.menu = { mode: 'ENEMY', sel, onPick, back };
    }

    pickButton(m, btn) {
      const idx = this.current;
      if (btn === 'fight') {
        if (this.fightLocked) {
          Audio.play('ui_cant');
          return;
        }
        Audio.play('ui_select');
        this.enemyMenu((e) => this.commit(idx, { type: 'fight', target: e }, 'attackready', 'attack'));
      } else if (btn === 'act') {
        Audio.play('ui_select');
        this.enemyMenu((e) => this.actList(idx, e), { mode: 'ACTION' });
      } else if (btn === 'magic') {
        Audio.play('ui_select');
        this.spellList(idx);
      } else if (btn === 'item') {
        if (!this.items.length) {
          Audio.play('ui_cant');
          return;
        }
        Audio.play('ui_select');
        this.itemList(idx);
      } else if (btn === 'spare') {
        Audio.play('ui_select');
        this.enemyMenu((e) => this.commit(idx, { type: 'spare', target: e }, 'actready', 'spare'));
      } else if (btn === 'defend') {
        Audio.play('ui_select');
        m.defending = true;
        this.gainTP(16, true);
        this.commit(idx, { type: 'defend', tpGain: 16 }, 'defend', 'defend');
      }
    }

    actList(idx, target) {
      const P = DF.PHASES[this.phase];
      const ids = ['check'].concat(P.acts);
      const items = ids.map((id) => {
        const a = DF.ACTS[id];
        const need = a.party || [];
        const ok = need.every((pid) => {
          const pm = this.member(pid);
          return pm && !pm.down;
        });
        return { id, name: a.name, desc: a.desc, tp: a.tp || 0, party: need, disabled: !ok };
      });
      this.menu = {
        mode: 'LIST',
        kind: 'act',
        sel: 0,
        items,
        back: { mode: 'ENEMY', sel: this.enemies.indexOf(target), onPick: (e) => this.actList(idx, e), back: { mode: 'ACTION' } },
        onPick: (it) => {
          const a = { type: 'act', act: it.id, target, tpSpent: it.tp || 0, busy: it.party };
          if (it.tp) this.tp -= it.tp;
          for (const pid of it.party) {
            const pi = this.party.findIndex((pm) => pm.id === pid);
            if (pi >= 0) {
              this.actions[pi] = { type: 'busy', by: idx };
              this.party[pi].setAnim('actready');
              this.party[pi].headIcon = 'act';
            }
          }
          this.commit(idx, a, 'actready', 'act');
        },
      };
    }

    spellList(idx) {
      const m = this.party[idx];
      const items = m.def.spells.map((id) => {
        const s = DF.SPELLS[id];
        const disabled = (s.damage && this.fightLocked) || false;
        return { id, name: s.name, desc: disabled ? 'Not an\noption\nanymore' : s.desc, tp: s.tp, disabled, spell: s };
      });
      this.menu = {
        mode: 'LIST',
        kind: 'spell',
        sel: 0,
        items,
        back: { mode: 'ACTION' },
        onPick: (it) => {
          const back = this.menu;
          const done = (target) => {
            this.tp -= it.tp;
            this.commit(idx, { type: 'spell', spell: it.id, target, tpSpent: it.tp }, 'spellready', 'spell');
          };
          if (it.spell.target === 'party') {
            this.menu = { mode: 'PARTY', sel: 0, back, onPick: done };
          } else {
            this.enemyMenu(done, back);
          }
        },
      };
    }

    itemList(idx) {
      const items = this.items.map((id, i) => ({ id, slot: i, name: DF.ITEMS[id].name, desc: DF.ITEMS[id].desc, tp: 0 }));
      this.menu = {
        mode: 'LIST',
        kind: 'item',
        sel: 0,
        items,
        back: { mode: 'ACTION' },
        onPick: (it) => {
          const def = DF.ITEMS[it.id];
          const take = (target) => {
            const slot = this.items.indexOf(it.id);
            if (slot >= 0) this.items.splice(slot, 1);
            this.commit(idx, { type: 'item', item: it.id, target }, 'itemready', 'item');
          };
          if (def.all) take(null);
          else this.menu = { mode: 'PARTY', sel: 0, back: this.menu, onPick: take };
        },
      };
    }

    commit(idx, action, anim, icon) {
      const m = this.party[idx];
      this.actions[idx] = action;
      m.setAnim(anim);
      m.headIcon = icon;
      this.tpPreview = 0;
      const next = this.nextSelectable(idx + 1);
      if (next < 0) {
        this.selectDone = true;
        this.current = -1;
        this.menu = null;
      } else {
        this.current = next;
        this.menu = { mode: 'ACTION' };
      }
    }

    undoPrevious() {
      const j = this.prevSelectable(this.current - 1);
      if (j < 0) return;
      Audio.play('ui_cancel', { vol: 0.7 });
      const a = this.actions[j];
      if (a) {
        if (a.tpSpent) this.tp += a.tpSpent;
        if (a.tpGain) this.tp = Math.max(0, this.tp - a.tpGain);
        if (a.type === 'item') this.items.push(a.item);
        if (a.type === 'defend') this.party[j].defending = false;
        if (a.busy) {
          this.actions.forEach((b, k) => {
            if (b && b.type === 'busy' && b.by === j) {
              this.actions[k] = null;
              this.party[k].setAnim('idle');
              this.party[k].headIcon = 'head';
            }
          });
        }
      }
      this.actions[j] = null;
      this.party[j].setAnim('idle');
      this.party[j].headIcon = 'head';
      this.current = j;
      this.menu = { mode: 'ACTION' };
    }

    // ---- action execution ---------------------------------------------------------------
    *doActions() {
      const pick = (types) =>
        this.party
          .map((m, i) => ({ m, a: this.actions[i] }))
          .filter((x) => x.a && types.indexOf(x.a.type) >= 0 && !x.m.down);
      for (const { m, a } of pick(['act'])) yield* DF.Cutscenes.act(this, m, a);
      if (this.ended || this.startClimb) return;
      for (const { m, a } of pick(['spell', 'item', 'spare'])) yield* this.doMisc(m, a);
      const fighters = pick(['fight']);
      if (fighters.length) yield* this.doFight(fighters);
      for (const m of this.party) if (!m.defending) m.resetAnim();
      this.clearText();
    }

    *doMisc(m, a) {
      if (a.type === 'spare') {
        m.setAnim('act');
        Audio.play('spare', { vol: 0.5 });
        yield* this.say('* ' + m.name + ' spared ' + a.target.name.toUpperCase() + '!\n* ...But his MERCY isn\'t full yet.');
        m.resetAnim();
        return;
      }
      if (a.type === 'item') {
        const def = DF.ITEMS[a.item];
        m.setAnim('item');
        Audio.play('item', { vol: 0.6 });
        const targets = def.all ? this.party.slice() : [a.target];
        yield 0.2;
        for (const t of targets) {
          if (def.heal === 'revive') this.heal(t, t.down ? t.maxhp - t.hp : Math.ceil(t.maxhp / 2));
          else this.heal(t, def.heal);
        }
        yield* this.say('* ' + m.name + ' used the ' + def.name.toUpperCase() + '!' + (def.all ? '\n* Everyone recovered HP!' : '\n* ' + a.target.name + ' recovered HP!'));
        m.resetAnim();
        return;
      }
      // Spells.
      const sp = DF.SPELLS[a.spell];
      m.setAnim('spell');
      Audio.play('spellcast', { vol: 0.7 });
      if (a.spell === 'rudebuster') {
        yield* this.rudeBuster(m, a.target);
        return;
      }
      if (a.spell === 'pacify') {
        yield* this.say('* ' + m.name + ' cast PACIFY!\n* ...But ' + a.target.name.toUpperCase() + " wasn't TIRED.");
        m.resetAnim();
        return;
      }
      const amount = a.spell === 'healprayer' ? m.def.mg * 5 + 10 : 38 + U.randInt(0, 6);
      yield 0.25;
      this.heal(a.target, amount);
      yield* this.say('* ' + m.name + ' cast ' + sp.name.toUpperCase() + '!');
      m.resetAnim();
    }

    *rudeBuster(m, target) {
      m.setAnim('rudebuster');
      Audio.play('rudebuster_swing', { vol: 0.8 });
      yield 0.35;
      const c = target.center();
      this.fx.add({
        x: m.x + 40, y: m.y - 50, life: 0.5, layer: 'top', fade: false,
        draw: (p) => {
          const k = U.ease.inQuad(Math.min(1, p.t / 0.35));
          const x = U.lerp(p.x, c.x, k);
          const y = U.lerp(p.y, c.y, k);
          G.draw(G.frameAt('fx/rudebuster', p.t, 20, true), x, y, { ox: 0.5, oy: 0.5, rot: Math.atan2(c.y - p.y, c.x - p.x) });
        },
      });
      yield 0.35;
      Audio.play('rudebuster_hit', { vol: 0.8 });
      this.fx.screenShake(5);
      const dmg = 120 + U.randInt(0, 30);
      target.shake = 5;
      target.hp = Math.max(1, target.hp - dmg);
      this.fx.number(c.x, c.y - 20, dmg, m.def.dmgColor);
      yield 0.6;
      m.resetAnim();
      if (!this.fightLocked) yield* DF.Cutscenes.fightLock(this, [m]);
    }

    *doFight(fighters) {
      this.clearText();
      const res = yield* DF.Minigames.attack(this, fighters.map((f) => ({ member: f.m, target: f.a.target })));
      if (!this.fightLocked) yield* DF.Cutscenes.fightLock(this, res.map((r) => r.member));
    }

    // ---- enemy side --------------------------------------------------------------------
    *enemyTalk(lines) {
      this.clearText();
      const P = DF.PHASES[this.phase];
      if (!lines && !this.nextTalk && this.hard && this.enemyTurns % 2 === 1) lines = [U.choose(DF.HARD_TALK)];
      lines = lines || this.nextTalk || P.talk[this.enemyTurns % P.talk.length];
      this.nextTalk = null;
      yield* this.talk(lines);
    }

    // Show enemy speech bubbles and wait for [Z].
    *talk(lines, opts) {
      opts = opts || {};
      this.bubbles = [];
      let voiced = false;
      for (const l of lines) {
        const e = this.enemyById(l.who);
        if (!e || !e.visible) continue;
        const p = e.mouthPoint();
        const b = new DF.Bubble(l.text, p.x, p.y, { voice: l.voice ? null : l.who === 'flowery' ? 'voice_default' : 'voice_default' });
        this.bubbles.push(b);
        if (l.voice && !voiced) {
          Audio.voice(l.voice);
          voiced = true;
        }
      }
      if (!this.bubbles.length) return;
      const t0 = DF.time;
      yield () => {
        const typed = this.bubbles.every((b) => b.done);
        if (!typed && Input.pressed('cancel')) this.bubbles.forEach((b) => b.skip());
        return typed && (Input.pressed('confirm') || DF.time - t0 > (opts.auto || 4.5));
      };
      this.bubbles = [];
    }

    *enemyTurn(waveId) {
      const P = DF.PHASES[this.phase];
      const id = waveId || this.forcedWave || P.waves[this.enemyTurns % P.waves.length];
      this.enemyTurns++;
      this.forcedWave = null;
      this.state = 'WAVE';
      const kris = this.member('kris');
      const sp = kris.soulPos();
      const s = this.soul;
      s.x = sp.x;
      s.y = sp.y;
      s.visible = true;
      s.locked = true;
      s.inv = 0;
      this.arena.grow = 0;
      this.arenaVisible = true;
      yield* DF.all(DF.tween(this.arena, { grow: 1 }, 0.3), DF.tween(s, { x: this.arena.L + 42, y: this.arena.cy }, 0.3, 'outCubic'));
      s.place(this.arena);
      s.locked = false;
      this.wave = new DF.Wave(this, id);
      yield () => this.wave.done || this.gameOverFlag;
      this.wave.finish();
      this.wave = null;
      s.locked = true;
      if (this.gameOverFlag) {
        yield* this.gameOver();
        return;
      }
      const back = kris.soulPos();
      yield* DF.all(DF.tween(this.arena, { grow: 0 }, 0.22), DF.tween(s, { x: back.x, y: back.y }, 0.25));
      s.visible = false;
      this.arenaVisible = false;
      this.state = 'ACTING';
    }

    // ---- damage, healing, TP ------------------------------------------------------------
    gainTP(n, silent) {
      const before = this.tp;
      this.tp = U.clamp(this.tp + n, 0, 100);
      if (this.tp > before) this.stats.tpGained += this.tp - before;
      if (!silent && before < 100 && this.tp >= 100) Audio.play('tensionhorn', { vol: 0.35 });
    }
    graze(n, continuous) {
      this.gainTP(n, true);
      this.soul.grazeFlash = 1;
      if (!continuous) Audio.play('graze', { vol: 0.35, minGap: 0.07 });
    }
    hitSoul(dmg) {
      const s = this.soul;
      s.inv = 1.0;
      if (DF.debug && DF.debug.god) return;
      Audio.play('hurt', { vol: 0.8 });
      this.fx.screenShake(3);
      const alive = this.party.filter((m) => !m.down);
      if (!alive.length) return;
      this.damageMember(U.choose(alive), dmg);
      this.stats.hits++;
      if (this.party.every((m) => m.down)) this.gameOverFlag = true;
    }
    damageMember(m, dmg) {
      let d = Math.round(dmg * U.rand(0.92, 1.08));
      if (m.defending) d = Math.ceil((d * 2) / 3);
      d = Math.max(1, d - m.def.df);
      m.hp -= d;
      this.stats.damageTaken += d;
      m.shake = 4;
      this.fx.number(m.x + 34, m.y - 44, d, '#ffffff');
      if (m.hp <= 0) {
        m.hp = -Math.floor(m.maxhp / 2);
        m.setAnim('defeat');
        this.fx.msg(m.x + 34, m.y - 70, 'msg/down');
      } else {
        m.setAnim('hurt');
      }
    }
    heal(m, amount) {
      if (!m) return;
      const was = m.hp;
      m.hp = Math.min(m.maxhp, m.hp + amount);
      const got = m.hp - was;
      Audio.play('power', { vol: 0.6 });
      this.fx.healSparkle(m.x, m.y - 30);
      if (m.hp >= m.maxhp && got > 0) this.fx.msg(m.x + 34, m.y - 44, 'msg/max', { tint: '#80ff80' });
      else this.fx.number(m.x + 34, m.y - 44, got, '#00ff00');
      if (was <= 0 && m.hp > 0) {
        m.setAnim('idle');
        this.fx.msg(m.x + 34, m.y - 70, 'msg/up');
      }
    }
    healLowest(n) {
      const alive = this.party.filter((m) => !m.down);
      if (!alive.length) return;
      alive.sort((a, b) => a.hp / a.maxhp - b.hp / b.maxhp);
      const m = alive[0];
      m.hp = Math.min(m.maxhp, m.hp + n);
      Audio.play('power', { vol: 0.4, minGap: 0.1 });
      this.fx.number(m.x + 34, m.y - 44, n, '#00ff00');
      this.fx.healSparkle(m.x, m.y - 30);
    }
    // Flowery's MERCY is capped per phase; the Flowers go to 100%.
    addMercy(e, amount) {
      const cap = e.id === 'flowery' ? DF.PHASES[this.phase].cap : 100;
      const before = e.mercy;
      e.mercy = U.clamp(e.mercy + amount, 0, cap);
      const got = e.mercy - before;
      const c = e.center();
      if (got > 0) {
        Audio.play('mercyadd', { vol: 0.7 });
        this.fx.number(Math.min(c.x, 594), e.top() + 10, '+' + got + '%', '#ffff00');
      }
      return got;
    }

    // ---- text box ------------------------------------------------------------------
    clearText() {
      this.textbox.typer = null;
      this.textbox.face = null;
    }
    // Show pages of text in the box; each waits for [Z].
    *say(pages, opts) {
      opts = opts || {};
      if (!Array.isArray(pages)) pages = [pages];
      for (const p of pages) {
        const face = opts.face || null;
        this.textbox.face = face;
        this.textbox.typer = new DF.Typer(p, {
          x: face ? 142 : 30, y: 378, width: face ? 480 : 590, font: 'mono', size: 32, lineH: 32,
          speed: opts.speed || 36, voice: opts.voice || 'voice_default',
        });
        yield* this.waitText(opts.auto);
      }
      if (!opts.keep) this.clearText();
    }
    *waitText(auto) {
      const tb = this.textbox;
      let t = 0;
      for (;;) {
        const dt = yield null;
        t += dt || DF.STEP;
        if (!tb.typer) return;
        if (!tb.typer.done) {
          if (Input.pressed('cancel')) tb.typer.skip();
          continue;
        }
        if (Input.pressed('confirm') || (auto && t > auto)) return;
      }
    }
    // Multiple-choice prompt in the text box. Returns the chosen index.
    *choose(prompt, options) {
      this.textbox.face = null;
      this.textbox.typer = new DF.Typer(prompt, { x: 30, y: 378, width: 590, font: 'mono', size: 32, lineH: 32, speed: 40 });
      this.menu = { mode: 'CHOICE', options, sel: 0, picked: -1, lines: this.textbox.typer.lines };
      const prevState = this.state;
      this.state = 'CHOICE';
      yield () => this.menu && this.menu.picked >= 0;
      const pick = this.menu.picked;
      this.menu = null;
      this.state = prevState;
      this.clearText();
      return pick;
    }

    showUI(on) {
      this.uiTarget = on ? 325 : 480;
      this.tpTarget = on ? 0 : -63;
    }

    // ---- game over ------------------------------------------------------------------
    *gameOver() {
      this.state = 'GAMEOVER';
      DF.Music.stop(0.1);
      Audio.stopLoop('wind');
      const s = this.soul;
      s.visible = true;
      this.deathSoul = { x: s.x, y: s.y, broken: false };
      s.visible = false;
      yield 0.6;
      this.deathSoul.broken = true;
      Audio.play('break1', { vol: 0.9 });
      yield 0.9;
      Audio.play('deathnoise', { vol: 0.8 });
      for (let i = 0; i < 6; i++) {
        const ang = U.rand(0, Math.PI * 2);
        const sp = U.rand(80, 200);
        this.fx.add({ frame: 'heart/shard_1', anim: 'heart/shard', fps: 10, loop: true, x: this.deathSoul.x, y: this.deathSoul.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 60, grav: 300, life: 2, tint: '#ffa020', scale: 1, layer: 'top', fade: false });
      }
      this.deathSoul = null;
      yield 1.8;
      this.stats.retries++;
      DF.setScene(new DF.GameOverScene(this.checkpoint, this.stats));
    }

    // ---- per-frame ------------------------------------------------------------------
    update(dt) {
      this.stats.time += dt;
      this.bgT += dt;
      this.selSiner += dt * 60;
      this.uiY = U.approach(this.uiY, this.uiTarget, dt * 900);
      this.tpX = U.approach(this.tpX, this.tpTarget, dt * 500);
      this.tpShown = U.approach(this.tpShown, this.tp, dt * 90);
      const prevState = this.state;
      this.scripts.update(dt);
      // Only read menu input once the menu has been up for a full step, so the [Z]
      // that closed a text box can't also pick a command.
      if ((this.state === 'SELECT' || this.state === 'CHOICE') && prevState === this.state) this.updateMenu();
      for (const m of this.party) m.update(dt);
      for (const e of this.enemies) e.update(dt);
      if (this.ralseiBody) this.ralseiBody.t += dt;
      for (let i = 0; i < this.party.length; i++) {
        const sel = this.state === 'SELECT' && this.current === i;
        this.boxY[i] = U.approach(this.boxY[i], sel ? -32 : 0, dt * 32 * 12);
      }
      if (this.wave) {
        // HARD MODE runs the attacks faster; the SOUL keeps its own pace.
        this.arena.update(dt * this.waveSpeed);
        this.soul.update(dt, this.arena);
        this.wave.update(dt * this.waveSpeed);
      } else if (this.soul.visible && !this.soul.locked) {
        this.soul.update(dt, this.arena);
      }
      if (this.climb) this.climb.update(dt);
      for (const b of this.bubbles) b.update(dt);
      if (this.textbox.typer) this.textbox.typer.update(dt);
      this.fx.update(dt);
      if (Input.pressed('mute')) DF.Audio.toggleMute();
    }

    draw() {
      DF.BattleView.draw(this);
    }
  }

  // Where a speech bubble should point for an enemy.
  DF.EnemyBattler.prototype.mouthPoint = function () {
    const s = G.size(this.frame());
    const k = this.mouthK || 0.78;
    return { x: Math.round(this.x + this.offX - (s.w * this.scale) / 2 + 4), y: Math.round(this.y + this.offY - s.h * this.scale * k) };
  };

  DF.Battle = Battle;
})();
