/* ═══════════════════════════════════════════════════════════════════════
   SHINE · NOTIFY  (app component)                              v1.0.0
   Pair with notify.css. Zero dependencies, no build step, no markup to paste.

   Toast — dark pill at the bottom, tone shows in the icon colour
     ShineNotify.toast('Resume uploaded')                              neutral
     ShineNotify.toast('Job saved', { tone: 'success' })
     ShineNotify.toast('Couldn’t copy the link', { tone: 'error' })
       options: tone, icon (svg string), duration (ms; 0 = stay)

   Alert — contextual card at the top (icon disc · title · text · action)
     ShineNotify.alert({
       tone: 'error',                          success · warning · error · brand · neutral
       title: 'Couldn’t send OTP',
       text: 'Something went wrong on our side.',   (plain text; `html` instead for <b>…</b>)
       action: { label: 'Try again', onClick: retry },   or { label, href }
       icon: '<svg…>',                         optional — replaces the tone icon (e.g. a logo)
       duration: 6000                          ms; 0 = stays until dismissed
     })

   Both return a handle { dismiss() }. One toast and one alert at a time:
   a new one replaces the old. ShineNotify.dismiss('toast' | 'alert' | undefined).
   ShineNotify.configure({ toastBottom: 84, alertTop: 12 }) — px, e.g. to clear
   a page's own bottom bar. Fires `shine:notify` on document
   ({ kind, tone, message }) — the Android shell uses it for haptics.

   Behaviour: alerts slide down, toasts slide up; the timer pauses while the
   alert is pressed, hovered or focused; swipe an alert up (or tap it, or press
   Escape) to dismiss; tapping the action runs it and closes the alert.
   Durations default to the DS rules: toast 3 s (error 5 s); alert 5 s
   (warning / error 6 s; +2 s when it has an action).
   ═══════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  var doc = global.document;
  var TONES = ['success', 'warning', 'error', 'brand', 'neutral'];
  var ICONS = {   // filled 24-grid glyphs (DS: filled icon that echoes the intent)
    success: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm4.7 7.6-5.5 5.6a1.1 1.1 0 0 1-1.6 0l-2.3-2.3a1.1 1.1 0 1 1 1.6-1.6l1.5 1.5 4.7-4.8a1.1 1.1 0 0 1 1.6 1.6z"/></svg>',
    warning: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M10.3 3.4a2 2 0 0 1 3.4 0l8.1 14a2 2 0 0 1-1.7 3H3.9a2 2 0 0 1-1.7-3zM12 8.6c-.6 0-1.1.5-1.1 1.1v3.8a1.1 1.1 0 0 0 2.2 0V9.7c0-.6-.5-1.1-1.1-1.1zm0 9.2a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6z"/></svg>',
    error:   '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 5.2c.6 0 1.1.5 1.1 1.1v4.6a1.1 1.1 0 0 1-2.2 0V8.3c0-.6.5-1.1 1.1-1.1zm0 9.9a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6z"/></svg>',
    brand:   '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.5c.5 0 .9.3 1 .8l1.2 4.4c.3 1 1.1 1.8 2.1 2.1l4.4 1.2a1 1 0 0 1 0 2l-4.4 1.2c-1 .3-1.8 1.1-2.1 2.1L13 20.7a1 1 0 0 1-2 0l-1.2-4.4c-.3-1-1.1-1.8-2.1-2.1L3.3 13a1 1 0 0 1 0-2l4.4-1.2c1-.3 1.8-1.1 2.1-2.1L11 3.3c.1-.5.5-.8 1-.8z"/></svg>',
    neutral: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 4.9a1.3 1.3 0 1 1 0 2.6 1.3 1.3 0 0 1 0-2.6zm1.1 10a1.1 1.1 0 0 1-2.2 0v-4.6a1.1 1.1 0 0 1 2.2 0z"/></svg>'
  };
  var TOAST_ICONS = {   // toast: check for success, glyph per tone otherwise (14 px, on the dark pill)
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7"/></svg>',
    neutral: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7"/></svg>'
  };
  var cfg = { toastBottom: null, alertTop: null };
  var layers = {}, current = {};

  function tone(t) { return TONES.indexOf(t) > -1 ? t : 'neutral'; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function reduced() { return global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  function emit(detail) { try { doc.dispatchEvent(new CustomEvent('shine:notify', { detail: detail })); } catch (e) {} }

  function layer(kind) {
    if (layers[kind] && layers[kind].isConnected) return layers[kind];
    var l = doc.createElement('div');
    l.className = 'sn-layer sn-layer--' + kind;
    // persistent live regions: polite for toasts, the alert sets its own role per tone
    if (kind === 'toast') { l.setAttribute('role', 'status'); l.setAttribute('aria-live', 'polite'); }
    applyCfg(l);
    doc.body.appendChild(l);
    return (layers[kind] = l);
  }
  function applyCfg(l) {
    if (cfg.toastBottom != null) l.style.setProperty('--sn-toast-bottom', cfg.toastBottom + 'px'); else l.style.removeProperty('--sn-toast-bottom');
    if (cfg.alertTop != null) l.style.setProperty('--sn-alert-top', cfg.alertTop + 'px'); else l.style.removeProperty('--sn-alert-top');
  }

  /* shared lifecycle: in → timer (pausable) → out → removed */
  function lifecycle(kind, el, duration, onClose) {
    var timer = null, left = duration, started = 0, gone = false;
    function start() { if (!duration || gone) return; started = Date.now(); timer = setTimeout(close, left); el.classList.remove('is-paused'); }
    function pause() { if (!timer) return; clearTimeout(timer); timer = null; left -= Date.now() - started; el.classList.add('is-paused'); }
    function close() {
      if (gone) return; gone = true; clearTimeout(timer);
      el.classList.remove('is-in'); el.classList.add('is-out');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, reduced() ? 160 : 240);
      if (current[kind] && current[kind].el === el) current[kind] = null;
      if (onClose) onClose();
    }
    el.style.setProperty('--sn-dur', duration + 'ms');
    requestAnimationFrame(function () { requestAnimationFrame(function () {
      el.classList.add('is-in'); if (duration) el.classList.add('is-running'); start();
    }); });
    return { start: start, pause: pause, close: close };
  }

  function replace(kind) { if (current[kind]) current[kind].close(); }

  /* ── Toast ───────────────────────────────────────────────────────── */
  function toast(message, opts) {
    if (!doc.body) return { dismiss: function () {} };
    opts = opts || {};
    var t = tone(opts.tone || 'neutral');
    var duration = opts.duration != null ? opts.duration : (t === 'error' ? 5000 : 3000);
    replace('toast');
    var el = doc.createElement('div');
    el.className = 'sn-toast'; el.setAttribute('data-tone', t);
    var icon = opts.icon != null ? opts.icon : (TOAST_ICONS[t] || ICONS[t]);
    el.innerHTML = (icon ? '<span class="sn-toast-icon" aria-hidden="true">' + icon + '</span>' : '') + '<span class="sn-toast-text">' + esc(message) + '</span>';
    var l = layer('toast'); l.appendChild(el);
    var lc = lifecycle('toast', el, duration);
    current.toast = { el: el, close: lc.close };
    emit({ kind: 'toast', tone: t, message: String(message) });
    return { dismiss: lc.close };
  }

  /* ── Alert ───────────────────────────────────────────────────────── */
  function alert(o) {
    if (!doc.body) return { dismiss: function () {} };
    o = o || {};
    var t = tone(o.tone || 'neutral');
    var duration = o.duration != null ? o.duration : ((t === 'error' || t === 'warning') ? 6000 : 5000) + (o.action ? 2000 : 0);
    replace('alert');
    var el = doc.createElement('div');
    el.className = 'sn-alert'; el.setAttribute('data-tone', t);
    el.setAttribute('role', t === 'error' || t === 'warning' ? 'alert' : 'status');
    var a = o.action, cta = '';
    if (a && a.label) cta = a.href ? '<a class="sn-alert-cta" href="' + esc(a.href) + '">' + esc(a.label) + '</a>'
                                   : '<button class="sn-alert-cta" type="button">' + esc(a.label) + '</button>';
    el.innerHTML =
      '<span class="sn-alert-disc" aria-hidden="true">' + (o.icon || ICONS[t]) + '</span>' +
      '<div class="sn-alert-body">' +
        (o.title ? '<span class="sn-alert-title">' + esc(o.title) + '</span>' : '') +
        (o.html != null ? '<span class="sn-alert-text">' + o.html + '</span>' : (o.text ? '<span class="sn-alert-text">' + esc(o.text) + '</span>' : '')) +
      '</div>' + cta +
      (duration ? '<span class="sn-alert-timer" aria-hidden="true"></span>' : '') +
      '<span class="sn-sr">Swipe up or tap to dismiss.</span>';
    var l = layer('alert'); l.appendChild(el);
    var lc = lifecycle('alert', el, duration, o.onClose);
    current.alert = { el: el, close: lc.close };

    // action
    var btn = el.querySelector('.sn-alert-cta');
    if (btn) btn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (a.onClick) { if (!a.href) e.preventDefault(); a.onClick(e); }
      lc.close();
    });
    // pause while attended
    el.addEventListener('mouseenter', lc.pause); el.addEventListener('mouseleave', lc.start);
    el.addEventListener('focusin', lc.pause); el.addEventListener('focusout', lc.start);
    // swipe up / tap to dismiss
    var y0 = null, dy = 0, moved = false;
    el.addEventListener('pointerdown', function (e) {
      if (e.target.closest('.sn-alert-cta')) return;
      y0 = e.clientY; dy = 0; moved = false; lc.pause(); el.classList.add('is-dragging');
      try { el.setPointerCapture(e.pointerId); } catch (x) {}
    });
    el.addEventListener('pointermove', function (e) {
      if (y0 == null) return;
      dy = Math.min(0, e.clientY - y0) + Math.max(0, e.clientY - y0) * 0.2;   // up freely, down with resistance
      if (Math.abs(e.clientY - y0) > 4) moved = true;
      el.style.transform = 'translateY(' + dy + 'px)'; el.style.opacity = String(Math.max(0.2, 1 + dy / 120));
    });
    function release() {
      if (y0 == null) return;
      el.classList.remove('is-dragging'); y0 = null;
      if (dy < -28 || !moved) { el.style.transform = ''; el.style.opacity = ''; lc.close(); return; }
      el.style.transform = ''; el.style.opacity = ''; lc.start();
    }
    el.addEventListener('pointerup', release); el.addEventListener('pointercancel', function () { moved = true; release(); });

    emit({ kind: 'alert', tone: t, message: String(o.title || o.text || '') });
    return { dismiss: lc.close };
  }

  function dismiss(kind) {
    ['toast', 'alert'].forEach(function (k) { if ((!kind || kind === k) && current[k]) current[k].close(); });
  }
  function configure(o) {
    o = o || {};
    if ('toastBottom' in o) cfg.toastBottom = o.toastBottom;
    if ('alertTop' in o) cfg.alertTop = o.alertTop;
    for (var k in layers) if (layers[k]) applyCfg(layers[k]);
  }
  // Escape closes the alert first (and only the alert), before sheets / modals underneath react
  global.addEventListener('keydown', function (e) { if (e.key === 'Escape' && current.alert) { current.alert.close(); e.stopImmediatePropagation(); } }, true);

  global.ShineNotify = { toast: toast, alert: alert, dismiss: dismiss, configure: configure, tones: TONES.slice(), version: '1.0.0' };
})(window);
