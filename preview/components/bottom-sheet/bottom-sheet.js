/* ═══════════════════════════════════════════════════════════════════════
   SHINE · BOTTOM SHEET  (app component)                        v1.2.1
   Pair with bottom-sheet.css. Zero dependencies, no build step.

   Markup (any element with .bs — it starts closed via [hidden]):

     <div class="bs" id="sortSheet" hidden>
       <div class="bs-handle"></div>
       <div class="bs-head">
         <h2 class="bs-title">Sort by</h2>
         <button class="bs-close" data-bs-close aria-label="Close">…</button>
       </div>
       <div class="bs-body">…</div>
       <div class="bs-foot">…</div>          (optional)
     </div>

   Call to action — two behaviours (.bs-actions = the sheet's button group):
     inline   <div class="bs-body">… <div class="bs-actions">…</div></div>
              follows the content, scrolls with it (nudges, confirm, OTP)
     sticky   <div class="bs-body">…</div><div class="bs-foot"><div class="bs-actions">…</div></div>
              pinned; body scrolls under it (filters, pickers, lists, forms)
     data-bs-cta="inline|sticky|auto" on .bs → ShineSheet places .bs-actions
     wherever you wrote it; "auto" keeps it inline while everything fits and
     pins it as soon as the body overflows (small phone, keyboard, long list).
     Live state: data-bs-cta-state="inline|sticky" + event shine:sheet-cta.

   Open / close:
     <button data-bs-open="#sortSheet">Sort</button>          declarative
     ShineSheet.open('#sortSheet', { trigger: btn })          programmatic
     ShineSheet.close('#sortSheet')   ·   ShineSheet.closeAll()
     ShineSheet.isOpen(el)   ·   ShineSheet.top()

   Per-sheet options (attributes on .bs):
     data-bs-dismiss="false"   no backdrop / Escape / drag dismissal
     data-bs-drag="false"      no drag-to-dismiss
     data-bs-scrim="strong"    45% scrim + blur (nudges)  ·  "none" = no scrim
     data-bs-autofocus         on a child → focused on open (default: the sheet)
     data-bs-cta="…"           inline | sticky | auto — call-to-action behaviour
     .bs--nested               opens inside its parent .bs and covers it

   Events (dispatched on the sheet, bubbling):
     shine:sheet-open    cancelable   detail { trigger }
     shine:sheet-opened
     shine:sheet-close   cancelable   detail { reason }   reason: close-button
                                      | backdrop | escape | drag | api
     shine:sheet-closed               detail { reason }
     shine:sheet-cta                  detail { state }    inline ⇄ sticky (auto)

   Behaviour (WAI-ARIA dialog pattern + platform sheet conventions):
     role="dialog" + aria-modal + aria-labelledby (from .bs-title) · focus
     moves in, Tab is trapped, focus returns to the trigger · Escape closes
     the top sheet · page scroll locked while any sheet is open · stacking
     (a sheet over a sheet gets its own scrim level) · drag the handle or
     header down to dismiss (velocity- or distance-based) · trigger gets
     aria-expanded · reduced motion respected · closed = [hidden].
     v1.2 · keyboard-aware (content padded above the on-screen keyboard while
     the sheet surface runs on behind it — v1.2.1; height capped to the visible area) · status-bar tint: while a scrim is up html/body
     get the dimmed page colour, so iOS 26 Safari's status bar dims with it.
   ═══════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  if (global.ShineSheet) return;
  var doc = global.document;

  var stack = [];                    // open sheets, bottom → top
  var uid = 0;
  var FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  var reduced = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)');

  function $(t) { return typeof t === 'string' ? doc.querySelector(t) : t; }
  function emit(el, name, detail, cancelable) {
    var ev;
    try { ev = new CustomEvent(name, { bubbles: true, cancelable: !!cancelable, detail: detail || {} }); }
    catch (e) { ev = doc.createEvent('CustomEvent'); ev.initCustomEvent(name, true, !!cancelable, detail || {}); }
    return el.dispatchEvent(ev);
  }
  function attr(el, name, val) { return el.getAttribute(name) === val; }
  function isNested(el) { return el.classList.contains('bs--nested'); }
  function dismissible(el) { return !attr(el, 'data-bs-dismiss', 'false'); }
  function durationOf(el) {
    if (reduced && reduced.matches) return 0;
    var d = getComputedStyle(el).transitionDuration.split(',')[0];
    return (parseFloat(d) || 0) * (d.indexOf('ms') > -1 ? 1 : 1000);
  }

  /* ── one-time wiring of a sheet ─────────────────────────────────── */
  function prepare(el) {
    if (el.__bs) return el.__bs;
    var st = el.__bs = { id: el.id || ('bs-' + (++uid)), scrim: null, trigger: null, timer: 0, reason: null };
    el.id = st.id;
    el.setAttribute('role', el.getAttribute('role') || 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('tabindex', '-1');
    var title = el.querySelector('.bs-title');
    if (title && !el.hasAttribute('aria-labelledby') && !el.hasAttribute('aria-label')) {
      title.id = title.id || st.id + '-title';
      el.setAttribute('aria-labelledby', title.id);
    }
    if (!el.classList.contains('is-open')) el.hidden = true;

    // scroll-aware head / foot elevation
    var body = el.querySelector(':scope > .bs-body');
    if (body) {
      st.body = body;
      body.addEventListener('scroll', function () { syncScroll(el); }, { passive: true });
    }
    // call to action — inline (in the body) or sticky (in the foot)
    var actions = body && el.querySelector(':scope > .bs-body > .bs-actions, :scope > .bs-foot > .bs-actions');
    if (actions) {
      st.actions = actions;
      st.cta = el.getAttribute('data-bs-cta');
      var wrote = actions.parentNode === body ? 'inline' : 'sticky';
      placeCta(el, st.cta === 'inline' || st.cta === 'sticky' ? st.cta : st.cta === 'auto' ? 'inline' : wrote, true);
    }
    // drag to dismiss — from the handle or header only, so body scrolling is never hijacked
    if (!attr(el, 'data-bs-drag', 'false')) {
      Array.prototype.forEach.call(el.querySelectorAll(':scope > .bs-handle, :scope > .bs-head'), function (h) { dragify(el, h); });
    }
    return st;
  }

  /* ── call to action placement ───────────────────────────────────── */
  function placeCta(el, state, silent) {
    var st = el.__bs, a = st.actions, body = st.body;
    if (!a || !body) return;
    var prev = el.getAttribute('data-bs-cta-state');
    var had = a.contains(doc.activeElement) ? doc.activeElement : null;   // keep focus across the move
    if (state === 'sticky') {
      var foot = a.parentNode.classList && a.parentNode.classList.contains('bs-foot') ? a.parentNode : st.foot;
      if (!foot) {
        foot = doc.createElement('div'); foot.className = 'bs-foot';
        st.ownFoot = true;
      }
      st.foot = foot;
      if (foot.parentNode !== el) body.parentNode.insertBefore(foot, body.nextSibling);
      if (a.parentNode !== foot) foot.appendChild(a);
      foot.hidden = false;
    } else {
      if (a.parentNode !== body) body.appendChild(a);
      if (st.foot && !st.foot.querySelector('*')) st.foot.hidden = true;
    }
    if (had && doc.activeElement !== had) { try { had.focus({ preventScroll: true }); } catch (e) { had.focus(); } }
    el.setAttribute('data-bs-cta-state', state);
    if (!silent && prev && prev !== state) emit(el, 'shine:sheet-cta', { state: state });
  }
  // auto: inline while everything fits, sticky once the body overflows. Inline is a few px taller than
  // the sticky footer (24 + gutter vs 16 + 16), so returning to inline needs that much spare room → no flip-flop.
  function maxSheetHeight(el) {
    var vh = global.visualViewport ? Math.min(global.visualViewport.height, global.innerHeight) : global.innerHeight;
    var m = parseFloat(getComputedStyle(el).maxHeight);
    return isNaN(m) ? vh * 0.9 : Math.min(m, isNested(el) ? m : vh * 0.9);
  }
  function syncCta(el) {
    var st = el.__bs;
    if (!st || !st.actions || st.cta !== 'auto' || el.hidden) return;
    var b = st.body, state = el.getAttribute('data-bs-cta-state');
    if (state !== 'sticky') {
      if (b.scrollHeight > b.clientHeight + 1) placeCta(el, 'sticky');
    } else {
      var f = st.foot, cs = getComputedStyle(f), g = parseFloat(getComputedStyle(el).getPropertyValue('--bs-gutter')) || 24;
      var safe = Math.max(0, parseFloat(cs.paddingBottom) - parseFloat(cs.paddingTop));          // home-indicator inset
      var inlineH = st.actions.offsetHeight + 2 * g + safe;                                    // 24 above + gutter/safe below
      var room = b.clientHeight + f.offsetHeight + Math.max(0, maxSheetHeight(el) - el.offsetHeight);
      if (b.scrollHeight + inlineH <= room - 1) placeCta(el, 'inline');
    }
  }
  function watchCta(el, on) {
    var st = el.__bs;
    if (!st || !st.actions || st.cta !== 'auto') return;
    if (on) {
      if (st.watch) return;
      var raf = 0, run = function () { cancelAnimationFrame(raf); raf = requestAnimationFrame(function () { syncCta(el); syncScroll(el); }); };
      st.watch = { run: run, ro: global.ResizeObserver ? new ResizeObserver(run) : null, mo: global.MutationObserver ? new MutationObserver(run) : null };
      if (st.watch.ro) { st.watch.ro.observe(st.body); Array.prototype.forEach.call(st.body.children, function (c) { st.watch.ro.observe(c); }); }
      if (st.watch.mo) st.watch.mo.observe(st.body, { childList: true, subtree: true, characterData: true });
      global.addEventListener('resize', run);
      if (global.visualViewport) global.visualViewport.addEventListener('resize', run);
      syncCta(el);
    } else if (st.watch) {
      if (st.watch.ro) st.watch.ro.disconnect();
      if (st.watch.mo) st.watch.mo.disconnect();
      global.removeEventListener('resize', st.watch.run);
      if (global.visualViewport) global.visualViewport.removeEventListener('resize', st.watch.run);
      st.watch = null;
    }
  }

  function syncScroll(el) {
    var b = el.__bs && el.__bs.body; if (!b) return;
    el.classList.toggle('is-scrolled', b.scrollTop > 2);
    el.classList.toggle('has-more', b.scrollHeight - b.clientHeight - b.scrollTop > 2);
  }

  /* ── scrim ──────────────────────────────────────────────────────── */
  function scrimFor(el) {
    var st = el.__bs;
    if (attr(el, 'data-bs-scrim', 'none')) return null;
    if (!st.scrim) {
      var s = doc.createElement('div');
      s.className = 'bs-scrim' + (isNested(el) ? ' bs-scrim--nested' : '') + (attr(el, 'data-bs-scrim', 'strong') ? ' bs-scrim--strong' : '');
      s.setAttribute('aria-hidden', 'true');
      s.addEventListener('click', function () { if (dismissible(el)) close(el, 'backdrop'); });
      el.parentNode.insertBefore(s, el);           // sibling → nested scrims stay inside the parent sheet
      st.scrim = s;
    }
    return st.scrim;
  }

  /* ── scroll lock (ref-counted via the stack) ────────────────────── */
  function lock(on) { doc.documentElement.classList.toggle('bs-lock', on); }

  /* ── focus ──────────────────────────────────────────────────────── */
  function focusables(el) {
    return Array.prototype.filter.call(el.querySelectorAll(FOCUSABLE), function (n) {
      return n.offsetParent !== null && n.closest('.bs') === el;      // skip nested sheets' own controls
    });
  }
  doc.addEventListener('keydown', function (e) {
    var top = stack[stack.length - 1]; if (!top) return;
    if (e.key === 'Escape') {
      if (e.defaultPrevented) return;              // an inner control (e.g. a listbox) handled it
      if (dismissible(top)) { e.preventDefault(); close(top, 'escape'); }
      return;
    }
    if (e.key !== 'Tab') return;
    var f = focusables(top);
    if (!f.length) { e.preventDefault(); top.focus(); return; }
    var first = f[0], last = f[f.length - 1], a = doc.activeElement;
    if (e.shiftKey && (a === first || a === top)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && a === last) { e.preventDefault(); first.focus(); }
    else if (!top.contains(a)) { e.preventDefault(); first.focus(); }
  });

  /* ── on-screen keyboard (v1.2) ────────────────────────────────────
     iOS Safari never resizes the page for the keyboard — it slides over fixed
     content, so a bottom sheet ends up underneath it. While any sheet is open we
     follow visualViewport; the CSS pads the sheet's content up by the keyboard
     height (the surface itself stays on the bottom edge, behind the keyboard):
       --bs-kb   = layout-viewport bottom − visible-area bottom   (keyboard height)
       --bs-vvh  = visible height (caps the sheet so its head never hides)
     Android WebView/Chrome resize the page instead → --bs-kb stays 0 there. */
  var kb = { on: false, raf: 0, px: 0 };
  function kbSet(px, h) {
    var r = doc.documentElement;
    if (px > 0) { r.style.setProperty('--bs-kb', px + 'px'); r.style.setProperty('--bs-vvh', Math.round(h) + 'px'); r.classList.add('bs-kb'); }
    else { r.style.removeProperty('--bs-kb'); r.style.removeProperty('--bs-vvh'); r.classList.remove('bs-kb'); }
    if (px !== kb.px) {
      kb.px = px;
      stack.forEach(function (el) { if (el.__bs && el.__bs.actions) { syncCta(el); syncScroll(el); } });
      var a = doc.activeElement;                         // keep the focused field in view inside the sheet
      if (px > 0 && a && a.closest && a.closest('.bs') && a.scrollIntoView) setTimeout(function () { try { a.scrollIntoView({ block: 'nearest' }); } catch (e) {} }, 260);
    }
  }
  function kbMeasure() {
    kb.raf = 0;
    var vv = global.visualViewport; if (!vv || !stack.length) return kbSet(0);
    var px = Math.round(global.innerHeight - vv.height - vv.offsetTop);
    kbSet(px > 80 ? px : 0, vv.height);                  // < 80 px = browser chrome moving, not a keyboard
  }
  function kbSchedule() { if (!kb.raf) kb.raf = requestAnimationFrame(kbMeasure); }
  function keyboard(on) {
    var vv = global.visualViewport; if (!vv) return;
    if (on && !kb.on) { vv.addEventListener('resize', kbSchedule); vv.addEventListener('scroll', kbSchedule); }
    if (!on && kb.on) { vv.removeEventListener('resize', kbSchedule); vv.removeEventListener('scroll', kbSchedule); kbSet(0); }
    kb.on = on; if (on) kbSchedule();
  }

  /* ── status-bar tint (v1.2) ─────────────────────────────────────────
     iOS 26 Safari colours the status bar from body's background-color (or a
     fixed element's background-color at the top edge). Scrims paint with an image
     layer, so while one is up we give html/body the page colour dimmed by it —
     the status bar dims together with the page, and is restored on close. */
  var tintSaved = null;
  function rgba(s) { var m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?/.exec(s || ''); return m ? [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]] : null; }
  function tint() {
    var r = doc.documentElement, b = doc.body; if (!b) return;
    var scrims = stack.filter(function (el) { return el.__bs.scrim && !isNested(el); }).map(function (el) { return el.__bs.scrim; });
    if (!scrims.length) {
      if (tintSaved) { r.style.backgroundColor = tintSaved[0]; b.style.backgroundColor = tintSaved[1]; tintSaved = null; }
      return;
    }
    if (!tintSaved) {
      var base = rgba(getComputedStyle(b).backgroundColor);
      if (!base || base[3] < 0.5) base = rgba(getComputedStyle(r).backgroundColor);
      if (!base || base[3] < 0.5) base = [255, 255, 255, 1];
      tintSaved = [r.style.backgroundColor, b.style.backgroundColor, base];
    }
    var col = tintSaved[2].slice(0, 3);
    scrims.forEach(function (sc) {                       // stacked scrims compound
      var c = rgba(getComputedStyle(sc).getPropertyValue('--bs-scrim-c')) || [13, 17, 23, 0.3];
      col = [0, 1, 2].map(function (k) { return c[k] * c[3] + col[k] * (1 - c[3]); });
    });
    var css = 'rgb(' + col.map(Math.round).join(',') + ')';
    r.style.backgroundColor = css; b.style.backgroundColor = css;
  }
  function scrimMs(sc) { var d = getComputedStyle(sc).transitionDuration; return (parseFloat(d) || 0) * (/ms/.test(d) ? 1 : 1000); }

  /* ── open / close ───────────────────────────────────────────────── */
  function layer() {
    stack.forEach(function (el, i) {
      var base = 'calc(var(--bs-z) + ' + (i * 2) + ')';
      if (!isNested(el)) {
        el.style.zIndex = 'calc(var(--bs-z) + ' + (i * 2 + 1) + ')';
        if (el.__bs.scrim) el.__bs.scrim.style.zIndex = base;
      } else {
        el.style.zIndex = 12; if (el.__bs.scrim) el.__bs.scrim.style.zIndex = 11;
      }
    });
  }

  function open(target, opts) {
    var el = $(target); if (!el) return false;
    opts = opts || {};
    var st = prepare(el);
    if (stack.indexOf(el) > -1) return true;
    if (!emit(el, 'shine:sheet-open', { trigger: opts.trigger || null }, true)) return false;
    clearTimeout(st.timer);

    st.trigger = opts.trigger || (doc.activeElement !== doc.body ? doc.activeElement : null);
    if (st.trigger && st.trigger.setAttribute) { st.trigger.setAttribute('aria-expanded', 'true'); st.trigger.setAttribute('aria-controls', st.id); }

    stack.push(el);
    if (stack.length === 1) lock(true);
    var scrim = scrimFor(el);
    if (scrim) { clearTimeout(scrim.__t); scrim.hidden = false; }
    el.hidden = false; el.style.transform = '';
    layer();
    watchCta(el, true);
    void el.offsetHeight;                          // commit the closed position so the slide runs
    el.classList.add('is-open');
    if (scrim) scrim.classList.add('is-open');
    syncScroll(el);
    tint(); keyboard(true);

    var af = el.querySelector('[data-bs-autofocus]');
    try { (af || el).focus({ preventScroll: true }); } catch (e) { (af || el).focus(); }
    st.timer = setTimeout(function () { syncScroll(el); emit(el, 'shine:sheet-opened', {}); }, durationOf(el));
    return true;
  }

  function close(target, reason) {
    var el = $(target); if (!el || !el.__bs) return false;
    var st = el.__bs, i = stack.indexOf(el);
    if (i < 0) return false;
    reason = reason || 'api';
    if (!emit(el, 'shine:sheet-close', { reason: reason }, true)) { el.style.transform = ''; return false; }
    // closing a parent closes anything stacked above it first
    for (var k = stack.length - 1; k > i; k--) close(stack[k], 'parent');

    stack.splice(stack.indexOf(el), 1);
    el.classList.remove('is-open', 'is-dragging');
    el.style.transform = '';
    if (st.scrim) {
      var sc = st.scrim; sc.classList.remove('is-open');
      clearTimeout(sc.__t); sc.__t = setTimeout(function () { if (!sc.classList.contains('is-open')) sc.hidden = true; }, scrimMs(sc) + 20);
    }
    if (st.trigger && st.trigger.setAttribute) st.trigger.setAttribute('aria-expanded', 'false');
    if (!stack.length) { lock(false); keyboard(false); }
    layer(); tint();

    var trig = st.trigger; st.trigger = null;
    if (trig && doc.contains(trig) && typeof trig.focus === 'function' && (!stack.length || stack[stack.length - 1].contains(trig))) {
      try { trig.focus({ preventScroll: true }); } catch (e) { trig.focus(); }
    } else if (stack.length) {
      try { stack[stack.length - 1].focus({ preventScroll: true }); } catch (e) {}
    }
    clearTimeout(st.timer);
    st.timer = setTimeout(function () {
      if (stack.indexOf(el) > -1) return;            // reopened meanwhile
      el.hidden = true;
      watchCta(el, false);
      emit(el, 'shine:sheet-closed', { reason: reason });
    }, durationOf(el) + 20);
    return true;
  }

  function toggle(target, opts) { var el = $(target); return isOpen(el) ? close(el, 'api') : open(el, opts); }
  function isOpen(target) { var el = $(target); return !!el && stack.indexOf(el) > -1; }
  function top() { return stack[stack.length - 1] || null; }
  function closeAll(reason) { for (var k = stack.length - 1; k >= 0; k--) close(stack[k], reason || 'api'); }

  /* ── drag to dismiss ────────────────────────────────────────────── */
  function dragify(el, handle) {
    var y0 = 0, t0 = 0, dy = 0, active = false, pid = null;
    handle.addEventListener('pointerdown', function (e) {
      if (!isOpen(el) || !dismissible(el) || e.button > 0) return;
      if (e.target.closest('button, a, input, select, textarea, [role="button"]')) return;
      active = true; pid = e.pointerId; y0 = e.clientY; t0 = e.timeStamp; dy = 0;
      try { handle.setPointerCapture(pid); } catch (x) {}
      el.classList.add('is-dragging');
    });
    handle.addEventListener('pointermove', function (e) {
      if (!active || e.pointerId !== pid) return;
      dy = Math.max(0, e.clientY - y0);
      el.style.transform = 'translate3d(0,' + dy + 'px,0)';
    });
    function end(e) {
      if (!active || (e && e.pointerId !== pid)) return;
      active = false; el.classList.remove('is-dragging');
      var v = dy / Math.max(1, (e ? e.timeStamp : t0) - t0);   // px / ms
      if (dy > el.offsetHeight * 0.3 || (dy > 24 && v > 0.6)) close(el, 'drag');
      else el.style.transform = '';
    }
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  }

  /* ── declarative triggers ───────────────────────────────────────── */
  doc.addEventListener('click', function (e) {
    var o = e.target.closest && e.target.closest('[data-bs-open]');
    if (o) { e.preventDefault(); open(o.getAttribute('data-bs-open'), { trigger: o }); return; }
    var c = e.target.closest && e.target.closest('[data-bs-close]');
    if (c) { var s = c.closest('.bs'); if (s) { e.preventDefault(); close(s, 'close-button'); } }
  });

  function init(root) {
    Array.prototype.forEach.call((root || doc).querySelectorAll('.bs'), prepare);
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', function () { init(); }); else init();

  // re-measure an auto sheet after the page swaps its content (optional — a MutationObserver already does this)
  function refresh(target) { var el = $(target); if (el && el.__bs) { syncCta(el); syncScroll(el); } }

  global.ShineSheet = { open: open, close: close, toggle: toggle, isOpen: isOpen, top: top, closeAll: closeAll, init: init, refresh: refresh, version: '1.2.1' };
})(window);
