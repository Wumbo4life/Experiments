/* Device_Flower - party, items, spells, and the text of the fight. */
(function () {
  'use strict';
  const DF = window.DF;

  // Sprite offsets (in 1x pixels) per animation, from Kristal's actor data.
  DF.PARTY = {
    kris: {
      name: 'Kris',
      color: '#00ffff',
      attackBar: '#00a2e8',
      dmgColor: '#80ffff',
      maxhp: 240,
      at: 18,
      df: 3,
      mg: 0,
      hasAct: true,
      hasMagic: false,
      voice: 'voice_default',
      w: 19,
      h: 37,
      soul: [10, 24],
      offsets: {
        idle: [-5, -1], attack: [-8, -6], attackready: [-8, -6], act: [-6, -6], actend: [-6, -6], actready: [-6, -6],
        item: [-6, -6], itemready: [-6, -6], itemend: [-6, -6], defend: [-5, -3], defeat: [-8, -5], hurt: [-5, -6],
        intro: [-8, -9], victory: [-3, 0],
      },
      spells: [],
    },
    susie: {
      name: 'Susie',
      color: '#ff00ff',
      attackBar: '#ea79c8',
      dmgColor: '#cc99cc',
      maxhp: 270,
      at: 22,
      df: 3,
      mg: 2,
      hasAct: false,
      hasMagic: true,
      voice: 'voice_susie',
      w: 25,
      h: 43,
      soul: [12, 24],
      offsets: {
        idle: [-22, -1], attack: [-26, -25], attackready: [-26, -25], act: [-24, -25], actend: [-24, -25], actready: [-24, -25],
        spell: [-22, -30], spellready: [-22, -15], spellend: [-22, -30], item: [-22, -1], itemready: [-22, -1],
        defend: [-20, -23], defeat: [-22, -1], hurt: [-22, -1], victory: [-28, -7], rudebuster: [-44, -33],
      },
      spells: ['rudebuster', 'ultimaheal'],
    },
    ralsei: {
      name: 'Ralsei',
      color: '#00ff00',
      attackBar: '#b5e61d',
      dmgColor: '#80ff80',
      maxhp: 210,
      at: 12,
      df: 3,
      mg: 11,
      hasAct: false,
      hasMagic: true,
      voice: 'voice_ralsei',
      w: 21,
      h: 40,
      soul: [10, 24],
      offsets: {
        idle: [-2, -6], attack: [-10, -6], attackready: [-10, -6], act: [-2, -6], actend: [-2, -6], actready: [-2, -6],
        spell: [-11, -6], spellend: [-11, -6], spellready: [-11, -6], item: [-7, -14], itemready: [-7, -14],
        defend: [-2, -6], defeat: [-2, -6], hurt: [-13, -2], intro: [-2, -6], victory: [0, -6],
      },
      spells: ['healprayer', 'pacify'],
    },
  };

  // Animation speeds (frames per second) and whether they loop.
  DF.ANIMS = {
    idle: { fps: 6, loop: true },
    act: { fps: 15, loop: false },
    actend: { fps: 15, loop: false, next: 'idle' },
    actready: { fps: 5, loop: true },
    attack: { fps: 15, loop: false },
    attackready: { fps: 5, loop: true },
    defend: { fps: 15, loop: false },
    hurt: { fps: 15, loop: false, temp: 0.5 },
    item: { fps: 12, loop: false, next: 'idle' },
    itemready: { fps: 5, loop: true },
    itemend: { fps: 12, loop: false, next: 'idle' },
    defeat: { fps: 15, loop: false },
    victory: { fps: 10, loop: false },
    intro: { fps: 15, loop: false },
    spell: { fps: 15, loop: false },
    spellready: { fps: 5, loop: true },
    spellend: { fps: 15, loop: false, next: 'idle' },
    rudebuster: { fps: 15, loop: false, next: 'idle' },
  };

  DF.SPELLS = {
    rudebuster: { name: 'Rude Buster', desc: 'Deals\nmoderate\ndamage', tp: 50, target: 'enemy', damage: true },
    ultimaheal: { name: 'UltimatHeal', desc: 'Heals 1 ally\n(Susie-style)', tp: 32, target: 'party' },
    healprayer: { name: 'Heal Prayer', desc: 'Heal\nally', tp: 32, target: 'party' },
    pacify: { name: 'Pacify', desc: 'SPARE\na TIRED\nenemy', tp: 16, target: 'enemy' },
  };

  DF.ITEMS = {
    darkburger: { name: 'Darkburger', desc: 'Heals\n70HP', heal: 70 },
    chocdiamond: { name: 'ChocDiamond', desc: 'Heals\n80HP', heal: 80 },
    revivemint: { name: 'ReviveMint', desc: 'Revives\nfully', heal: 'revive' },
    topcake: { name: 'TopCake', desc: 'Heals team\n160HP', heal: 160, all: true },
    spincake: { name: 'SpinCake', desc: 'Heals team\n80HP', heal: 80, all: true },
  };
  DF.START_ITEMS = ['darkburger', 'darkburger', 'chocdiamond', 'chocdiamond', 'revivemint', 'revivemint', 'spincake', 'topcake'];

  // The Flowers. Sprite frames live under gang/<id>.
  DF.GANG = {
    aqua: { name: 'Aqua', color: '#00ffff', fps: 8, flip: false },
    seth: { name: 'Seth', color: '#c060ff', fps: 5, flip: false },
    orange: { name: 'Orange', color: '#ff8020', fps: 1, flip: false },
    green: { name: 'Green', color: '#40e040', fps: 1, flip: false },
    yellow: { name: 'Yellow', color: '#ffe020', fps: 7, flip: false },
    blue: { name: 'Blue', color: '#5080ff', fps: 2, flip: false },
  };

  /*
   * Phases. Flowery's MERCY is capped per phase; filling it moves the fight on.
   * Each ACT name maps to a minigame in minigames.js.
   */
  DF.PHASES = [
    null,
    {
      cap: 10,
      allies: [],
      acts: ['posey', 'poseyz'],
      waves: ['bamboo', 'jarona', 'petals'],
      check: ['* FLOWERY - AT 99 DF 99\n* Asgore\'s self-proclaimed best friend.', '* His stats seem... suspiciously round.\n* (He looks like he wants to see a good [c:yellow]POSE[/c].)'],
      flavor: [
        '* FLOWERY is striking a pose.\n* The sunset lights him perfectly.',
        '* Smells like fresh petals and hair gel.',
        "* FLOWERY's cape flutters without any wind.",
        '* FLOWERY is humming his own theme song.',
      ],
      talk: [
        [{ who: 'flowery', text: "It's me, Flowery!", voice: 'vc_itsmeflowery' }],
        [{ who: 'flowery', text: "Heh... it's my Jarona!", voice: 'vc_heh_it_s_my_jarona' }],
        [{ who: 'flowery', text: 'Leaf it to me!', voice: 'vc_leaf_it_to_me' }],
        [{ who: 'flowery', text: 'Hey there, little guy!', voice: 'vc_heytherelittleguy' }],
      ],
    },
    {
      cap: 20,
      allies: [],
      acts: ['blowaway', 'blowawayz'],
      waves: ['spiral', 'jarona2', 'wind'],
      check: ['* FLOWERY - AT 99 DF 99\n* Keeping a very dramatic distance.', '* (Maybe you could [c:yellow]BLOW[/c] him back this way?)'],
      flavor: [
        '* FLOWERY is keeping his distance.\n* His cape billows dramatically.',
        '* A mysterious wind blows through the battlefield.',
        '* FLOWERY is practicing his victory pose. Early.',
      ],
      talk: [
        [{ who: 'flowery', text: 'Spiral Dance!', voice: 'vc_spiral_dance' }],
        [{ who: 'flowery', text: 'Here I come,\nSan Fran-disco!', voice: 'vc_hereicomesanfrandisco_strong' }],
        [{ who: 'flowery', text: 'Mysterious Wind!', voice: 'vc_mysterious_wind' }],
        [{ who: 'flowery', text: 'What a predictable creature!', voice: 'vc_what_a_predictable_creature' }],
      ],
    },
    {
      cap: 30,
      allies: ['aqua', 'seth'],
      acts: ['spin', 'spinz'],
      waves: ['books', 'knives', 'aquaseth'],
      check: ['* FLOWERY - AT 99 DF 99\n* AQUA and SETH are backing him up.', "* You can't reach them... but a good\n  [c:yellow]SPIN[/c] might dazzle everyone at once."],
      flavor: [
        '* AQUA is twirling a knife.\n* SETH is taking notes.',
        '* SETH adjusts their glasses with great intent.',
        "* AQUA waves at you. You wave back.\n* It's a trap.",
      ],
      talk: [
        [
          { who: 'seth', text: "Chapter one: dodging.\nYou'll need it." },
          { who: 'flowery', text: 'Try my flavor!', voice: 'vc_try_my_flavor' },
        ],
        [
          { who: 'aqua', text: "Patience, patience~\n...Okay! I'm done\nbeing patient!" },
          { who: 'flowery', text: 'Blingo Blizzard!', voice: 'vc_blingo_blizzard' },
        ],
        [
          { who: 'aqua', text: 'Hehe! Hop to it~' },
          { who: 'seth', text: 'Footnote: ouch.' },
        ],
      ],
    },
    {
      cap: 40,
      allies: ['orange', 'green'],
      acts: ['praise', 'praisez'],
      waves: ['punches', 'kitchen', 'orangegreen'],
      check: ['* FLOWERY - AT 99 DF 99\n* ORANGE and GREEN are here to help.', '* Everyone here seems starved for [c:yellow]PRAISE[/c].'],
      flavor: [
        '* ORANGE is shadowboxing.\n* GREEN offers you a snack.',
        '* The smell of home cooking fills the air.',
        '* ORANGE is standing on tiptoes to look taller.',
      ],
      talk: [
        [
          { who: 'orange', text: "Put 'em up!\n...Gently, please." },
          { who: 'flowery', text: 'Prism Blow!', voice: 'vc_prism_blow' },
        ],
        [
          { who: 'green', text: '...Eat something.\nYou look pale.' },
          { who: 'flowery', text: 'Grown like a turnip!', voice: 'vc_grown_like_a_turnip' },
        ],
        [
          { who: 'orange', text: "I'm not scared!\nYOU'RE scared!" },
          { who: 'green', text: '...Seconds?' },
        ],
      ],
    },
    {
      cap: 50,
      allies: ['yellow', 'blue'],
      acts: ['justice'],
      waves: ['showdown', 'butterflies', 'ballet'],
      check: ['* FLOWERY - AT 99 DF 99\n* YELLOW and BLUE stand guard.', '* Only [c:yellow]JUSTICE[/c] will do here.\n* (It costs 100% TP. Graze and parry to build it!)'],
      flavor: [
        '* YELLOW is polishing a badge.\n* BLUE is stretching.',
        '* The air feels heavy with JUSTICE.',
        '* BLUE pirouettes. It is very graceful.',
      ],
      talk: [
        [
          { who: 'yellow', text: 'Justice is served,\npardner! ...Wait,\nwho ordered it?' },
          { who: 'flowery', text: "It's all in a name!", voice: 'vc_its_all_in_a_name' },
        ],
        [
          { who: 'blue', text: 'Posture. Integrity\nstarts at the spine.' },
          { who: 'flowery', text: "Don't you like\nserving humans?", voice: 'vc_dont_you_like_serving_humans' },
        ],
        [
          { who: 'yellow', text: 'Draw!' },
          { who: 'blue', text: 'And... plié.' },
        ],
      ],
    },
    {
      cap: 50,
      allies: [],
      acts: ['susieidea'],
      waves: ['bamboo_hard', 'jarona3', 'prism'],
      check: ['* FLOWERY - AT 99 DF 99\n* No friends left to lean on.\n* He is not backing down.', '* Susie is itching to try something.\n* (Her [c:yellow]IDEA[/c] needs 40% TP.)'],
      flavor: [
        "* FLOWERY is breathing hard.\n* His smile hasn't moved an inch.",
        '* Susie cracks her knuckles.',
        '* The Fountain gushes on the roof above.',
      ],
      talk: [
        [{ who: 'flowery', text: 'Lend me your power!', voice: 'vc_lend_me_your_power' }],
        [{ who: 'flowery', text: 'Take that!', voice: 'fl_take_that' }],
        [{ who: 'flowery', text: 'Flowers bloom\nin your heart!', voice: 'vc_flowers_blooms_in_your_heart' }],
        [{ who: 'flowery', text: 'Smile again!', voice: 'vc_smile_again' }],
      ],
    },
  ];

  // ACT menu entries. `party` lists who else takes part (their turns are used up).
  DF.ACTS = {
    check: { name: 'Check', desc: '' },
    posey: { name: 'Posey', desc: 'Strike\na pose' },
    poseyz: { name: 'PoseyZ', desc: 'Everyone\nposes', party: ['susie', 'ralsei'] },
    blowaway: { name: 'BlowAway', desc: 'Mash [Z]\nto pull' },
    blowawayz: { name: 'BlowAwayZ', desc: 'Mash [Z]\nwith\nfriends', party: ['susie', 'ralsei'] },
    spin: { name: 'Spin', desc: 'Spin with\narrows' },
    spinz: { name: 'SpinZ', desc: 'Team spin', party: ['susie', 'ralsei'] },
    praise: { name: 'Praise', desc: 'Say nice\nthings' },
    praisez: { name: 'PraiseZ', desc: 'Team\npraise', party: ['susie', 'ralsei'] },
    justice: { name: 'Justice', desc: 'Hold a\ntrial', tp: 100 },
    susieidea: { name: "Susie'sIdea", desc: 'Trust\nSusie', tp: 40, party: ['susie'] },
  };
})();
