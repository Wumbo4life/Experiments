#!/usr/bin/env python3
"""Extract the sprites, sounds and fonts Device_Flower needs from the three
fan projects it borrows from, and pack them into ./assets.

    python3 tools/extract_assets.py --kristal PATH --featherfall PATH --platformer PATH

  * Kristal      https://github.com/KristalTeam/Kristal        (party, UI, SFX, fonts)
  * Featherfall  https://github.com/ThePlasticPotato/Featherfall (Flowery, the Flowers, Ch5 SFX)
  * deltarun-episode-5  https://github.com/Woganog/deltarun-episode-5
                 (Omega Flowery charge, Kris clash/climb frames for the finale)

Outputs (all relative to the Device_Flower folder):
  assets/atlas.png      every sprite frame packed into one sheet
  assets/atlas.json     frame rectangles + bitmap-font glyph tables
  assets/sounds/*.mp3   mono MP3s (converted from WAV/OGG)
  assets/fonts/*.ttf    TrueType fonts

Requires: pillow, soundfile, numpy, lameenc, fonttools
"""
import argparse
import glob
import json
import os
import re

import lameenc
import numpy as np
import soundfile as sf
from fontTools.ttLib import TTFont
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "assets")


def natural_frames(folder, prefix):
    """Return files named <prefix><number>.png in numeric order."""
    rx = re.compile(r"^" + re.escape(prefix) + r"(\d+)\.png$")
    found = []
    for path in glob.glob(os.path.join(folder, prefix + "*.png")):
        m = rx.match(os.path.basename(path))
        if m:
            found.append((int(m.group(1)), path))
    return [p for _, p in sorted(found)]


# --------------------------------------------------------------------------
# Sprite list: (source-root key, folder, file prefix, destination key)
# A destination key "kris/idle" produces frames kris/idle_1 ... kris/idle_N.
# --------------------------------------------------------------------------
SEQUENCES = [
    # ---- party: Kris ----------------------------------------------------
    ("K", "party/kris/dark/battle", "idle_", "kris/idle"),
    ("K", "party/kris/dark/battle", "act_", "kris/act"),
    ("K", "party/kris/dark/battle", "actend_", "kris/actend"),
    ("K", "party/kris/dark/battle", "actready_", "kris/actready"),
    ("K", "party/kris/dark/battle", "attack_", "kris/attack"),
    ("K", "party/kris/dark/battle", "attackready_", "kris/attackready"),
    ("K", "party/kris/dark/battle", "defend_", "kris/defend"),
    ("K", "party/kris/dark/battle", "hurt_", "kris/hurt"),
    ("K", "party/kris/dark/battle", "item_", "kris/item"),
    ("K", "party/kris/dark/battle", "itemready_", "kris/itemready"),
    ("K", "party/kris/dark/battle", "defeat_", "kris/defeat"),
    ("K", "party/kris/dark/battle", "victory_", "kris/victory"),
    ("K", "party/kris/dark/battle", "intro_", "kris/intro"),
    # ---- party: Susie ---------------------------------------------------
    ("K", "party/susie/dark/battle", "idle_", "susie/idle"),
    ("K", "party/susie/dark/battle", "act_", "susie/act"),
    ("K", "party/susie/dark/battle", "actend_", "susie/actend"),
    ("K", "party/susie/dark/battle", "actready_", "susie/actready"),
    ("K", "party/susie/dark/battle", "attack_", "susie/attack"),
    ("K", "party/susie/dark/battle", "attackready_", "susie/attackready"),
    ("K", "party/susie/dark/battle", "defend_", "susie/defend"),
    ("K", "party/susie/dark/battle", "hurt_", "susie/hurt"),
    ("K", "party/susie/dark/battle", "item_", "susie/item"),
    ("K", "party/susie/dark/battle", "itemready_", "susie/itemready"),
    ("K", "party/susie/dark/battle", "defeat_", "susie/defeat"),
    ("K", "party/susie/dark/battle", "spell_", "susie/spell"),
    ("K", "party/susie/dark/battle", "spellready_", "susie/spellready"),
    ("K", "party/susie/dark/battle", "rudebuster_", "susie/rudebuster"),
    ("K", "party/susie/dark/battle", "victory_", "susie/victory"),
    # ---- party: Ralsei --------------------------------------------------
    ("K", "party/ralsei/dark/battle", "idle_", "ralsei/idle"),
    ("K", "party/ralsei/dark/battle", "act_", "ralsei/act"),
    ("K", "party/ralsei/dark/battle", "actend_", "ralsei/actend"),
    ("K", "party/ralsei/dark/battle", "actready_", "ralsei/actready"),
    ("K", "party/ralsei/dark/battle", "attack_", "ralsei/attack"),
    ("K", "party/ralsei/dark/battle", "attackready_", "ralsei/attackready"),
    ("K", "party/ralsei/dark/battle", "defend_", "ralsei/defend"),
    ("K", "party/ralsei/dark/battle", "hurt_", "ralsei/hurt"),
    ("K", "party/ralsei/dark/battle", "item_", "ralsei/item"),
    ("K", "party/ralsei/dark/battle", "itemready_", "ralsei/itemready"),
    ("K", "party/ralsei/dark/battle", "defeat_", "ralsei/defeat"),
    ("K", "party/ralsei/dark/battle", "spell_", "ralsei/spell"),
    ("K", "party/ralsei/dark/battle", "spellready_", "ralsei/spellready"),
    ("K", "party/ralsei/dark/battle", "victory_", "ralsei/victory"),
    # ---- battle UI --------------------------------------------------------
    ("K", "player", "heart_shard_", "heart/shard"),
    ("K", "effects/attack", "cut_", "fx/cut"),
    ("K", "effects/spare", "star_", "fx/star"),
    ("K", "effects/rudebuster", "beam_", "fx/rudebuster"),
    ("K", "effects", "soulshine_", "fx/soulshine"),
    ("K", "effects/criticalswing", "sparkle_", "fx/sparkle"),
    # ---- Flowery ----------------------------------------------------------
    ("F", "party/flowery/platform", "idle_", "flowery/idle"),
    ("F", "party/flowery", "idle_", "flowery/stand"),
    ("F", "party/flowery/platform", "run_", "flowery/run"),
    ("F", "party/flowery/platform", "jarona_", "flowery/jarona"),
    ("F", "party/flowery/platform", "jarona_powerup_", "flowery/powerup"),
    ("F", "party/flowery/platform", "slash_ground_", "flowery/slash"),
    ("F", "party/flowery/jarona", "spr_flowery_poweringup_", "flowery/poweringup"),
    ("F", "party/flowery/jarona", "spr_flowery_punch_windup_", "flowery/windup"),
    ("F", "party/flowery/jarona", "spr_flowery_shockwave_", "flowery/shockwave"),
    ("F", "party/flowery/portraits", "spr_face_flowery_", "face/flowery"),
    # ---- the Flowers ------------------------------------------------------
    ("F", "party/flowery/flower_gang", "spr_enemy_aqua_idle_", "gang/aqua"),
    ("F", "party/flowery/flower_gang", "spr_seth_idle_", "gang/seth"),
    ("F", "party/flowery/flower_gang", "spr_yellow_idle_", "gang/yellow"),
    ("F", "party/flowery/flower_gang", "spr_blue_poses_", "gang/blue"),
    ("F", "party/flowery/flower_gang", "spr_orange_mad_", "gang/orange"),
    ("F", "party/flowery/flower_gang", "spr_enemy_green_", "gang/green"),
    # ---- petals / bullets / effects ------------------------------------
    ("F", "effects/platform/petal", "barrier_", "petal/barrier"),
    ("F", "effects/platform/petal", "blue_", "petal/blue"),
    ("F", "effects/platform/petal", "falling_", "petal/falling"),
    ("F", "effects/platform/petal", "spin_", "petal/spin"),
    ("F", "effects/platform/petal", "spinning_", "petal/spinning"),
    ("F", "world/platform/bullets", "blue_", "bullet/blueorb"),
    ("F", "world/platform/slashpusher", "petals_", "bloom/blue"),
    ("F", "world/platform/slashpusher", "petals_yellow_", "bloom/yellow"),
    ("F", "effects/platform", "hit_vfx_", "fx/hit"),
    ("F", "effects/platform", "directional_hit_", "fx/dirhit"),
    ("F", "effects/platform", "leaf_fall_", "fx/leaf"),
    ("F", "effects/platform", "petalwing_", "fx/petalwing"),
    ("F", "effects/platform", "spr_healsparkle_", "fx/heal"),
    ("F", "effects/platform", "landingdust_new_", "fx/dust"),
    # ---- platform-mode party sprites (finale) ------------------------------
    ("F", "party/kris/platform", "ball_", "kplat/ball"),
    ("F", "party/kris/platform", "slash_air_", "kplat/slash"),
    ("F", "party/kris/platform", "jump_up_", "kplat/jumpup"),
    ("F", "party/kris/platform", "jump_down_", "kplat/jumpdown"),
    ("F", "party/kris/platform", "idle_", "kplat/idle"),
    ("F", "party/kris/platform", "land_", "kplat/land"),
    ("F", "party/susie/platform", "attack_", "splat/attack"),
    ("F", "party/susie/platform", "idle_", "splat/idle"),
    ("F", "party/ralsei/platform", "fall_", "rplat/fall"),
    ("F", "party/ralsei/platform", "run_", "rplat/run"),
    ("F", "party/ralsei/platform", "idle_", "rplat/idle"),
    ("F", "party/susie/platform", "run_", "splat/run"),
    ("F", "party/kris/platform", "run_", "kplat/run"),
    ("F", "party/kris/platform", "slash_ground_", "kplat/slashg"),
    ("F", "party/kris/platform", "halt_", "kplat/halt"),
    ("F", "party/kris/platform", "crouch_", "kplat/crouch"),
    # ---- finale sprites from the Godot platforming recreation -----------------
    ("W", "obj/player/kris-sprites/spr_kris_plat_clash", "spr_kris_plat_clash_", "kplat/clash"),
    ("W", "obj/player/kris-sprites/spr_kris_plat_climb", "spr_kris_plat_climb_", "kplat/climb"),
    ("W", "obj/player/kris-sprites/spr_kris_plat_run_heart", "spr_kris_plat_run_heart_", "kplat/runheart"),
    ("W", "obj/flowery/spr_omegaflowery_jarona", "spr_omegaflowery_jarona_", "flowery/omegajarona"),
]

SINGLES = [
    ("K", "party/kris/dark/battle/itemend_1.png", "kris/itemend_1"),
    ("K", "party/susie/dark/battle/spellend_1.png", "susie/spellend_1"),
    ("K", "party/susie/dark/battle/swooned_1.png", "susie/swooned_1"),
    ("K", "party/ralsei/dark/battle/spellend_1.png", "ralsei/spellend_1"),
    ("K", "party/kris/name.png", "name/kris"),
    ("K", "party/susie/name.png", "name/susie"),
    ("K", "party/ralsei/name.png", "name/ralsei"),
    ("F", "party/flowery/menu/spr_bnameflowery_1.png", "name/flowery"),
    ("F", "party/flowery/menu/spr_dmenu_items_floweryhead_1.png", "icon/flowery_head"),
    ("K", "player/heart.png", "heart/heart"),
    ("K", "player/heart_break.png", "heart/break"),
    ("K", "player/graze.png", "heart/graze"),
    ("K", "ui/battle/tp_bar_fill.png", "ui/tp_fill"),
    ("K", "ui/battle/tp_bar_outline.png", "ui/tp_outline"),
    ("K", "ui/battle/tp_text.png", "ui/tp_text"),
    ("K", "ui/battle/sparestar.png", "ui/sparestar"),
    ("K", "ui/battle/press.png", "ui/press"),
    ("K", "ui/battle/background.png", "ui/bgtile"),
    ("K", "ui/hp.png", "ui/hp"),
    ("K", "ui/page_arrow_down.png", "ui/arrow_down"),
    ("K", "effects/alert.png", "fx/alert"),
    ("K", "ui/battle/msg/miss.png", "msg/miss"),
    ("K", "ui/battle/msg/up.png", "msg/up"),
    ("K", "ui/battle/msg/down.png", "msg/down"),
    ("K", "ui/battle/msg/max.png", "msg/max"),
    ("K", "ui/battle/msg/lost.png", "msg/lost"),
    ("F", "party/flowery/platform/pose_1.png", "flowery/pose_1"),
    ("F", "party/flowery/platform/crouch_1.png", "flowery/crouch_1"),
    ("F", "party/flowery/platform/kick_1.png", "flowery/kick_1"),
    ("F", "party/flowery/platform/kick_crescent_1.png", "flowery/kickcrescent_1"),
    ("F", "party/flowery/platform/jump_up_1.png", "flowery/jumpup_1"),
    ("F", "party/flowery/platform/jump_down_1.png", "flowery/jumpdown_1"),
    ("F", "party/flowery/jarona/spr_flowery_puuunch_1.png", "flowery/puuunch_1"),
    ("F", "party/flowery/jarona/spr_flowery_fair_1.png", "flowery/fair_1"),
    ("F", "world/platform/slashpusher/closed_1.png", "bloom/closed_1"),
    ("F", "world/platform/slashpusher/leaves_1.png", "bloom/leaves_1"),
    ("F", "world/platform/slashpusher/leafbase_1.png", "bloom/leafbase_1"),
    ("F", "world/platform/slashpusher/base_1.png", "bloom/boost_1"),
    ("F", "world/platform/slashpusher/orb_1.png", "bloom/orb_1"),
    ("F", "world/platform/torii/back_1.png", "torii/back_1"),
    ("F", "world/platform/torii/perspective_1.png", "torii/side_1"),
    ("F", "effects/platform/smack_vfx_1.png", "fx/smack_1"),
    ("F", "party/kris/platform/hurt_air_1.png", "kplat/hurt_1"),
    ("F", "party/ralsei/platform/splat_1.png", "rplat/splat_1"),
    ("F", "party/ralsei/platform/falling_1.png", "rplat/falling_1"),
    ("F", "party/kris/platform/hurt_ground_1.png", "kplat/hurtg_1"),
    ("W", "obj/flowery/spr_flowery_head_tilt_down.png", "flowery/headdown_1"),
    ("W", "obj/player/kris-sprites/spr_kris_plat_pose.png", "kplat/pose_1"),
]

# Kristal icon sets (head + per-action icons shown in the action box).
for who in ("kris", "susie", "ralsei"):
    for icon in ("head", "head_hurt", "head_error", "act", "attack", "defend",
                 "item", "spare", "spell"):
        SINGLES.append(("K", "party/%s/icon/%s.png" % (who, icon), "icon/%s_%s" % (who, icon)))

# Action buttons: normal, _h (hovered), _a (glowing) and _d (disabled).
for btn in ("fight", "act", "magic", "item", "spare", "defend"):
    for suffix in ("", "_h", "_a", "_d"):
        SINGLES.append(("K", "ui/battle/btn/%s%s.png" % (btn, suffix), "btn/%s%s" % (btn, suffix)))

# LOVE-style image fonts (glyph strips separated by a solid spacer colour).
BITMAP_FONTS = {
    "plain": ("K", "../fonts/plain.png", " abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~"),
    "smallnumbers": ("K", "../fonts/smallnumbers.png", " 0123456789+-%/.einfa"),
    "bignumbers": ("K", "../fonts/bignumbers.png", " 0123456789+-%/.einf"),
    "goldnumbers": ("K", "../fonts/goldnumbers.png", " 0123456789+-%/.einf$"),
    "name": ("K", "../fonts/name.png", " ABCDEFGHIJKLMNOPQRSTUVWXYZ"),
}

TTF_FONTS = [
    ("K", "../fonts/main.ttf", "main.ttf"),            # 8bitoperator JVE (nipcen, CC BY-NC-SA)
    ("K", "../fonts/main_mono.ttf", "main_mono.ttf"),  # Monospaced JVE (nipcen, CC BY-NC-SA)
]

# --------------------------------------------------------------------------
# Sounds: (source-root key, relative path under assets/, output name)
# --------------------------------------------------------------------------
KSND = "sounds"
FSND = "sounds"
SOUNDS = [
    ("K", "ui_move.wav", "ui_move"), ("K", "ui_select.wav", "ui_select"),
    ("K", "ui_cancel.wav", "ui_cancel"), ("K", "ui_cant_select.wav", "ui_cant"),
    ("K", "hurt.wav", "hurt"), ("K", "damage.wav", "damage"), ("K", "graze.wav", "graze"),
    ("K", "mercyadd.wav", "mercyadd"), ("K", "spare.wav", "spare"),
    ("K", "spellcast.wav", "spellcast"), ("K", "power.wav", "power"),
    ("K", "item.wav", "item"), ("K", "tensionhorn.wav", "tensionhorn"),
    ("K", "bell.wav", "bell"), ("K", "boost.wav", "boost"), ("K", "bump.wav", "bump"),
    ("K", "impact.wav", "impact"), ("K", "criticalswing.wav", "criticalswing"),
    ("K", "laz_c.wav", "slash"), ("K", "scytheburst.wav", "scytheburst"),
    ("K", "rudebuster_swing.wav", "rudebuster_swing"), ("K", "rudebuster_hit.wav", "rudebuster_hit"),
    ("K", "break1.wav", "break1"), ("K", "break2.wav", "break2"),
    ("K", "deathnoise.wav", "deathnoise"), ("K", "explosion.wav", "explosion"),
    ("K", "badexplosion.wav", "badexplosion"),
    ("K", "sparkle_glock.wav", "sparkle"), ("K", "sparkle_gem.wav", "sparkle_gem"),
    ("K", "wing.wav", "wing"), ("K", "jump.wav", "jump"), ("K", "grab.wav", "grab"),
    ("K", "awkward.wav", "awkward"), ("K", "suslaugh.wav", "suslaugh"),
    ("K", "sussurprise.wav", "sussurprise"), ("K", "bell_bounce_short.wav", "bellbounce"),
    ("K", "heavyswing.wav", "heavyswing"), ("K", "punchmed.wav", "punchmed"),
    ("K", "camera_flash.wav", "camera"), ("K", "screenshake.wav", "screenshake"),
    ("K", "splat.wav", "splat"), ("K", "stardrop.wav", "stardrop"),
    ("K", "weaponpull_fast.wav", "weaponpull"), ("K", "chargeshot_charge.wav", "charge"),
    ("K", "noise.wav", "noise"), ("K", "error.wav", "error"), ("K", "locker.wav", "locker"),
    ("K", "whip_crack_only.wav", "whip"), ("K", "petrify.wav", "petrify"),
    ("K", "coin.wav", "coin"), ("K", "levelup.wav", "levelup"), ("K", "egg.wav", "egg"),
    ("K", "ominous.wav", "ominous"), ("K", "swallow.wav", "swallow"),
    ("K", "voice/default.wav", "voice_default"), ("K", "voice/susie.wav", "voice_susie"),
    ("K", "voice/ralsei.wav", "voice_ralsei"), ("K", "voice/toriel.wav", "voice_toriel"),
    ("F", "bounceflower.wav", "bounceflower"), ("F", "bounceflower_quick.wav", "bounceflower_quick"),
    ("F", "cymbal.wav", "cymbal"), ("F", "firework_send.wav", "firework"),
    ("F", "glove_launch.wav", "glove"), ("F", "petaldrain.wav", "petaldrain"),
    ("F", "plat_windloop.wav", "windloop"), ("F", "platswap_1.wav", "platswap1"),
    ("F", "platswap_2.wav", "platswap2"), ("F", "smallswing.wav", "smallswing"),
    ("F", "spearrise.wav", "spearrise"), ("F", "ultraswing.wav", "ultraswing"),
    ("F", "wallclaw.wav", "wallclaw"), ("F", "omegarona.ogg", "omegarona"),
    ("F", "flowery/jarona1.wav", "fl_jarona1"), ("F", "flowery/jarona2.wav", "fl_jarona2"),
    ("F", "flowery/jarona3.wav", "fl_jarona3"), ("F", "flowery/jarona4.wav", "fl_jarona4"),
    ("F", "flowery/last_jarona.wav", "fl_last_jarona"), ("F", "flowery/omega_flowery.wav", "fl_omega"),
    ("F", "flowery/punchheavythunder.wav", "punchthunder"), ("F", "flowery/take_that.wav", "fl_take_that"),
    ("F", "flowery/forthefans.wav", "fl_forthefans"), ("F", "flowery/heyguys.wav", "fl_heyguys"),
    ("F", "flowery/huh.wav", "fl_huh"), ("F", "flowery/flowery2.wav", "fl_flowery2"),
]
VOICECLIPS = [
    "all_according_to_all_according_to_plant", "blingo_blizzard", "calling_for_help",
    "dont_you_like_serving_humans", "flowers_blooms_in_your_heart", "flowery", "forget_it",
    "get_a_chance_1", "go_home", "goodbye", "great_style", "grown_like_a_turnip", "hah",
    "heh_it_s_my_jarona", "hereicome", "hereicomesanfrandisco_strong", "hereicomesanfrandisco_weak",
    "hey", "hey_boys", "hey_raly", "heytherelittleguy", "hoo", "huhillshowyou", "im_falling",
    "im_only_trying_to_help_you", "its_all_in_a_name", "its_all_yours", "its_so_human", "itsme",
    "itsmeflowery", "kris", "leaf_it_to_me", "lend_me_your_power", "my_favorite_two", "my_king",
    "mysterious_wind", "no_way_its_your_children", "nonono", "powering_up", "prism_blow",
    "say_that_again", "smile_again", "sorryaboutthatguys", "sorryaboutthatlittleguy",
    "sorrytokeepyouwaiting1", "sorrytokeepyouwaiting2", "spiral_dance", "susie", "thatsgreat",
    "thisguysyourbestfriend", "try_my_flavor", "what_a_predictable_creature",
    "with_your_powers_combined", "wow", "yes", "yoroshiku", "youre_a_hero", "yourdadsmybestfriend",
]
for clip in VOICECLIPS:
    SOUNDS.append(("F", "flowery/voiceclips/%s.wav" % clip, "vc_" + clip))

MUSIC = [
    ("K", "../music/AUDIO_DEFEAT.ogg", "mus_defeat"),
]


def load_sprites(roots):
    frames = {}
    for key, folder, prefix, dest in SEQUENCES:
        paths = natural_frames(os.path.join(roots[key], folder), prefix)
        if not paths:
            raise SystemExit("no frames for %s/%s*" % (folder, prefix))
        for i, path in enumerate(paths, 1):
            frames["%s_%d" % (dest, i)] = Image.open(path).convert("RGBA")
    for key, rel, dest in SINGLES:
        frames[dest] = Image.open(os.path.join(roots[key], rel)).convert("RGBA")
    return frames


def parse_image_font(img, glyphs):
    """Split a LOVE image font into glyph rectangles (x, width)."""
    spacer = img.getpixel((0, 0))
    rects = []
    x = 0
    w = img.width
    while x < w and len(rects) < len(glyphs):
        while x < w and img.getpixel((x, 0)) == spacer:
            x += 1
        start = x
        while x < w and img.getpixel((x, 0)) != spacer:
            x += 1
        if x > start:
            rects.append((start, x - start))
    if len(rects) != len(glyphs):
        raise SystemExit("glyph count mismatch: %d rects for %d glyphs" % (len(rects), len(glyphs)))
    # Make the spacer colour transparent so the whole strip can live in the atlas.
    px = img.load()
    for yy in range(img.height):
        for xx in range(img.width):
            if px[xx, yy] == spacer:
                px[xx, yy] = (0, 0, 0, 0)
    return rects


def pack(frames, max_width=2048):
    """Simple shelf packer (tallest first) with 1px padding."""
    order = sorted(frames.items(), key=lambda kv: (-kv[1].height, -kv[1].width, kv[0]))
    placed = {}
    x = y = shelf_h = 0
    for name, im in order:
        w, h = im.width + 2, im.height + 2
        if x + w > max_width:
            y += shelf_h
            x = shelf_h = 0
        placed[name] = (x + 1, y + 1, im.width, im.height)
        x += w
        shelf_h = max(shelf_h, h)
    height = y + shelf_h
    sheet = Image.new("RGBA", (max_width, height), (0, 0, 0, 0))
    for name, (px, py, _, _) in placed.items():
        sheet.alpha_composite(frames[name], (px, py))
    return sheet, placed


def encode_mp3(src, dst, bitrate):
    data, rate = sf.read(src, dtype="float32", always_2d=True)
    mono = data.mean(axis=1)
    peak = float(np.max(np.abs(mono))) if mono.size else 0.0
    if peak > 1.0:
        mono = mono / peak
    pcm = (np.clip(mono, -1, 1) * 32767).astype("<i2").tobytes()
    enc = lameenc.Encoder()
    enc.set_bit_rate(bitrate)
    enc.set_in_sample_rate(rate)
    enc.set_channels(1)
    enc.set_quality(2)
    blob = enc.encode(pcm) + enc.flush()
    with open(dst, "wb") as fh:
        fh.write(blob)
    return len(blob), len(mono) / rate


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--kristal", required=True, help="path to a Kristal checkout")
    ap.add_argument("--featherfall", required=True, help="path to a Featherfall checkout")
    ap.add_argument("--platformer", required=True, help="path to a deltarun-episode-5 checkout")
    args = ap.parse_args()
    roots = {
        "K": os.path.join(args.kristal, "assets", "sprites"),
        "F": os.path.join(args.featherfall, "assets", "sprites"),
        "W": args.platformer,
    }
    sound_roots = {
        "K": os.path.join(args.kristal, "assets", KSND),
        "F": os.path.join(args.featherfall, "assets", FSND),
    }
    os.makedirs(os.path.join(OUT, "sounds"), exist_ok=True)
    os.makedirs(os.path.join(OUT, "fonts"), exist_ok=True)

    frames = load_sprites(roots)
    fonts = {}
    for name, (key, rel, glyphs) in BITMAP_FONTS.items():
        img = Image.open(os.path.join(roots[key], rel)).convert("RGBA")
        rects = parse_image_font(img, glyphs)
        frames["font/" + name] = img
        fonts[name] = {"glyphs": glyphs, "rects": rects, "height": img.height}

    sheet, placed = pack(frames)
    sheet.save(os.path.join(OUT, "atlas.png"), optimize=True)
    for name, meta in fonts.items():
        meta["frame"] = "font/" + name
    with open(os.path.join(OUT, "atlas.json"), "w") as fh:
        json.dump({"frames": {k: list(v) for k, v in sorted(placed.items())}, "fonts": fonts},
                  fh, separators=(",", ":"))
    print("atlas: %d frames, %dx%d" % (len(placed), sheet.width, sheet.height))

    for key, rel, out_name in TTF_FONTS:
        # 8bitoperator's cmap ends with a 0xFFFF segment whose idDelta points past
        # the last glyph, which Chrome's OpenType sanitizer rejects. Decompiling
        # the cmap makes fontTools write a clean one on save.
        font = TTFont(os.path.join(roots[key], rel))
        for sub in font["cmap"].tables:
            sub.cmap = dict(sub.cmap)
        font.save(os.path.join(OUT, "fonts", out_name))

    total = 0
    for key, rel, out_name in SOUNDS:
        size, secs = encode_mp3(os.path.join(sound_roots[key], rel),
                                os.path.join(OUT, "sounds", out_name + ".mp3"), 64)
        total += size
    for key, rel, out_name in MUSIC:
        size, secs = encode_mp3(os.path.join(sound_roots[key], rel),
                                os.path.join(OUT, "sounds", out_name + ".mp3"), 80)
        total += size
    print("sounds: %d files, %.1f KB" % (len(SOUNDS) + len(MUSIC), total / 1024))


if __name__ == "__main__":
    main()
