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
| `Z` / `Enter` | Confirm, **dash** during enemy turns |
| `X` / `Shift` | Cancel, skip text, move slowly |
| `M` | Mute |
| `F` | Fullscreen |

On touch screens an on-screen D-pad and `Z`/`X` buttons appear (toggle under **Settings**).

## How the fight works

FLOWERY can't be beaten by FIGHTing. The first time you try, Susie and Ralsei heal him and
FIGHT gets locked. You win by raising his **MERCY**, and each phase needs a different ACT.
Z-versions of an ACT use the whole team, so both Susie and Ralsei have to be standing.

| Phase | Who joins | ACT | Minigame |
| --- | --- | --- | --- |
| 1 | FLOWERY alone | Posey / PoseyZ | Stop the marker in the middle |
| 2 | FLOWERY keeps his distance | BlowAway / BlowAwayZ | Mash `Z` to drag him back |
| 3 | AQUA and SETH | Spin / SpinZ | Roll the arrow keys around a circle |
| 4 | ORANGE and GREEN | Praise / PraiseZ | Type the compliment arrows |
| 5 | YELLOW and BLUE | Justice (100% TP) | A very short trial |
| 6 | OMEGA FLOWERY | Susie'sIdea (40% TP) | Climb the beanstalk, then parry the last JARONA |

**The orange SOUL.** On enemy turns your SOUL is orange. It faces right and the board
rushes past it: you move up and down, and `Z` dashes forward. Dashing breaks anything
**blue** and **parries** charging attacks. FLOWERY (and later ORANGE, BLUE and OMEGA
FLOWERY) turns blue just before impact. Dash into him then. The later you dash, the better
the parry and the more TP it gives. Grazing bullets and DEFENDing also build TP.

Each ally brings their own attacks. SETH sends scrolling words (grab the green ones), AQUA
throws knives you hop over on lily pads, ORANGE punches, GREEN throws pans (and healing
dishes), YELLOW fires shots you can knock back, and BLUE pirouettes rings of petals.

If you fall, **Continue** restarts the current phase instead of the whole fight.

## Credits and licensing

This is a non-commercial fan work. Please keep it that way.

- **DELTARUNE** © Toby Fox. The characters, sprites and FLOWERY's voice clips belong to
  their creators.
- **Sprites and sound effects** come from two open-source DELTARUNE fan engines, which
  distribute them for fan projects:
  - [Kristal](https://github.com/KristalTeam/Kristal) (KristalTeam): party battle sprites,
    battle UI, SOUL, effects, sound effects, bitmap fonts.
  - [Featherfall](https://github.com/ThePlasticPotato/Featherfall) (Potato): Chapter 5
    sprites for FLOWERY and the Flowers, petals, and FLOWERY's voice clips.
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
js/game/              battle, waves, minigames, cutscenes, climb, scenes, music
js/bundle/            generated: base64 atlas, fonts and MP3s
assets/               the extracted atlas.png/atlas.json, fonts and MP3s
tools/                asset extraction + bundling scripts
```

### Rebuilding the assets

```sh
pip install pillow soundfile numpy lameenc fonttools
git clone --depth 1 https://github.com/KristalTeam/Kristal /tmp/kristal
git clone --depth 1 https://github.com/ThePlasticPotato/Featherfall /tmp/featherfall
python3 tools/extract_assets.py --kristal /tmp/kristal --featherfall /tmp/featherfall
python3 tools/build_bundle.py
```

### Debug helpers

From the browser console: `DF.debug.phase(4)` jumps to a phase, `DF.debug.tp(100)` fills
TP, `DF.debug.climb()` skips to the finale, and `DF.debug.god = true` stops damage.
