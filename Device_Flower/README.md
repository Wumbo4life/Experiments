# Device_Flower

A browser remake of **the Flowery fight** from *DELTARUNE* Chapter 5, written in plain
JavaScript with Canvas and WebAudio. No build step, no dependencies.

> Fan project, not affiliated with Toby Fox. Contains spoilers for the end of Chapter 5.

## Play

Open `index.html` in a browser. That's it. Everything (sprites, sounds, fonts) is bundled
into `js/bundle/*.js`, so it also runs straight from disk (`file://`).

To host it, serve the folder with any static server (for example `npx serve .`), or turn on
GitHub Pages for this repository and open `/Device_Flower/`.

### Controls

| Key | Action |
| --- | --- |
| Arrow keys / WASD | Move, pick menu items |
| `Z` / `Enter` | Confirm. On enemy turns, **hold to charge and let go to dash** |
| `X` / `Shift` | Cancel, skip text, move slowly |
| Finale | `X` jumps, `Z` slashes, hold `Z` and let go for a jump-slash |
| `M` | Mute |
| `F` | Fullscreen |

On touch screens an on-screen D-pad and `Z`/`X` buttons appear (toggle under **Settings**).

## How the fight works

FLOWERY can't be beaten by FIGHTing. The first time you try, Susie and Ralsei heal him and
FIGHT gets locked. You win by raising his **MERCY**, and each phase needs a different ACT.
Z-versions of an ACT use the whole team, so both Susie and Ralsei have to be standing.

**Every ACT except Check costs TP**, and not a little: solo ACTs cost 40%, Z-ACTs 75%,
Justice 100% and Susie's Idea 60%. A typical turn is one ACT while the others DEFEND (+16%
each), then earning the rest back on his turn by grazing, parrying and breaking blue things.

| Phase | Who joins | ACT | Minigame |
| --- | --- | --- | --- |
| 1 | FLOWERY alone | Posey / PoseyZ | Stop the marker in the middle |
| 2 | FLOWERY keeps his distance | BlowAway / BlowAwayZ | Mash `Z` to drag him back |
| 3 | AQUA and SETH | Spin / SpinZ | Roll the arrow keys around a circle |
| 4 | ORANGE and GREEN | Praise / PraiseZ | Type the compliment arrows |
| 5 | YELLOW and BLUE | Justice (100% TP) | A very short trial |
| 6 | FLOWERY alone (Ralsei is knocked out) | Susie'sIdea (60% TP) | Climb, face OMEGA FLOWERY on the castle roof |

**The orange SOUL.** On enemy turns your SOUL is orange. It faces right and the board
rushes past it: you move up and down, and holding `Z` charges a dash that fires when you
let go (a tap is a short hop, a full charge goes much further). Dashing breaks anything
**blue** and **parries** charging attacks. FLOWERY (and later ORANGE and BLUE) turns blue
just before impact. Dash into him then. The later you dash, the better the parry and the
more TP it gives. Grazing bullets and DEFENDing also build TP.

FLOWERY's own attacks are bamboo walls (slip through the gap or dash through the blue
section), his JARONA charge, spirals of petals and a mysterious wind. Each ally brings their
own: SETH sends words down four lanes (grab the green ones), AQUA throws knives you hop over
on lily pads, ORANGE punches, GREEN throws pans (and healing dishes), YELLOW fires volleys
and shoots flowers off the bamboo into butterflies, and BLUE pirouettes rings of petals.

**Every attack can be dodged.** Each wave plans a hidden "safe line" that the SOUL can
always follow. Random bullets are only launched if they stay clear of it, and walls are
placed so each opening can be reached from the last. An automated bot that only follows
that line (plus parrying, hopping and sidestepping aimed shots) clears all 18 waves
without a hit.

**Where it happens.** The fight is on the roof of the Flower Castle at sunset: cherry
trees, a great torii, and the Dark Fountain pouring up through it. The sun sinks a little
further with every phase.

**The finale.** Susie throws Kris up the beanstalk. Climb ahead of the thorns while
FLOWERY dives at you. At the top, the six Flowers pour their colors into him and he becomes
OMEGA FLOWERY. Then it's a run along the castle roof: jump his low glides, slash them as
they turn blue, and jump-slash the high ones to fill the attack bar. At CRITICAL he throws
his LAST JARONA. Parry it and finish him. The story that follows is told with sprites and
silhouettes, in paraphrase.

If you fall, **Continue** restarts the current phase instead of the whole fight, with enough
TP to ACT straight away.

## Hard Mode

Pick **HARD MODE** on the title screen. FLOWERY is red, with a stolen red SOUL beating in
his chest: he has the power of **DETERMINATION**, and control over the SAVE FILE.

- **He takes your file.** Your SAVE FILE is overwritten ("FLOWERY, LV 999") and the title
  screen shows it until you beat him. Game over is his too.
- **He LOADs.** When you fill his MERCY for a phase he LOADs his SAVE and takes 5% back,
  once per phase. (In phase 5 YELLOW objects: a verdict can't be LOADed away.)
- **He SAVEs and LOADs inside his attacks.** Once per attack a red SAVE star appears;
  moments later he LOADs and everything on the board rewinds to that point and plays out
  again: parried charges come back, broken bamboo is whole. The SOUL keeps its place.
- **The climb and the run.** He LOADs you back down the climb, rewinds the rooftop attack
  bar once, and throws a second, faster LAST JARONA after you parry the first.
- Attacks run 25% faster and hit 50% harder.

Hard Mode stays fair. The rewind also winds each attack's safe line back at a speed the
SOUL can match, nothing can hit you during it, and he only SAVEs when nothing you must
react to (a lily pad, a knife wall, a charging attacker) is close. The dodging bot clears
all 18 attacks in Hard Mode, each with a LOAD, without a hit.

## Credits and licensing

This is a non-commercial fan work. Please keep it that way.

- **DELTARUNE** © Toby Fox. The characters, sprites and FLOWERY's voice clips belong to
  their creators.
- **Sprites and sound effects** come from three open-source DELTARUNE fan projects, which
  distribute them for fan use:
  - [Kristal](https://github.com/KristalTeam/Kristal) (KristalTeam): party battle sprites,
    battle UI, SOUL, effects, sound effects, bitmap fonts.
  - [Featherfall](https://github.com/ThePlasticPotato/Featherfall) (Potato): Chapter 5
    sprites for FLOWERY and the Flowers, petals, and FLOWERY's voice clips.
  - [deltarun-episode-5](https://github.com/Woganog/deltarun-episode-5) (Woganog): Kris,
    Susie and Ralsei's platformer sprites, and OMEGA FLOWERY's glide.
- **Asgore, the Knight, the golden flower, the rooftop and the bullet art** are drawn in
  code for this remake.
- **Fonts**: *8bitoperator JVE* and *Monospaced JVE* by nipcen, CC BY-NC-SA 3.0.
- **Music**: "Bloom Beat" is an original composition for this remake, synthesized live
  with WebAudio (`js/game/music.js`). The karaoke lyrics are also original. The real
  fight's song and lyrics are not included.
- **Code** (everything under `js/` except `js/bundle/`, plus `tools/`): written for this
  project. The battle UI layout follows Kristal's measurements (BSD-3-Clause).

## Project layout

```
index.html            entry point (plain <script> tags, no modules)
css/style.css         page + touch-control styles
js/engine/            loop helpers, input, sprite/text drawing, audio, typewriter text
js/game/              battle, waves, minigames, cutscenes, climb, finale, scenes, music
js/bundle/            generated: base64 atlas, fonts and MP3s
assets/               the extracted atlas.png/atlas.json, fonts and MP3s
tools/                asset extraction + bundling scripts
```

### Rebuilding the assets

```sh
pip install pillow soundfile numpy lameenc fonttools
git clone --depth 1 https://github.com/KristalTeam/Kristal /tmp/kristal
git clone --depth 1 https://github.com/ThePlasticPotato/Featherfall /tmp/featherfall
git clone --depth 1 https://github.com/Woganog/deltarun-episode-5 /tmp/platformer
python3 tools/extract_assets.py --kristal /tmp/kristal --featherfall /tmp/featherfall --platformer /tmp/platformer
python3 tools/build_bundle.py
```

### Debug helpers

From the browser console: `DF.debug.phase(4)` jumps to a phase, `DF.debug.tp(100)` fills
TP, `DF.debug.climb()` skips to the climb, `DF.debug.finale()` to the rooftop run,
`DF.debug.ending()` to the ending, `DF.debug.god = true` stops damage, and
`DF.debug.showLine = true` draws each wave's safe line. Pass `true` as the last argument
(`DF.debug.phase(3, true)`, `DF.debug.finale(true)`...) for Hard Mode.
