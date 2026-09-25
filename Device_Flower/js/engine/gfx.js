/* Device_Flower - sprite atlas, tinting, text and bitmap fonts. */
(function () {
  'use strict';
  const DF = window.DF;
  const U = DF.U;

  const G = (DF.G = {
    canvas: null,
    ctx: null,
    atlas: null,
    frames: {},
    fonts: {},
    animCache: {},
    tintCache: new Map(),
    shakeX: 0,
    shakeY: 0,
  });

  G.init = function (canvas) {
    G.canvas = canvas;
    G.ctx = canvas.getContext('2d');
    G.ctx.imageSmoothingEnabled = false;
  };

  G.load = function () {
    const data = window.DF_DATA;
    G.frames = data.atlas.frames;
    G.fonts = data.atlas.fonts;
    const imgP = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('atlas failed to load'));
      img.src = data.atlas.image;
    }).then((img) => {
      G.atlas = img;
    });
    const fontP = Promise.all(
      [
        ['DFMain', data.ttf.main],
        ['DFMono', data.ttf.mono],
      ].map(([family, b64]) => {
        try {
          const face = new FontFace(family, base64ToBuffer(b64));
          return face.load().then((f) => document.fonts.add(f));
        } catch (e) {
          return Promise.resolve();
        }
      })
    ).catch(() => {});
    return Promise.all([imgP, fontP]);
  };

  function base64ToBuffer(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out.buffer;
  }
  G.base64ToBuffer = base64ToBuffer;

  G.has = (name) => !!G.frames[name];
  G.size = function (name) {
    const f = G.frames[name];
    return f ? { w: f[2], h: f[3] } : { w: 0, h: 0 };
  };

  // All frames of "prefix_N" in numeric order.
  G.anim = function (prefix) {
    let list = G.animCache[prefix];
    if (list) return list;
    list = [];
    for (let i = 1; G.frames[prefix + '_' + i]; i++) list.push(prefix + '_' + i);
    G.animCache[prefix] = list;
    return list;
  };
  G.frameAt = function (prefix, t, fps, loop) {
    const list = G.anim(prefix);
    if (!list.length) return prefix;
    let i = Math.floor(t * fps);
    if (loop === false) i = Math.min(i, list.length - 1);
    else i = ((i % list.length) + list.length) % list.length;
    return list[i];
  };

  // A tinted (multiply) or solid-colour (fill) copy of a frame, cached.
  G.tinted = function (name, color, mode) {
    const key = name + '|' + color + '|' + (mode || 'm');
    let c = G.tintCache.get(key);
    if (c) return c;
    const f = G.frames[name];
    if (!f) return null;
    c = document.createElement('canvas');
    c.width = f[2];
    c.height = f[3];
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    x.drawImage(G.atlas, f[0], f[1], f[2], f[3], 0, 0, f[2], f[3]);
    if (mode === 'fill') {
      x.globalCompositeOperation = 'source-in';
      x.fillStyle = color;
      x.fillRect(0, 0, f[2], f[3]);
    } else {
      x.globalCompositeOperation = 'multiply';
      x.fillStyle = color;
      x.fillRect(0, 0, f[2], f[3]);
      x.globalCompositeOperation = 'destination-in';
      x.drawImage(G.atlas, f[0], f[1], f[2], f[3], 0, 0, f[2], f[3]);
    }
    G.tintCache.set(key, c);
    return c;
  };

  /*
   * Draw a frame. Defaults: 2x scale, origin top-left.
   * o: { sx, sy, scale, ox, oy (0..1 origin), rot, alpha, flip, flipY, tint, fill, fillAmt, add }
   */
  G.draw = function (name, x, y, o) {
    const f = G.frames[name];
    if (!f) return;
    const ctx = G.ctx;
    o = o || {};
    const scale = o.scale !== undefined ? o.scale : 2;
    const sx = (o.sx !== undefined ? o.sx : scale) * (o.flip ? -1 : 1);
    const sy = (o.sy !== undefined ? o.sy : scale) * (o.flipY ? -1 : 1);
    const ox = (o.ox || 0) * f[2];
    const oy = (o.oy || 0) * f[3];
    const alpha = o.alpha !== undefined ? o.alpha : 1;
    if (alpha <= 0) return;
    let src = G.atlas;
    let fx = f[0];
    let fy = f[1];
    if (o.tint && o.tint !== '#fff' && o.tint !== '#ffffff') {
      src = G.tinted(name, o.tint);
      fx = fy = 0;
    }
    ctx.save();
    ctx.globalAlpha *= alpha;
    if (o.add) ctx.globalCompositeOperation = 'lighter';
    ctx.translate(x, y);
    if (o.rot) ctx.rotate(o.rot);
    ctx.scale(sx, sy);
    ctx.drawImage(src, fx, fy, f[2], f[3], -ox, -oy, f[2], f[3]);
    if (o.fill && o.fillAmt > 0) {
      ctx.globalAlpha = alpha * U.clamp(o.fillAmt, 0, 1);
      ctx.drawImage(G.tinted(name, o.fill, 'fill'), -ox, -oy);
    }
    ctx.restore();
  };

  // Draw a sub-rectangle of a frame at 1x (used by the TP bar).
  G.drawPart = function (name, x, y, sx, sy, sw, sh, tint) {
    const f = G.frames[name];
    if (!f || sw <= 0 || sh <= 0) return;
    if (tint) G.ctx.drawImage(G.tinted(name, tint), sx, sy, sw, sh, x, y, sw, sh);
    else G.ctx.drawImage(G.atlas, f[0] + sx, f[1] + sy, sw, sh, x, y, sw, sh);
  };

  // Solid silhouette of a frame (flashes, afterimages).
  G.drawFill = function (name, x, y, color, o) {
    const f = G.frames[name];
    if (!f) return;
    const ctx = G.ctx;
    o = o || {};
    const scale = o.scale !== undefined ? o.scale : 2;
    const sx = (o.sx !== undefined ? o.sx : scale) * (o.flip ? -1 : 1);
    const sy = o.sy !== undefined ? o.sy : scale;
    ctx.save();
    ctx.globalAlpha *= o.alpha !== undefined ? o.alpha : 1;
    if (o.add) ctx.globalCompositeOperation = 'lighter';
    ctx.translate(x, y);
    if (o.rot) ctx.rotate(o.rot);
    ctx.scale(sx, sy);
    ctx.drawImage(G.tinted(name, color, 'fill'), -(o.ox || 0) * f[2], -(o.oy || 0) * f[3]);
    ctx.restore();
  };

  // ---- TrueType text ------------------------------------------------------
  const FAMILY = { main: 'DFMain', mono: 'DFMono' };
  const widthCache = {};
  G.setFont = function (font, size) {
    G.ctx.font = (size || 32) + 'px ' + (FAMILY[font] || font) + ', monospace';
  };
  G.textWidth = function (str, font, size) {
    font = font || 'main';
    size = size || 32;
    const key = font + size + '|' + str;
    let w = widthCache[key];
    if (w === undefined) {
      G.setFont(font, size);
      w = G.ctx.measureText(str).width;
      widthCache[key] = w;
    }
    return w;
  };
  /*
   * o: { font, size, color, align ('left'|'center'|'right'), alpha, shadow (color), sx, sy (scale) }
   * y is the top of the text line.
   */
  G.text = function (str, x, y, o) {
    o = o || {};
    const ctx = G.ctx;
    const size = o.size || 32;
    G.setFont(o.font || 'main', size);
    ctx.save();
    if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
    ctx.textBaseline = 'top';
    ctx.textAlign = o.align || 'left';
    const tx = Math.round(x);
    const ty = Math.round(y - size * 0.06);
    if (o.sx || o.sy) {
      ctx.translate(tx, ty);
      ctx.scale(o.sx || 1, o.sy || 1);
      if (o.shadow) {
        ctx.fillStyle = o.shadow;
        ctx.fillText(str, 2, 2);
      }
      ctx.fillStyle = o.color || '#fff';
      ctx.fillText(str, 0, 0);
    } else {
      if (o.shadow) {
        ctx.fillStyle = o.shadow;
        ctx.fillText(str, tx + 2, ty + 2);
      }
      if (o.outline) {
        ctx.strokeStyle = o.outline;
        ctx.lineWidth = o.outlineWidth || 4;
        ctx.lineJoin = 'round';
        ctx.strokeText(str, tx, ty);
      }
      ctx.fillStyle = o.color || '#fff';
      ctx.fillText(str, tx, ty);
    }
    ctx.restore();
  };

  // Word-wrap to a pixel width. Keeps explicit newlines.
  G.wrap = function (str, maxW, font, size) {
    const out = [];
    for (const para of String(str).split('\n')) {
      const words = para.split(' ');
      let line = '';
      for (const w of words) {
        const test = line ? line + ' ' + w : w;
        if (line && G.textWidth(test, font, size) > maxW) {
          out.push(line);
          line = w;
        } else line = test;
      }
      out.push(line);
    }
    return out;
  };

  // ---- bitmap fonts (plain, smallnumbers, bignumbers, goldnumbers, name) --
  G.bitmapWidth = function (fontName, str, spacing) {
    const font = G.fonts[fontName];
    if (!font) return 0;
    let w = 0;
    for (const ch of String(str)) {
      const i = font.glyphs.indexOf(ch);
      const r = font.rects[i >= 0 ? i : 0];
      w += r[1] + (spacing || 0);
    }
    return w;
  };
  /* o: { scale, color (multiply tint), align, alpha, spacing } */
  G.bitmapText = function (fontName, str, x, y, o) {
    const font = G.fonts[fontName];
    if (!font) return;
    o = o || {};
    const scale = o.scale || 1;
    const spacing = o.spacing || 0;
    const frame = G.frames[font.frame];
    str = String(str);
    let cx = x;
    const w = G.bitmapWidth(fontName, str, spacing) * scale;
    if (o.align === 'center') cx = x - w / 2;
    else if (o.align === 'right') cx = x - w;
    let src = G.atlas;
    let baseX = frame[0];
    let baseY = frame[1];
    if (o.color && o.color !== '#fff' && o.color !== '#ffffff') {
      src = G.tinted(font.frame, o.color, o.fill ? 'fill' : undefined);
      baseX = baseY = 0;
    }
    const ctx = G.ctx;
    ctx.save();
    if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
    for (const ch of str) {
      const i = font.glyphs.indexOf(ch);
      const r = font.rects[i >= 0 ? i : 0];
      if (ch !== ' ') {
        ctx.drawImage(src, baseX + r[0], baseY, r[1], font.height, Math.round(cx), Math.round(y), r[1] * scale, font.height * scale);
      }
      cx += (r[1] + spacing) * scale;
    }
    ctx.restore();
  };

  // ---- misc primitives ----------------------------------------------------
  G.rect = function (x, y, w, h, color, alpha) {
    const ctx = G.ctx;
    if (alpha !== undefined) {
      ctx.save();
      ctx.globalAlpha *= alpha;
    }
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
    if (alpha !== undefined) ctx.restore();
  };
  G.strokeRect = function (x, y, w, h, color, lw) {
    const ctx = G.ctx;
    ctx.strokeStyle = color;
    ctx.lineWidth = lw || 1;
    ctx.strokeRect(x + (lw || 1) / 2, y + (lw || 1) / 2, w - (lw || 1), h - (lw || 1));
  };
  G.line = function (x1, y1, x2, y2, color, lw) {
    const ctx = G.ctx;
    ctx.strokeStyle = color;
    ctx.lineWidth = lw || 1;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };
  G.circle = function (x, y, r, color, alpha) {
    const ctx = G.ctx;
    ctx.save();
    if (alpha !== undefined) ctx.globalAlpha *= alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };
  G.ring = function (x, y, r, color, lw, alpha) {
    const ctx = G.ctx;
    ctx.save();
    if (alpha !== undefined) ctx.globalAlpha *= alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = lw || 2;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  };

  // Offscreen pixel-art sprite built from a tiny ascii map (for procedural bullets).
  G.pixelSprite = function (rows, palette) {
    const h = rows.length;
    const w = rows[0].length;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const x = c.getContext('2d');
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const ch = rows[j][i];
        if (ch === '.' || ch === ' ') continue;
        x.fillStyle = palette[ch] || '#fff';
        x.fillRect(i, j, 1, 1);
      }
    return c;
  };
  G.drawCanvas = function (c, x, y, o) {
    o = o || {};
    const ctx = G.ctx;
    const scale = o.scale !== undefined ? o.scale : 2;
    ctx.save();
    ctx.globalAlpha *= o.alpha !== undefined ? o.alpha : 1;
    if (o.add) ctx.globalCompositeOperation = 'lighter';
    ctx.translate(x, y);
    if (o.rot) ctx.rotate(o.rot);
    ctx.scale(scale * (o.flip ? -1 : 1), scale);
    ctx.drawImage(c, -(o.ox !== undefined ? o.ox : 0.5) * c.width, -(o.oy !== undefined ? o.oy : 0.5) * c.height);
    ctx.restore();
  };
  // Tinted/filled copies of procedural canvases.
  const canvasTints = new WeakMap();
  G.canvasFill = function (c, color) {
    let m = canvasTints.get(c);
    if (!m) {
      m = {};
      canvasTints.set(c, m);
    }
    if (m[color]) return m[color];
    const out = document.createElement('canvas');
    out.width = c.width;
    out.height = c.height;
    const x = out.getContext('2d');
    x.drawImage(c, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = color;
    x.fillRect(0, 0, c.width, c.height);
    m[color] = out;
    return out;
  };
})();
