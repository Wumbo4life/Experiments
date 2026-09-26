/* Device_Flower - story beats: intro, phase changes, ACT reactions, the FIGHT lock, the climb. */
(function () {
  'use strict';
  const DF = window.DF;
  const G = DF.G;
  const U = DF.U;
  const Audio = DF.Audio;
  const MG = DF.Minigames;

  const C = (DF.Cutscenes = {});

  // Show text in the box without waiting (used while a minigame runs).
  function note(bt, text) {
    bt.textbox.face = null;
    bt.textbox.typer = new DF.Typer(text, { x: 30, y: 378, width: 590, font: 'mono', size: 32, lineH: 32, speed: 60 });
  }

  // ---- intro ----------------------------------------------------------------------------
  C.intro = function* (bt, opts) {
    const fl = bt.flowery;
    if (opts.retry) {
      bt.fade = 1;
      for (const m of bt.party) m.setAnim('idle');
      if (bt.phase >= 6) {
        bt.ralseiBody = { x: 104, y: 318, t: 0 };
        DF.Music.play('battle', { section: 'chorus3' });
      } else DF.Music.play('battle', { section: bt.phase >= 3 ? 'riff' : 'intro' });
      yield* DF.tween(bt, { fade: 0 }, 0.5);
      if (bt.hard) {
        yield* bt.talk([{ who: 'flowery', text: 'Welcome back!\nI LOADED my SAVE\ntoo! Round two!', voice: 'vc_hah' }]);
        bt.nextFlavor = '* FLOWERY LOADED his SAVE.\n* (Phase ' + bt.phase + ' of 6)';
        return;
      }
      yield* bt.talk([{ who: 'flowery', text: 'Sorry to keep you\nwaiting! Round two!', voice: 'vc_sorrytokeepyouwaiting2' }]);
      bt.nextFlavor = '* FLOWERY is back on his feet.\n* (Phase ' + bt.phase + ' of 6)';
      return;
    }
    bt.fade = 1;
    fl.alpha = 0;
    bt.party.forEach((m, i) => {
      m.slideX = -240 - i * 50;
      m.setAnim(m.id === 'susie' ? 'attack' : 'intro');
    });
    yield* DF.tween(bt, { fade: 0 }, 0.6);
    Audio.play('weaponpull', { vol: 0.8 });
    yield* DF.all(...bt.party.map((m, i) => DF.tween(m, { slideX: 0 }, 0.45 + i * 0.08, 'outCubic')));
    yield 0.35;
    for (const m of bt.party) m.setAnim('idle');
    yield 0.3;
    Audio.play('bounceflower', { vol: 0.9 });
    bt.fx.petalBurst(fl.x, fl.y - 60, 26);
    bt.fx.screenFlash('#ffffff', 0.6, 3);
    fl.alpha = 1;
    fl.flash = 1;
    fl.setPose('flowery/pose_1', 1, false, true);
    yield 0.35;
    DF.Music.play('battle');
    yield* bt.talk([{ who: 'flowery', text: 'Sorry to keep\nyou waiting!', voice: 'vc_sorrytokeepyouwaiting1' }]);
    fl.idle();
    yield* bt.talk([{ who: 'flowery', text: "Your dad's my best\nfriend, Kris! So I\ncan't let you close\nthat Fountain!", voice: 'vc_yourdadsmybestfriend' }]);
    if (bt.hard) {
      fl.flash = 1;
      bt.fx.screenFlash('#ff2020', 0.5, 2);
      Audio.play('sparkle_gem', { vol: 0.7 });
      yield* bt.say(['* FLOWERY is filled with\n  DETERMINATION.', '* (HARD MODE: faster attacks,\n  harder hits... and he can LOAD.)']);
    }
  };

  // ---- HARD MODE: the power of DETERMINATION -------------------------------------------
  // At the MERCY cap FLOWERY LOADs his SAVE, once per phase. Returns true if he did.
  C.determination = function* (bt) {
    const fl = bt.flowery;
    const cap = DF.PHASES[bt.phase].cap;
    if (bt.phase === 5) {
      // A verdict can't be LOADed away.
      yield* bt.talk([{ who: 'flowery', text: 'Objection!\nI LOAD my SAVE\nand-', voice: 'vc_hah' }]);
      yield* bt.talk([{ who: 'yellow', text: "Nuh-uh, pardner.\nA verdict's a\nverdict." }]);
      yield* bt.say('* The verdict stands.\n* It could not be LOADED away.');
      return false;
    }
    yield* bt.talk([{ who: 'flowery', text: U.choose(['Heh! Nice try!\nBut I SAVED right\nbefore that!', "Nope! Not today!\nI've got a SAVE\nFILE, remember?", 'Whoops! Let me\njust... LOAD!']), voice: 'vc_hah' }]);
    Audio.play('noise', { vol: 0.5 });
    Audio.play('wing', { vol: 0.6, pitch: 0.5 });
    const to = cap - 5;
    bt.rewind = { t: 0, from: fl.mercy, to };
    yield* DF.tween(bt.rewind, { t: 1 }, 1.3, 'inOutQuad');
    fl.mercy = to;
    bt.rewind = null;
    fl.flash = 1;
    bt.fx.screenFlash('#ff2020', 0.6, 2.5);
    bt.fx.screenShake(6);
    Audio.play('sparkle_gem', { vol: 0.7 });
    bt.fx.label(Math.min(fl.center().x, 580), fl.top() + 10, '-5% MERCY', '#ff4040', { size: 16, life: 1.2 });
    yield* bt.say(['* FLOWERY LOADED his SAVE!', '* His MERCY fell back to ' + to + '%.\n* (He can only LOAD once a phase.)']);
    return true;
  };

  // After each phase change in HARD MODE, FLOWERY SAVEs over your file.
  C.hardSave = function* (bt) {
    const c = bt.flowery.center();
    Audio.play('sparkle_gem', { vol: 0.7 });
    bt.fx.sparkles(c.x, c.y, 10, '#ff4040', 140);
    yield* bt.say('* (FLOWERY is filled with\n  DETERMINATION.)\n* (FLOWERY SAVED the game.)');
  };

  // ---- allies come and go --------------------------------------------------------------
  function* bringAllies(bt, ids) {
    bt.placeAllies(ids, false);
    Audio.play('bounceflower_quick', { vol: 0.8 });
    yield* DF.all(...bt.allies().map((e) => DF.tween(e, { offX: 0 }, 0.55, 'outBack')));
    for (const e of bt.allies()) {
      const c = e.center();
      bt.fx.sparkles(c.x, c.y, 8, DF.GANG[e.id].color, 120);
    }
    Audio.play('sparkle', { vol: 0.5 });
  }
  function* retireAllies(bt, text) {
    const allies = bt.allies();
    for (const e of allies) e.mercy = 100;
    yield* bt.say(text);
    Audio.play('spare', { vol: 0.6 });
    for (const e of allies) {
      const c = e.center();
      bt.fx.sparkles(c.x, c.y, 10, '#ffffff', 140);
    }
    yield* DF.all(...allies.map((e) => DF.tween(e, { offX: 260, alpha: 0 }, 0.5, 'inQuad')));
    bt.enemies = bt.enemies.filter((e) => e.id === 'flowery');
  }

  // ---- phase transitions -----------------------------------------------------------------
  C.phase2 = function* (bt) {
    const fl = bt.flowery;
    fl.setPose('flowery/pose_1', 1, false, true);
    yield* bt.talk([{ who: 'flowery', text: 'Hah! Great style!\nBut can you keep up\nwith THIS?', voice: 'vc_great_style' }]);
    fl.setPose('flowery/run', 16, true, false);
    Audio.play('wing', { vol: 0.7 });
    yield* DF.tween(fl, { x: 590 }, 0.5, 'outCubic');
    fl.idle();
    bt.blowBase = 590;
    yield* bt.say('* FLOWERY dashed to the far side of the field!');
    bt.nextFlavor = '* FLOWERY is keeping his distance.\n* (Maybe you could [c:yellow]BLOW[/c] him back?)';
  };

  C.phase3 = function* (bt) {
    yield* bt.talk([{ who: 'flowery', text: "Okay, okay! I'm\ncalling for help!", voice: 'vc_calling_for_help' }]);
    yield* bringAllies(bt, ['aqua', 'seth']);
    yield* bt.talk([
      { who: 'aqua', text: 'Aqua, reporting\nfor duty~!' },
      { who: 'seth', text: 'I brought notes.' },
    ]);
    yield* bt.say('* AQUA and SETH joined the fight!');
    bt.nextFlavor = "* AQUA and SETH can't be targeted...\n* (But a good [c:yellow]SPIN[/c] might dazzle everyone!)";
  };

  C.phase4 = function* (bt) {
    yield* retireAllies(bt, '* AQUA and SETH are all tuckered out!\n* They step back to cheer instead.');
    yield* bt.talk([{ who: 'flowery', text: "Hey boys!\nYou're up!", voice: 'vc_hey_boys' }]);
    yield* bringAllies(bt, ['orange', 'green']);
    yield* bt.talk([
      { who: 'orange', text: "I-I'm not scared\nof you!" },
      { who: 'green', text: '...Hello.' },
    ]);
    yield* bt.say('* ORANGE and GREEN joined the fight!');
    bt.nextFlavor = '* ORANGE and GREEN look like they could\n  use some [c:yellow]PRAISE[/c].';
  };

  C.phase5 = function* (bt) {
    yield* retireAllies(bt, "* ORANGE and GREEN are worn out!\n* GREEN leaves snacks on the way out.");
    for (const m of bt.party) if (!m.down) bt.heal(m, 30);
    yield 0.5;
    yield* bt.talk([{ who: 'flowery', text: 'Now for my\nfavorite two!', voice: 'vc_my_favorite_two' }]);
    yield* bringAllies(bt, ['yellow', 'blue']);
    yield* bt.talk([
      { who: 'yellow', text: "Howdy! The law's\nin town!" },
      { who: 'blue', text: 'Integrity. Always.' },
    ]);
    yield* bt.say(['* YELLOW and BLUE joined the fight!', '* (JUSTICE needs [c:yellow]100% TP[/c].\n* Graze, parry and DEFEND to build it!)']);
  };

  C.phase6 = function* (bt) {
    const fl = bt.flowery;
    yield* retireAllies(bt, '* YELLOW and BLUE are out of steam!');
    yield* bt.talk([{ who: 'flowery', text: "Everyone's worn out?\nThen I'll finish\nthis myself!", voice: 'vc_huhillshowyou' }]);
    DF.Music.jumpTo('pre2');
    const kris = bt.member('kris');
    const ral = bt.member('ralsei');
    // A plain JARONA straight at Kris. Ralsei gets there first.
    fl.setPose('flowery/powerup', 12, true, true);
    fl.glow = 0.5;
    Audio.play('charge', { vol: 0.6 });
    yield 0.8;
    fl.visible = false;
    fl.glow = 0;
    const c = fl.center();
    const dash = { x: c.x, y: c.y, trail: [], t: 0 };
    bt.overlay = {
      draw() {
        for (const p of dash.trail) G.drawFill(G.frameAt('flowery/jarona', p.t, 18, true), p.x, p.y, '#ffffff', { scale: 1.6, ox: 0.5, oy: 0.5, alpha: 0.25 });
        G.drawFill(G.frameAt('flowery/jarona', dash.t, 18, true), dash.x, dash.y, '#ffffff', { scale: 1.6, ox: 0.5, oy: 0.5 });
      },
    };
    const trail = new DF.Script(
      (function* () {
        for (;;) {
          const dt = yield null;
          dash.t += dt || DF.STEP;
          dash.trail.push({ x: dash.x, y: dash.y, t: dash.t });
          if (dash.trail.length > 6) dash.trail.shift();
        }
      })()
    );
    bt.scripts.list.push(trail);
    Audio.voice('fl_jarona2');
    const target = ral || kris;
    if (ral) {
      ral.setAnim('defend');
      Audio.play('jump', { vol: 0.7 });
      yield* DF.all(DF.tween(ral, { x: kris.x + 70, y: kris.y + 12 }, 0.25, 'outQuad'), DF.tween(dash, { x: kris.x + 170, y: kris.y - 40 }, 0.25, 'inQuad'));
    }
    yield* DF.tween(dash, { x: target.x + 40, y: target.y - 40 }, 0.12, 'inQuad');
    Audio.play('impact', { vol: 0.9 });
    Audio.play('damage', { vol: 0.8 });
    bt.fx.hit(target.x + 20, target.y - 40, 1);
    bt.fx.screenShake(10);
    bt.fx.screenFlash('#ffffff', 0.7, 3);
    yield* DF.tween(dash, { x: 700, y: dash.y - 120 }, 0.35, 'outQuad');
    trail.stop();
    bt.overlay = null;
    fl.visible = true;
    fl.flash = 1;
    fl.idle();
    bt.fx.petalBurst(fl.center().x, fl.center().y, 8);
    if (ral) {
      bt.fx.number(ral.x + 34, ral.y - 44, ral.hp, '#ffffff');
      bt.fx.msg(ral.x + 34, ral.y - 70, 'msg/down');
      bt.party = bt.party.filter((m) => m !== ral);
      bt.ralseiBody = { x: ral.x, y: ral.y, t: 0 };
      yield* DF.tween(bt.ralseiBody, { x: 104, y: 318 }, 0.6, 'outQuad');
      Audio.play('splat', { vol: 0.6 });
      bt.ralseiOut = true;
      const olds = bt.party.map((m) => ({ m, x: m.x, y: m.y }));
      bt.layoutParty();
      const targets = bt.party.map((m) => ({ x: m.x, y: m.y }));
      olds.forEach((o) => {
        o.m.x = o.x;
        o.m.y = o.y;
      });
      yield* DF.all(...olds.map((o, i) => DF.tween(o.m, targets[i], 0.4, 'outCubic')));
      yield* bt.say(['* Ralsei threw himself in front of Kris!', '* Ralsei was knocked out!']);
      yield* bt.say("[v:voice_susie]* Susie: RALSEI!!\n* ...Okay. NOW I'm mad.");
      yield* bt.talk([{ who: 'flowery', text: 'Sorry about that,\nlittle guy!', voice: 'vc_sorryaboutthatlittleguy' }]);
    }
    yield* bt.talk([{ who: 'flowery', text: "I'm only trying\nto help you!\nI'll stop you, no\nmatter what!", voice: 'vc_im_only_trying_to_help_you' }]);
    yield* bt.say(["[v:voice_susie]* Susie: Kris. You and me.\n* We're closing that Fountain. Together.", '* Kris and Susie stand alone.']);
    DF.Music.jumpTo('chorus3');
    bt.nextFlavor = "* Susie is itching to try something.\n* ([c:yellow]Susie'sIdea[/c] needs 60% TP.)";
  };

  // ---- ACTs ----------------------------------------------------------------------------
  C.act = function* (bt, m, a) {
    const act = DF.ACTS[a.act];
    const all = [m].concat((act.party || []).map((pid) => bt.member(pid)).filter(Boolean));
    for (const x of all) x.setAnim('act');
    switch (a.act) {
      case 'check':
        yield* bt.say(DF.PHASES[bt.phase].check);
        break;
      case 'posey':
      case 'poseyz':
        yield* actPosey(bt, a.act === 'poseyz');
        break;
      case 'blowaway':
      case 'blowawayz':
        yield* actBlow(bt, a.act === 'blowawayz');
        break;
      case 'spin':
      case 'spinz':
        yield* actSpin(bt, a.act === 'spinz');
        break;
      case 'praise':
      case 'praisez':
        yield* actPraise(bt, a.act === 'praisez');
        break;
      case 'justice':
        yield* actJustice(bt);
        break;
      case 'susieidea':
        bt.startClimb = true;
        break;
    }
    for (const x of all) if (!x.down) x.setAnim('actend');
  };

  function* actPosey(bt, z) {
    const fl = bt.flowery;
    note(bt, z ? '* Everyone gets ready to strike a pose!\n* Press [Z] when the marker hits the middle!' : '* Kris gets ready to strike a pose!\n* Press [Z] when the marker hits the middle!');
    const r = yield* MG.posey(bt, { z });
    bt.clearText();
    fl.setPose('flowery/pose_1', 1, false, true);
    fl.flash = 0.8;
    bt.fx.sparkles(fl.center().x, fl.center().y, 12, '#ffff80', 150);
    bt.addMercy(fl, r.mercy);
    Audio.voice(r.perfect ? 'vc_great_style' : r.mercy >= 6 ? 'vc_thatsgreat' : 'vc_hah');
    yield 0.5;
    let text;
    if (r.perfect) text = z ? '* A flawless team pose!\n* FLOWERY is moved to tears!' : '* A flawless pose!\n* FLOWERY is deeply impressed!';
    else if (r.mercy >= 6) text = '* FLOWERY strikes a pose right back!';
    else text = '* FLOWERY politely applauds your pose.';
    yield* bt.say(text);
    fl.idle();
  }

  function* actBlow(bt, z) {
    const fl = bt.flowery;
    note(bt, z ? '* Everyone pulls together!\n* MASH [Z] to drag FLOWERY back!' : '* Kris tries to reel FLOWERY back in!\n* MASH [Z]!');
    fl.setPose('flowery/idle', 16, true, false);
    const r = yield* MG.blowaway(bt, { z });
    bt.clearText();
    const base = bt.blowBase || fl.x;
    if (r.success) {
      Audio.voice(U.choose(['vc_nonono', 'vc_hoo']));
      bt.blowBase = Math.max(505, base - 43);
    } else {
      Audio.voice('vc_forget_it');
    }
    yield* DF.tween(fl, { x: bt.blowBase || base }, 0.35, 'outCubic');
    fl.idle();
    bt.addMercy(fl, r.mercy);
    yield* bt.say(r.success ? '* FLOWERY got dragged closer!' : '* FLOWERY slipped back to his spot...');
  }

  function* actSpin(bt, z) {
    const fl = bt.flowery;
    note(bt, z ? '* Everyone spins together!\n* Roll the arrow keys around the circle!' : '* Kris starts to spin!\n* Roll the arrow keys around the circle!');
    const r = yield* MG.spin(bt, { z });
    bt.clearText();
    if (r.mercy > 0) {
      Audio.voice('vc_yes');
      fl.setPose('flowery/pose_1', 1, false, true);
      bt.fx.sparkles(fl.center().x, fl.center().y, 10, '#80ffff', 140);
    }
    bt.addMercy(fl, r.mercy);
    for (const e of bt.allies()) bt.addMercy(e, r.mercy * 10);
    const text = r.rotations >= 3 ? '* A dazzling spin!\n* Everyone is dizzy with delight!' : r.rotations >= 1 ? '* A decent spin.\n* The Flowers clap politely.' : '* Kris got dizzy...';
    yield* bt.say(text);
    fl.idle();
  }

  function* actPraise(bt, z) {
    const fl = bt.flowery;
    note(bt, z ? '* Everyone showers FLOWERY with praise!\n* Press the arrows in order!' : '* Kris compliments FLOWERY!\n* Press the arrows in order!');
    const r = yield* MG.praise(bt, { z });
    bt.clearText();
    if (r.correct === r.total) {
      Audio.voice('vc_youre_a_hero');
      fl.setPose('flowery/pose_1', 1, false, true);
    } else Audio.voice('vc_say_that_again');
    bt.addMercy(fl, r.mercy);
    for (const e of bt.allies()) bt.addMercy(e, r.mercy * 10);
    const text = r.correct === r.total ? '* Perfect praise!\n* ORANGE and GREEN are blushing too!' : '* Some of the compliments landed.';
    yield* bt.say(text);
    fl.idle();
  }

  function* actJustice(bt) {
    const r = yield* MG.justice(bt);
    bt.addMercy(bt.flowery, r.mercy);
    for (const e of bt.allies()) bt.addMercy(e, 100);
    yield* bt.say('* JUSTICE was served!');
  }

  // ---- FIGHT gets locked -------------------------------------------------------------------
  C.fightLock = function* (bt, attackers) {
    bt.fightLocked = true;
    const fl = bt.flowery;
    yield 0.2;
    Audio.voice('fl_huh');
    yield 0.8;
    const healers = ['susie', 'ralsei'].map((id) => bt.member(id)).filter((m) => m && !m.down);
    if (healers.length) {
      for (const h of healers) h.setAnim(h.id === 'ralsei' ? 'spell' : 'act');
      Audio.play('spellcast', { vol: 0.7 });
      yield 0.35;
      const amt = fl.maxhp - fl.hp;
      fl.hp = fl.maxhp;
      bt.fx.healSparkle(fl.x, fl.y - 60);
      Audio.play('power', { vol: 0.7 });
      bt.fx.number(fl.x, fl.top() + 10, amt, '#00ff00');
      yield* bt.say('* ' + healers.map((h) => h.name).join(' and ') + ' healed FLOWERY!?');
    }
    const lines = [];
    const kris = bt.member('kris');
    const susie = bt.member('susie');
    const ralsei = bt.member('ralsei');
    if (attackers.indexOf(kris) >= 0 && susie && !susie.down && attackers.indexOf(susie) < 0) lines.push("[v:voice_susie]* Susie: Kris, what the hell!?\n* We're NOT doing that!");
    if (susie && attackers.indexOf(susie) >= 0) lines.push('[v:voice_susie]* Susie: ...Tch. Fine.\n* No hitting the flower guy.');
    if (ralsei && !ralsei.down) lines.push("[v:voice_ralsei]* Ralsei: Let's find a gentler way...!");
    lines.push('* (FIGHT has been locked.)');
    yield* bt.say(lines);
    for (const h of healers) h.resetAnim();
  };

  // ---- Susie's Idea -> the climb --------------------------------------------------------------
  C.climb = function* (bt) {
    const kris = bt.member('kris');
    const susie = bt.member('susie');
    const fl = bt.flowery;
    yield* bt.say(["[v:voice_susie]* Susie: Kris! I got an idea!", "[v:voice_susie]* Susie: The Fountain's way up there, right?\n* ...Hold still."]);
    Audio.play('grab', { vol: 0.8 });
    kris.override = { frame: 'kplat/ball_1', dx: 0, dy: -4, rot: 0 };
    yield 0.35;
    if (susie) susie.setAnim('attackready');
    yield 0.45;
    if (susie) susie.setAnim('attack');
    Audio.play('heavyswing', { vol: 0.9 });
    bt.fx.screenShake(5);
    const ko = kris.override;
    const spin = new DF.Script(
      (function* () {
        for (;;) {
          const dt = yield null;
          ko.rot += (dt || DF.STEP) * 20;
          ko.frame = G.frameAt('kplat/ball', DF.time, 16, true);
        }
      })()
    );
    bt.scripts.list.push(spin);
    yield* DF.tween(ko, { dy: -560, dx: 60 }, 0.7, 'inQuad');
    spin.stop();
    kris.visible = false;
    fl.shake = 3;
    yield* bt.talk([{ who: 'flowery', text: "Huh!? Kris!?\nWhere are you going?!", voice: 'fl_huh' }]);
    yield* bt.say("[v:voice_susie]* Susie: GO, KRIS! Climb!\n* I'll hold flower boy off!");
    bt.showUI(false);
    DF.Music.jumpTo('chorus3');
    DF.Music.setTempo(1.08);
    yield* DF.tween(bt, { fade: 1 }, 0.4);
    bt.climb = new DF.Climb(bt);
    kris.visible = true;
    kris.override = null;
    yield* DF.tween(bt, { fade: 0 }, 0.4);
    yield () => bt.climb.done;
    if (bt.climb.failed) {
      bt.climb = null;
      yield* bt.gameOver();
      return;
    }
    // OMEGA FLOWERY formed at the top: the last stretch is a run along the castle roof.
    bt.climb = new DF.Finale(bt);
    yield () => bt.climb.done;
    if (bt.climb.failed) {
      bt.climb = null;
      yield* bt.gameOver();
      return;
    }
    bt.ended = true;
    DF.setScene(new DF.EndingScene(bt.stats, { hard: bt.hard }));
  };
})();
