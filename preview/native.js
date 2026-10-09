/* Shine Preview (Android) — tiny bridge between the web pages and the app shell.
   Only runs inside the APK (window.ShineNative is provided by MainActivity); in a browser it does nothing. */
(function () {
  'use strict';
  var N = window.ShineNative;
  var html = document.documentElement;
  html.classList.add(N ? 'in-app' : 'in-browser');
  if (!N) return;

  /* native feel: no long-press callout / text selection on UI chrome (inputs still selectable) */
  var st = document.createElement('style');
  st.textContent = 'html.in-app{-webkit-touch-callout:none;-webkit-user-select:none;user-select:none}' +
    'html.in-app input,html.in-app textarea,html.in-app [contenteditable]{-webkit-user-select:text;user-select:text}';
  document.head.appendChild(st);

  /* clipboard: use the app's native clipboard (the web Clipboard API is unreliable inside WebView) */
  try {
    var cb = { writeText: function (t) { return N.copy(String(t)) ? Promise.resolve() : Promise.reject(new Error('copy failed')); },
               readText: function () { return Promise.reject(new Error('not available')); } };
    Object.defineProperty(navigator, 'clipboard', { value: cb, configurable: true });
  } catch (e) {}

  /* haptics */
  var last = 0;
  function buzz(kind) { var t = Date.now(); if ((kind === 'tap' || kind === 'tick') && t - last < 60) return; last = t; try { N.haptic(kind); } catch (e) {} }   // success / error always play (an error right after a tap must still be felt)
  document.addEventListener('click', function (e) {
    var el = e.target.closest('button, a[href], [role="tab"], [role="switch"], [role="radio"], .acct');
    if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return;
    var r = el.getAttribute('role');
    buzz(r === 'switch' || r === 'tab' || r === 'radio' ? 'tick' : 'tap');
  }, true);

  var lastErr = 0;
  function onReady() {
    /* success (logged in / password updated) and error (invalid field, failed OTP, error alert) */
    new MutationObserver(function (list) {
      list.forEach(function (m) {
        var n = m.target;
        if (m.type === 'attributes' && m.attributeName === 'hidden' && n.classList && n.classList.contains('view') && !n.hidden) {
          var v = n.getAttribute('data-view'); if (v === 'done' || v === 'updated') buzz('success');
        }
        if (m.type === 'attributes' && m.attributeName === 'class' && n.classList &&
            (n.classList.contains('field--invalid') || n.classList.contains('otp--invalid')) &&
            !(m.oldValue || '').match(/field--invalid|otp--invalid/)) err();
        if (m.type === 'childList') m.addedNodes.forEach(function (a) { if (a.nodeType === 1 && a.matches && a.matches('.alert--negative')) err(); });
      });
    }).observe(document.body, { subtree: true, attributes: true, attributeOldValue: true, attributeFilter: ['hidden', 'class'], childList: true });

    /* system bars follow what is actually on screen (see sampleBars) */
    schedule();
  }

  /* ── system bars: sample the colour really painted at the top and bottom edge ──
     composites every layer at that point (scrims, sheets, sticky headers, gradients) */
  /* ▼ bar-sampler (shared by the JSRP page and the Android shell's native.js — edit /home/claude/jsrp/bar_sampler.js, then resync)
     barColour(x0, x1, y) → [r,g,b]: the colour painted along the row y between x0 and x1, as one flat colour.
     Composites every surface layer under each sample point — backgrounds, ::before / ::after glows, scrims, sheets —
     and evaluates linear / radial gradients at the point. Seven samples across the row, trimmed mean. */
  var BAR_BASE = [250, 249, 246];                                  // page colour (#FAF9F6)
  function bsRgba(s) {
    var m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?/.exec(s || ''); if (!m) return null;
    var a = m[4] === undefined ? 1 : (m[4].slice(-1) === '%' ? parseFloat(m[4]) / 100 : +m[4]);
    return [+m[1], +m[2], +m[3], a];
  }
  function bsSplit(s) {                                            // split on top-level commas
    var out = [], d = 0, cur = '';
    for (var i = 0; i < s.length; i++) { var ch = s[i]; if (ch === '(') d++; else if (ch === ')') d--; if (ch === ',' && !d) { out.push(cur.trim()); cur = ''; } else cur += ch; }
    if (cur.trim()) out.push(cur.trim()); return out;
  }
  function bsLen(v, ref) { v = (v || '').trim(); if (/%$/.test(v)) return parseFloat(v) / 100 * ref; if (/px$/.test(v)) return parseFloat(v); return NaN; }
  function bsStops(parts, len) {                                   // → [{c:[r,g,b,a], p:px}]
    var st = [];
    parts.forEach(function (t) {
      var c = bsRgba(t); if (!c) return;
      var rest = t.slice(t.indexOf(')') + 1).trim().split(/\s+/).filter(Boolean);
      if (!rest.length) st.push({ c: c, p: NaN });
      rest.forEach(function (r) { st.push({ c: c, p: bsLen(r, len) }); });
    });
    if (!st.length) return null;
    if (isNaN(st[0].p)) st[0].p = 0;
    if (isNaN(st[st.length - 1].p)) st[st.length - 1].p = len;
    for (var i = 1; i < st.length; i++) {                          // fix-up: monotonic, spread unpositioned stops
      if (!isNaN(st[i].p)) { if (st[i].p < st[i - 1].p) st[i].p = st[i - 1].p; continue; }
      var j = i; while (isNaN(st[j].p)) j++;
      for (var k = i; k < j; k++) st[k].p = st[i - 1].p + (st[j].p - st[i - 1].p) * (k - i + 1) / (j - i + 1);
    }
    return st;
  }
  function bsAt(st, t) {                                           // premultiplied interpolation, like the browser
    if (t <= st[0].p) return st[0].c; var L = st[st.length - 1]; if (t >= L.p) return L.c;
    for (var i = 1; i < st.length; i++) if (t <= st[i].p) {
      var a = st[i - 1], b = st[i], f = b.p === a.p ? 1 : (t - a.p) / (b.p - a.p);
      var al = a.c[3] + (b.c[3] - a.c[3]) * f; if (al <= 0) return [0, 0, 0, 0];
      return [0, 1, 2].map(function (k) { return (a.c[k] * a.c[3] + (b.c[k] * b.c[3] - a.c[k] * a.c[3]) * f) / al; }).concat(al);
    }
    return L.c;
  }
  function bsGradient(img, box, x, y) {                            // one background layer at (x, y) inside box
    var m = /^(repeating-)?(linear|radial)-gradient\((.*)\)$/.exec(img); if (!m || m[1]) return null;
    var parts = bsSplit(m[3]), lx = x - box.left, ly = y - box.top, W = box.width, H = box.height, head = parts[0];
    if (m[2] === 'linear') {
      var ang = 180;
      if (!bsRgba(head)) {
        parts = parts.slice(1);
        if (/^to top$/.test(head)) ang = 0; else if (/^to bottom$/.test(head)) ang = 180; else if (/^to right$/.test(head)) ang = 90; else if (/^to left$/.test(head)) ang = 270;
        else if (/deg$/.test(head)) ang = parseFloat(head); else return null;
      }
      var r = ang * Math.PI / 180, dx = Math.sin(r), dy = -Math.cos(r), gl = Math.abs(W * dx) + Math.abs(H * dy);
      var st = bsStops(parts, gl); if (!st) return null;
      return bsAt(st, (lx - W / 2) * dx + (ly - H / 2) * dy + gl / 2);
    }
    var cx = W / 2, cy = H / 2, circle = false, size = 'farthest-corner', ex = null;
    if (!bsRgba(head)) {
      parts = parts.slice(1);
      var at = head.split(/\s+at\s+|^at\s+/), shape = (head.indexOf('at ') === 0 ? '' : at[0]).trim();
      if (head.indexOf('at') >= 0) { var pos = (at[1] || at[0].replace(/^at\s+/, '')).trim().split(/\s+/);
        var px = { left: '0%', center: '50%', right: '100%', top: '0%', bottom: '100%' };
        cx = bsLen(px[pos[0]] || pos[0], W); cy = bsLen(px[pos[1] || 'center'] || pos[1], H); if (isNaN(cx) || isNaN(cy)) return null; }
      shape.split(/\s+/).forEach(function (w) { if (w === 'circle') circle = true; else if (/side|corner/.test(w)) size = w; else if (/px$/.test(w)) ex = (ex || []).concat(parseFloat(w)); });
      if (ex && ex.length === 1) circle = true;
    }
    var fx = Math.max(cx, W - cx), fy = Math.max(cy, H - cy), nx = Math.min(cx, W - cx), ny = Math.min(cy, H - cy), rx, ry;
    if (ex) { rx = ex[0]; ry = ex[1] || ex[0]; }
    else if (circle) { rx = ry = size === 'closest-side' ? Math.min(nx, ny) : size === 'farthest-side' ? Math.max(fx, fy) : size === 'closest-corner' ? Math.hypot(nx, ny) : Math.hypot(fx, fy); }
    else if (/side/.test(size)) { rx = size === 'closest-side' ? nx : fx; ry = size === 'closest-side' ? ny : fy; }
    else { var bx = size === 'closest-corner' ? nx : fx, by = size === 'closest-corner' ? ny : fy; rx = bx * Math.SQRT2; ry = by * Math.SQRT2; }
    if (!rx || !ry) return null;
    var st2 = bsStops(parts, rx); if (!st2) return null;
    return bsAt(st2, Math.hypot((lx - cx) / rx, (ly - cy) / ry) * rx);
  }
  function bsLayers(cs, box, x, y, out, mul) {                          // push this box's paint, top layer first
    var imgs = cs.backgroundImage && cs.backgroundImage !== 'none' ? bsSplit(cs.backgroundImage) : [];
    var sizes = bsSplit(cs.backgroundSize || 'auto'), op = mul;
    imgs.forEach(function (img, i) {
      var sz = (sizes[i] || sizes[0] || 'auto').trim();
      if (sz !== 'auto' && sz !== 'auto auto' && sz !== '100% 100%' && sz !== 'cover') return;   // small repeating patterns: skip
      var c = bsGradient(img, box, x, y); if (c && c[3] > 0) out.push([c[0], c[1], c[2], c[3] * op]);
    });
    var bg = bsRgba(cs.backgroundColor); if (bg && bg[3] > 0) out.push([bg[0], bg[1], bg[2], bg[3] * op]);
  }
  function bsPseudo(el, rect, which, x, y, out) {
    var cs = getComputedStyle(el, which);
    if (cs.content === 'none' || cs.content === 'normal' || cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return;
    if (cs.position !== 'absolute' && cs.position !== 'fixed') return;
    var ref = cs.position === 'fixed' ? { left: 0, top: 0, width: innerWidth, height: innerHeight } : rect;
    var L = bsLen(cs.left, ref.width), R = bsLen(cs.right, ref.width), T = bsLen(cs.top, ref.height), B = bsLen(cs.bottom, ref.height);
    var w = bsLen(cs.width, ref.width), h = bsLen(cs.height, ref.height);
    if (isNaN(w)) w = ref.width - (L || 0) - (R || 0); if (isNaN(h)) h = ref.height - (T || 0) - (B || 0);
    var left = ref.left + (isNaN(L) ? (isNaN(R) ? 0 : ref.width - R - w) : L), top = ref.top + (isNaN(T) ? (isNaN(B) ? 0 : ref.height - B - h) : T);
    var tm = /matrix\(([^)]*)\)/.exec(cs.transform || ''); if (tm) { tm = tm[1].split(',').map(parseFloat); left += tm[4]; top += tm[5]; }   // translate (blur / scale ignored)
    var box = { left: left, top: top, width: w, height: h };
    if (x < box.left || x > box.left + w || y < box.top || y > box.top + h) return;
    bsLayers(cs, box, x, y, out, parseFloat(cs.opacity));
  }
  function bsPoint(x, y, span) {                                  // only surfaces count: boxes spanning (almost) the whole row
    var els = document.elementsFromPoint(x, y), layers = [];         // — buttons, chips and inset cards under the edge are ignored
    for (var i = 0; i < els.length; i++) {
      var el = els[i], cs = getComputedStyle(el); if (parseFloat(cs.opacity) === 0 || cs.visibility === 'hidden') continue;
      var rect = el.getBoundingClientRect(), mine = [], stop = false;
      if (rect.width < span * 0.96) continue;
      bsPseudo(el, rect, '::after', x, y, mine); bsPseudo(el, rect, '::before', x, y, mine); bsLayers(cs, rect, x, y, mine, 1);
      var op = 1; for (var p = el; p && op > 0.01; p = p.parentElement) op *= parseFloat(getComputedStyle(p).opacity);   // own + faded ancestors
      for (var j = 0; j < mine.length; j++) { mine[j][3] *= op; layers.push(mine[j]); if (mine[j][3] >= 0.995) { stop = true; break; } }
      if (stop) break;
    }
    var out = BAR_BASE.slice();
    for (var k = layers.length - 1; k >= 0; k--) { var c = layers[k]; out = [0, 1, 2].map(function (n) { return c[n] * c[3] + out[n] * (1 - c[3]); }); }
    return out;
  }
  function barColour(x0, x1, y) {
    var s = [];
    for (var i = 0; i < 7; i++) s.push(bsPoint(Math.min(innerWidth - 1, Math.max(0, x0 + 1 + (x1 - x0 - 2) * i / 6)), y, x1 - x0));
    s.sort(function (a, b) { return (a[0] * .3 + a[1] * .59 + a[2] * .11) - (b[0] * .3 + b[1] * .59 + b[2] * .11); });
    s = s.slice(1, 6);                                             // drop the lightest and darkest sample
    return [0, 1, 2].map(function (n) { return Math.round(s.reduce(function (t, c) { return t + c[n]; }, 0) / s.length); });
  }
  function barHex(c) { return '#' + c.map(function (v) { return ('0' + Math.round(v).toString(16)).slice(-2); }).join(''); }
  /* ▲ bar-sampler */
  var sent = '', timers = [], lastS = 0;
  function sampleBars(force) {
    if (document.hidden || !document.body) return;
    var now = performance.now(); if (force !== true && now - lastS < 66) return;   // at most ~15 samples/s while scrolling
    lastS = now;
    var w = innerWidth, h = innerHeight;
    var key = barHex(barColour(0, w, 1)) + '|' + barHex(barColour(0, w, h - 2));
    if (key === sent) return; sent = key;
    var k = key.split('|'); try { N.setBars(k[0], k[1]); } catch (e) {}
  }
  var raf = 0;
  function schedule() {                     // sample now and while transitions settle (sheets slide, scrims fade)
    if (!raf) raf = requestAnimationFrame(function () { raf = 0; sampleBars(); });
    timers.forEach(clearTimeout);
    timers = [90, 200, 360, 600].map(function (t) { return setTimeout(sampleBars, t, true); });
  }
  ['scroll', 'touchend', 'click', 'transitionend', 'animationend', 'popstate', 'resize', 'pageshow', 'focusin',
   'shine:sheet-open', 'shine:sheet-opened', 'shine:sheet-close', 'shine:sheet-closed'].forEach(function (ev) {
    (ev === 'resize' || ev === 'popstate' || ev === 'pageshow' ? window : document).addEventListener(ev, schedule, { capture: true, passive: true });
  });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) { sent = ''; schedule(); } });
  new MutationObserver(schedule).observe(html, { subtree: true, attributes: true, attributeFilter: ['hidden', 'class', 'style', 'open'] });
  window.addEventListener('load', schedule);

  /* notify component (toasts + floating alerts): buzz for alerts that need attention */
  document.addEventListener('shine:notify', function (e) {
    var d = e.detail || {}; if (d.kind !== 'alert') return;
    if (d.tone === 'error' || d.tone === 'warning') err(); else if (d.tone === 'success') buzz('success');
  });

  function err() { var t = Date.now(); if (t - lastErr < 400) return; lastErr = t; buzz('error'); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', onReady); else onReady();
})();
