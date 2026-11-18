/* ═══════════════════════════════════════════════════════════════════════
   SHINE · INLINE DROPDOWN  (app component · App-login · app-components/inline-dropdown/)      v1.6.0
   Pair with inline-dropdown.css. Zero dependencies, no build step. Global: ShineDropdown.

   The list under a field. One pick at a time, two ways to use it (mode):
     select   pick only — the field doesn’t take typing (social platform). Type-ahead jumps.
     search   type to narrow, then pick one (job role, current city). Optional free row: keep what you typed.
   A field that collects several values (key skills, preferred cities, languages) still picks one at a time: search
   with fillInput: 'clear' — the page adds the chip — and dd.added(values) marks what’s in already (“Added”).

   ① From a script (how the combo box and pages use it)
     var dd = ShineDropdown.create({
       input:   el,                // the element that has focus: an <input> (search) or the field’s box / a button (select)
       anchor:  el,                // what the panel sits under and takes its width from (default: input.closest('.field-control') || input)
       mode:    'search',          // 'select' | 'search'
       options: [ 'Pune', { value: 'ncr', label: 'Delhi NCR', hint: 'Delhi · Gurugram · Noida', icon: '<svg…>', group: 'Popular', added: false, disabled: false } ],
                                  // added: true → can’t be picked, an “Added” badge on the right · disabled + reason → can’t be picked, the reason as the hint
       source:  function (q) { return fetch(…).then(r => r.json()); },   // optional server search (after minChars, 200 ms debounce)
       minChars: 2,
       free:    'Use “{q}”',       // search: a last row that keeps the typed words ({q}); omit for none
       heading: 'Popular cities',  // a heading over the list before anything is typed
       value:   'Pune',            // what is chosen now (value or label)
       empty:   'No matches for “{q}”',
       size:    'sm',              // the list’s own size, by device — never the field’s: 'sm' phone & mobile view (default: 38 rows, 12 text, 14 icons, 3½ rows) · 'md' tablet & computer (44, 4½ rows)
       addedText: 'Added',         // the badge on rows that are already added
       placement: 'auto',          // 'auto' (under; above when there is no room) · 'below' · 'above'
       openOnFocus: true,          // search (select opens on tap / ↓ / Enter / Space)
       fillInput:   true,          // the picked label goes into the field · 'clear': the input empties (a chips field adds the pick)
       onPick:  function (opt, state) {}
     });
     dd.open() · dd.close() · dd.toggle() · dd.isOpen() · dd.options(list) · dd.source(fn) · dd.value(v?) ·
     dd.added(values) · dd.enable(on) · dd.selected() · dd.refresh() · dd.destroy() · dd.el (the panel) · dd.list

   ② Declarative (pages without a script of their own)
     <div class="field field--md" data-dropdown="select" data-dropdown-heading="…" data-dropdown-free="Use “{q}”">
       <label class="field-label" for="x">Social platform</label>
       <div class="field-control"><input class="field-input" id="x" readonly placeholder="Select platform"></div>
       <ul data-dropdown-options hidden><li data-value="in" data-hint="…" data-group="…" data-added>LinkedIn</li> …</ul>   (data-dropdown-size="sm|md|lg" on the field)
     </div>
     ShineDropdown.init(root) runs on load; ShineDropdown.get(el) → the controller.

   Events (on the input, bubbling)
     shine:dropdown-open · shine:dropdown-close
     shine:dropdown-pick  detail { value, label, option, free }

   Behaviour (WAI-ARIA combobox + listbox): role="combobox", aria-expanded, aria-controls, aria-activedescendant,
   listbox / option, a polite count of results · ↑ ↓ move (wrap), Home / End and
   Page Up / Down in select, Enter picks, Escape closes (and doesn’t close the sheet behind), Tab leaves, letters
   jump in select · tap picks, a tap outside or leaving the field closes · under the field, or above it when there
   is no room (the keyboard — measured on the visible area) · inside a scrolling sheet the field scrolls up first so
   the list fits under it · Small shows 3½ rows, Medium 4½ — the half row says there is more · the panel never takes focus (the caret stays in the field) · reduced motion respected.
   ═══════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  if (global.ShineDropdown) return;
  var doc = global.document, uid = 0, all = [];
  var IC = {"ic_check-outline": "<svg aria-hidden=\"true\" focusable=\"false\" data-icon=\"ic_check-outline\" viewBox=\"0 0 20 20\" fill=\"none\"><path d=\"M7.071 15.244L7.364 15.435L7.708 15.5L8.05 15.429L8.34 15.233L17.24 6.23295L17.433 5.93995L17.5 5.59495L17.43 5.25095L17.233 4.95995L16.94 4.76695L16.595 4.69995L16.251 4.76995L15.96 4.96695L7.689 13.331L3.891 9.64595L3.565 9.51495L3.214 9.51895L2.891 9.65795L2.756 9.77095L2.565 10.065L2.5 10.411L2.573 10.754L2.658 10.909L7.071 15.244Z\" fill-rule=\"evenodd\" clip-rule=\"evenodd\" fill=\"currentColor\"/></svg>", "ic_plus-outline": "<svg aria-hidden=\"true\" focusable=\"false\" data-icon=\"ic_plus-outline\" viewBox=\"0 0 20 20\" fill=\"none\"><path d=\"M17 10C17 10.2228 16.9115 10.4364 16.754 10.594C16.5964 10.7515 16.3828 10.84 16.16 10.84H10.84V16.16C10.84 16.3828 10.7515 16.5964 10.594 16.754C10.4364 16.9115 10.2228 17 10 17C9.77722 17 9.56356 16.9115 9.40603 16.754C9.2485 16.5964 9.16 16.3828 9.16 16.16V10.84H3.84C3.61722 10.84 3.40356 10.7515 3.24603 10.594C3.0885 10.4364 3 10.2228 3 10C3 9.77722 3.0885 9.56356 3.24603 9.40603C3.40356 9.2485 3.61722 9.16 3.84 9.16H9.16V3.84C9.16 3.61722 9.2485 3.40356 9.40603 3.24603C9.56356 3.0885 9.77722 3 10 3C10.2228 3 10.4364 3.0885 10.594 3.24603C10.7515 3.40356 10.84 3.61722 10.84 3.84V9.16H16.16C16.3828 9.16 16.5964 9.2485 16.754 9.40603C16.9115 9.56356 17 9.77722 17 10Z\" fill=\"currentColor\"/></svg>"};                                   // atoms/icons: ic_check-outline · ic_plus-outline (verbatim)
  var reduced = global.matchMedia ? global.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  function low(s) { return String(s == null ? '' : s).toLowerCase(); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function emit(el, name, detail) {
    var ev; try { ev = new CustomEvent(name, { bubbles: true, detail: detail || {} }); }
    catch (e) { ev = doc.createEvent('CustomEvent'); ev.initCustomEvent(name, true, false, detail || {}); }
    el.dispatchEvent(ev);
  }
  function toOpt(o) {
    if (o == null) return null;
    if (typeof o !== 'object') return { value: String(o), label: String(o), hint: '' };
    var l = o.label != null ? o.label : o.value;
    return { value: String(o.value != null ? o.value : l), label: String(l), hint: o.hint || '', icon: o.icon || '', group: o.group || '',
             added: !!o.added, disabled: !!o.disabled || !!o.added, __dis: !!o.disabled, reason: o.reason || '' };
  }
  // starts with → a word starts with → anywhere → in the hint
  function score(o, q) {
    var l = low(o.label), i = l.indexOf(q);
    if (i === 0) return 0;
    if (i > 0) return /[\s\-(\/,.&]/.test(l.charAt(i - 1)) ? 1 : 2;
    return o.hint && low(o.hint).indexOf(q) > -1 ? 3 : -1;
  }
  function mark(label, q) {
    var i = q ? low(label).indexOf(q) : -1; if (i < 0) return esc(label);
    return esc(label.slice(0, i)) + '<mark>' + esc(label.slice(i, i + q.length)) + '</mark>' + esc(label.slice(i + q.length));
  }
  function scroller(el) {                               // the nearest scrolling ancestor (a sheet’s body, a page area)
    for (var n = el.parentElement; n && n !== doc.body; n = n.parentElement) {
      var o = getComputedStyle(n).overflowY;
      if (o === 'auto' || o === 'scroll') return n;
    }
    return null;
  }
  function clipBox(el) {                                // the part of the screen the panel can show in: the visible area ∩ every clipping ancestor
    var vv = global.visualViewport, t = vv ? vv.offsetTop : 0, b = t + (vv ? vv.height : global.innerHeight);
    for (var n = el.parentElement; n && n !== doc.body && n !== doc.documentElement; n = n.parentElement) {
      if (getComputedStyle(n).overflowY !== 'visible') { var r = n.getBoundingClientRect(); t = Math.max(t, r.top); b = Math.min(b, r.bottom); }
    }
    return { top: t, bottom: b };
  }

  function create(cfg) {
    cfg = cfg || {};
    var input = cfg.input; if (!input) throw new Error('ShineDropdown: input is required');
    if (input.__dd) return input.__dd;
    var mode = cfg.mode === 'select' ? 'select' : 'search';   // one pick at a time (v1.3.0: no multi-pick mode)
    var typing = mode !== 'select' && input.tagName === 'INPUT' && !input.readOnly;
    var anchor = cfg.anchor || (input.closest && input.closest('.field-control')) || input;
    var host = anchor.parentNode;
    var n = ++uid, opts = [], remote = cfg.source || null, minQ = cfg.minChars || 2, token = 0, tm = 0, state = null;
    var off = false, dirty = false, lastQ = null, sel = [], open = false, active = -1, shown = [], persist = !!cfg.persist, buf = '', bufT = 0, rvT = 0, spacer = 0;
    var openOnFocus = cfg.openOnFocus != null ? !!cfg.openOnFocus : typing;
    var fillInput = cfg.fillInput === 'clear' ? 'clear' : cfg.fillInput !== false;

    // the panel — after the anchor, inside its parent (which must position it: set relative if static)
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    var panel = doc.createElement('div'); panel.className = 'dropdown'; panel.hidden = true;
    var size = cfg.size === 'md' || cfg.size === 'lg' ? 'md' : 'sm';   // two sizes (v1.5.0: no Large — 'lg' falls back to Medium)   // the list’s own size (by device), independent of the field’s — Small by default (v1.4.0)
    panel.classList.add('dropdown--' + size);
    var list = doc.createElement('ul'); list.className = 'dropdown-list'; list.id = 'dropdown-' + n; list.setAttribute('role', 'listbox');
    var label = cfg.label || (function () { var l = input.id && doc.querySelector('label[for="' + input.id + '"]'); return l ? l.textContent.trim() : (input.getAttribute('aria-label') || 'Options'); })();
    list.setAttribute('aria-label', label);
    panel.appendChild(list);
    var live = doc.createElement('span'); live.className = 'dropdown-sr'; live.setAttribute('aria-live', 'polite'); panel.appendChild(live);
    host.insertBefore(panel, anchor.nextSibling);

    // the trigger: ARIA combobox (an editable one, or the select-only pattern)
    input.setAttribute('role', 'combobox'); input.setAttribute('aria-expanded', 'false'); input.setAttribute('aria-controls', list.id);
    input.setAttribute('aria-haspopup', 'listbox');
    if (typing) { input.setAttribute('aria-autocomplete', 'list'); input.setAttribute('autocomplete', 'off'); input.setAttribute('spellcheck', 'false'); }
    if (!typing && input.tabIndex < 0 && input.tagName !== 'INPUT' && input.tagName !== 'BUTTON') input.tabIndex = 0;

    function setOptions(lst) { opts = (lst || []).map(toOpt).filter(Boolean); if (open) render(); }
    function isSel(o) { return sel.indexOf(o.value) > -1; }
    function find(v) { var s = low(String(v)); for (var i = 0; i < opts.length; i++) if (opts[i].value === String(v) || low(opts[i].label) === s) return opts[i]; return null; }
    function setValue(v) {
      var vs = v == null || v === '' ? [] : [Array.isArray(v) ? v[0] : v];
      sel = vs.map(function (x) { var o = find(x); return o ? o.value : String(x); });
      if (open) render();
    }
    function write(t) {                                 // the chosen label into the field (an <input>, or [data-dropdown-label] inside a button)
      if (input.tagName === 'INPUT') input.value = t;
      else { var l = input.querySelector('[data-dropdown-label]'); if (l) l.textContent = t; }
    }
    function query() { return typing && dirty ? input.value : ''; }   // until they type, the whole list (the chosen row ticked)

    /* ── the list ─────────────────────────────────────────────────── */
    function filtered(q) {
      if (!q) return opts.slice(0, 200);
      return opts.map(function (o, i) { return { o: o, i: i, s: score(o, q) }; }).filter(function (x) { return x.s > -1; })
        .sort(function (a, b) { return a.s - b.s || a.i - b.i; }).slice(0, 100).map(function (x) { return x.o; });
    }
    function render(lst, st) {
      var raw = query(), q = low(raw.trim()), h = '', k = 0, grp = null;
      var keep = q === lastQ && active > -1 && shown[active] ? shown[active].value : null; lastQ = q;   // same search again (refresh): the grey row stays
      if (lst === undefined) lst = remote && q ? (state && state.q === q ? state.list : []) : filtered(q);
      st = st || (remote && q && q.length < minQ ? 'short' : null);
      shown = [];
      if (st === 'loading') h += '<li class="dropdown-note" role="presentation"><span class="dropdown-spin" aria-hidden="true"></span>Searching…</li>';
      else if (st === 'short') h += '<li class="dropdown-note" role="presentation">Type ' + minQ + ' letters to search</li>';
      else if (st === 'error') h += '<li class="dropdown-note dropdown-note--error" role="presentation">Couldn’t load the list<button class="dropdown-retry" type="button" tabindex="-1" data-dd-retry>Try again</button></li>';
      if (!q && cfg.heading && lst.length) h += '<li class="dropdown-head" role="presentation">' + esc(cfg.heading) + '</li>';
      lst.forEach(function (o) {
        if (!q && o.group && o.group !== grp) { if (grp !== null) h += '<li class="dropdown-sep" role="presentation"></li>'; h += '<li class="dropdown-head" role="presentation">' + esc(o.group) + '</li>'; grp = o.group; }
        var on = isSel(o), dis = o.disabled, hint = o.disabled && !o.added && o.reason ? o.reason : o.hint;
        h += '<li class="dropdown-option" role="option" id="' + list.id + '-' + k + '" data-k="' + k + '" aria-selected="' + on + '"' + (dis ? ' aria-disabled="true"' : '') + '>' +
             (o.icon ? '<span class="dropdown-lead" aria-hidden="true">' + o.icon + '</span>' : '') +
             '<span class="dropdown-text"><span>' + mark(o.label, q) + '</span>' + (hint ? '<span class="dropdown-hint">' + esc(hint) + '</span>' : '') + '</span>' +
             (o.added ? '<span class="badge badge--sm badge--neutral dropdown-badge">' + esc(cfg.addedText || 'Added') + '</span>' : '<span class="dropdown-check" aria-hidden="true">' + IC['ic_check-outline'] + '</span>') + '</li>';
        shown.push(o); k++;
      });
      var t = raw.trim();
      if (cfg.free && typing && t && !st && !lst.some(function (o) { return low(o.label) === low(t); })) {
        h += '<li class="dropdown-option dropdown-option--free" role="option" id="' + list.id + '-' + k + '" data-k="' + k + '" aria-selected="false">' +
             '<span class="dropdown-lead" aria-hidden="true">' + IC['ic_plus-outline'] + '</span><span class="dropdown-text"><span>' + esc(cfg.free.replace(/\{q\}/g, t)) + '</span></span></li>';
        shown.push({ value: t, label: t, hint: '', free: true }); k++;
      }
      if (!lst.length && !st && q && !(cfg.free && typing)) h += '<li class="dropdown-note" role="presentation">' + esc((cfg.empty || 'No matches for “{q}”').replace(/\{q\}/g, t)) + '</li>';
      list.innerHTML = h;
      panel.hidden = !h;
      live.textContent = st === 'loading' ? 'Searching' : shown.length ? shown.length + (shown.length === 1 ? ' result' : ' results') : (q ? 'No matches' : '');
      var s = -1;
      if (keep != null) shown.forEach(function (o, i) { if (s < 0 && o.value === keep && pickable(i)) s = i; });
      if (s < 0 && !q) shown.forEach(function (o, i) { if (s < 0 && isSel(o)) s = i; });
      setActive(s > -1 ? s : q ? firstPickable(0, 1) : -1, true);
      place(); more();
    }
    function update() {
      if (!remote) return render();
      var q = low(query().trim());
      clearTimeout(tm); var my = ++token;
      if (!q) return render(filtered(''));
      if (q.length < minQ) return render([], 'short');
      if (state && state.q === q) return render(state.list);
      render([], 'loading');
      tm = setTimeout(function () {
        Promise.resolve().then(function () { return remote(query().trim()); }).then(function (res) {
          if (my !== token || !open) return; state = { q: q, list: (res || []).map(toOpt).filter(Boolean) }; render(state.list);
        }, function () { if (my === token && open) render([], 'error'); });
      }, 200);
    }
    function pickable(i) { var li = list.querySelector('[data-k="' + i + '"]'); return !!li && li.getAttribute('aria-disabled') !== 'true'; }
    function firstPickable(from, dir) {
      if (!shown.length) return -1;
      for (var c = 0, i = from; c < shown.length; c++, i = (i + dir + shown.length) % shown.length) if (pickable(i)) return i;
      return -1;
    }
    function setActive(k, quiet) {
      [].forEach.call(list.querySelectorAll('.dropdown-option.is-active'), function (x) { x.classList.remove('is-active'); });
      active = k < 0 || k >= shown.length ? -1 : k;
      var li = active > -1 ? list.querySelector('[data-k="' + active + '"]') : null;
      if (li) { li.classList.add('is-active'); input.setAttribute('aria-activedescendant', li.id); keepInView(li, quiet); }
      else input.removeAttribute('aria-activedescendant');
    }
    function keepInView(li, center) {
      var r = li.getBoundingClientRect(), b = panel.getBoundingClientRect();
      if (center && (r.top < b.top || r.bottom > b.bottom)) panel.scrollTop += r.top - b.top - (b.height - r.height) / 2;
      else if (r.top < b.top) panel.scrollTop -= b.top - r.top + 4;
      else if (r.bottom > b.bottom) panel.scrollTop += r.bottom - b.bottom + 4;
    }
    function capH() {                                   // Small: 3½ options show (ends halfway down the 4th) · Medium: 4½ (the 5th) — the half row says there is more
      var o = list.querySelectorAll('.dropdown-option'), n = size === 'sm' ? 3 : 4;
      if (o.length > n + 1) return Math.round(o[n].offsetTop + o[n].offsetHeight / 2);
      return panel.scrollHeight + 2;
    }
    function more() { panel.classList.toggle('is-more', panel.scrollHeight - panel.scrollTop - panel.clientHeight > 2); }

    /* ── where it sits: under the anchor, or above it when there is no room (the keyboard) ── */
    function place() {
      if (!open) return;
      var a = anchor.getBoundingClientRect(), box = clipBox(host);
      var gap = parseFloat(getComputedStyle(panel).getPropertyValue('--dd-gap')) || 4, mx = capH();
      panel.style.setProperty('--dd-max', mx + 'px');
      var below = box.bottom - a.bottom - gap - 8, above = a.top - box.top - gap - 8, want = mx;
      var anchored = !!(host.closest && host.closest('.bs-body--anchored'));   // v1.5.1: the sheet is gliding this field up to the top — the list goes under it
      var up = cfg.placement === 'above' ? true : cfg.placement === 'below' || anchored ? false : below < Math.min(want, 180) && above > below, room = persist ? mx : Math.max(120, Math.min(mx, up ? above : below));   // persist (held open in a guideline): full height
      panel.style.setProperty('--dd-room', room + 'px');
      panel.style.left = anchor.offsetLeft + 'px'; panel.style.width = anchor.offsetWidth + 'px';
      if (up) { panel.style.top = 'auto'; panel.style.bottom = (host.clientHeight - anchor.offsetTop + gap) + 'px'; }
      else { panel.style.bottom = 'auto'; panel.style.top = (anchor.offsetTop + anchor.offsetHeight + gap) + 'px'; }
      panel.classList.toggle('dropdown--up', up);
    }
    // inside a scrolling area (a full-screen form): scroll the field up until the list fits above the keyboard
    function reveal() {
      if (!open || persist) return;
      var sc = scroller(host); if (!sc || sc.classList.contains('bs-body--anchored')) return;   // v1.5.1: the bottom sheet's focus anchor already makes the room
      var vv = global.visualViewport, vb = vv ? vv.offsetTop + vv.height : global.innerHeight;
      var b = sc.getBoundingClientRect(), a = anchor.getBoundingClientRect(), top = host.getBoundingClientRect().top;
      var gap = parseFloat(getComputedStyle(panel).getPropertyValue('--dd-gap')) || 4, mx = capH();
      var want = mx + gap + 12, room = Math.min(b.bottom, vb) - a.bottom;
      if (room >= want) return;
      var d = Math.min(want - room, top - b.top - 8); if (d <= 1) return;
      var spare = sc.scrollHeight - sc.clientHeight - sc.scrollTop;   // the last fields of a form: make the room to scroll into
      if (spare < d) { spacer += Math.ceil(d - spare + 4); host.style.marginBottom = spacer + 'px'; }
      sc.scrollTop += d; place();
    }
    function revealSoon() { clearTimeout(rvT); rvT = setTimeout(reveal, 60); }

    /* ── open / close / pick ──────────────────────────────────────── */
    function openIt() {
      if (off || open || input.disabled || input.getAttribute('aria-disabled') === 'true') return;
      all.forEach(function (d) { if (d !== api && d.isOpen() && !d.__persist) d.close(); });
      open = true; dirty = !!input.value && !(sel[0] && (function (o) { return o && o.label === input.value; })(find(sel[0]) || { label: sel[0] }));
      input.setAttribute('aria-expanded', 'true');
      var f = input.closest && input.closest('.field'); if (f) f.classList.add('field--open');
      panel.hidden = false;
      if (!reduced.matches && !persist) { panel.classList.add('is-entering'); requestAnimationFrame(function () { requestAnimationFrame(function () { panel.classList.remove('is-entering'); }); }); }
      update(); revealSoon(); setTimeout(reveal, 420);     // again once the keyboard has slid up
      emit(input, 'shine:dropdown-open', {});
    }
    function closeIt() {
      if (!open || persist) return;
      open = false; clearTimeout(tm); token++; lastQ = null;
      panel.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant');
      var f = input.closest && input.closest('.field'); if (f) f.classList.remove('field--open');
      if (spacer) { spacer = 0; host.style.marginBottom = ''; }
      emit(input, 'shine:dropdown-close', {});
    }
    function pick(o) {
      if (!o) return;
      if (fillInput === 'clear') { sel = []; write(''); dirty = false; }     // a chips field: the page adds the pick, the input empties
      else { sel = [o.value]; if (fillInput) write(o.label); }
      var detail = { value: o.value, label: o.label, option: o.free ? null : o, free: !!o.free };
      if (cfg.onPick) cfg.onPick(o, detail);
      emit(input, 'shine:dropdown-pick', detail);
      closeIt();
    }

    /* ── keys ─────────────────────────────────────────────────────── */
    function step(d) {
      if (!shown.length) return;
      var k = active < 0 ? (d > 0 ? 0 : shown.length - 1) : (active + d + shown.length) % shown.length;
      setActive(firstPickable(k, d > 0 ? 1 : -1));
    }
    function jump(ch) {                                   // select: typing letters jumps to the next row that starts with them
      clearTimeout(bufT); buf += low(ch); bufT = setTimeout(function () { buf = ''; }, 600);
      var from = active + (buf.length === 1 ? 1 : 0);
      for (var c = 0; c < shown.length; c++) { var i = (from + c) % shown.length; if (low(shown[i].label).indexOf(buf) === 0 && pickable(i)) { setActive(i); return; } }
    }
    function onKey(e) {
      if (off) return;
      var k = e.key;
      if (k === 'ArrowDown' || k === 'ArrowUp') { e.preventDefault(); if (!open) { openIt(); return; } step(k === 'ArrowDown' ? 1 : -1); }
      else if (open && !typing && (k === 'Home' || k === 'End')) { e.preventDefault(); setActive(firstPickable(k === 'Home' ? 0 : shown.length - 1, k === 'Home' ? 1 : -1)); }
      else if (open && (k === 'PageDown' || k === 'PageUp')) { e.preventDefault(); var t = Math.max(0, Math.min(shown.length - 1, (active < 0 ? 0 : active) + (k === 'PageDown' ? 5 : -5))); setActive(firstPickable(t, k === 'PageDown' ? 1 : -1)); }
      else if (k === 'Enter') { if (open && active > -1) { e.preventDefault(); if (pickable(active)) pick(shown[active]); } else if (!open && !typing) { e.preventDefault(); openIt(); } }
      else if (k === ' ' && !typing) { e.preventDefault(); if (!open) openIt(); else if (active > -1 && pickable(active)) pick(shown[active]); }
      else if (k === 'Escape') { if (open && !persist) { e.preventDefault(); e.stopPropagation(); closeIt(); } }
      else if (k === 'Tab') { if (!persist) closeIt(); }
      else if (!typing && open && k.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) jump(k);
    }

    /* ── wiring ───────────────────────────────────────────────────── */
    input.addEventListener('keydown', onKey);
    function onInput() { if (off) return; dirty = true; if (!open) openIt(); else update(); revealSoon(); }
    function onFocus() { if (openOnFocus) openIt(); }
    function onBlur() { setTimeout(function () { if (!persist && doc.activeElement !== input && !panel.contains(doc.activeElement)) closeIt(); }, 0); }
    function onTap(e) { if (e.target.closest('.field-trailing') && typing) return; if (open && !typing) closeIt(); else openIt(); }
    if (typing) input.addEventListener('input', onInput);
    input.addEventListener('focus', onFocus);
    input.addEventListener('blur', onBlur);
    var tapEl = anchor === input ? input : anchor;
    tapEl.addEventListener('click', onTap);
    panel.addEventListener('mousedown', function (e) { e.preventDefault(); });   // the caret stays in the field
    panel.addEventListener('click', function (e) {
      if (e.target.closest('[data-dd-retry]')) { state = null; update(); return; }
      var li = e.target.closest('.dropdown-option'); if (!li || li.getAttribute('aria-disabled') === 'true') return;
      pick(shown[+li.getAttribute('data-k')]);
      if (typing && doc.activeElement !== input) try { input.focus({ preventScroll: true }); } catch (x) {}
    });
    panel.addEventListener('scroll', more, { passive: true });
    function outside(e) { if (open && !persist && !panel.contains(e.target) && !anchor.contains(e.target) && e.target !== input) closeIt(); }
    doc.addEventListener('pointerdown', outside, true);
    function re() { place(); }
    function onScroll(e) { if (open && e.target !== panel && !panel.contains(e.target)) place(); }
    global.addEventListener('resize', re, { passive: true });
    global.addEventListener('scroll', onScroll, { passive: true, capture: true });
    function onVv() { place(); revealSoon(); }
    if (global.visualViewport) { global.visualViewport.addEventListener('resize', onVv); global.visualViewport.addEventListener('scroll', re); }

    var api = {
      el: panel, list: list, input: input, mode: mode,
      open: openIt, close: closeIt, toggle: function () { open ? closeIt() : openIt(); }, isOpen: function () { return open; },
      options: function (lst) { if (!lst) return opts.slice(); setOptions(lst); return api; },
      source: function (fn) { remote = typeof fn === 'function' ? fn : null; state = null; if (open) update(); return api; },
      value: function (v) { if (v === undefined) return sel[0] || ''; setValue(v); return api; },
      added: function (vals) {                          // mark what a chips field holds already: those rows get “Added” and can’t be picked
        var on = (vals || []).map(function (x) { return low(String(x)); });
        opts.forEach(function (o) { var a = on.indexOf(low(o.value)) > -1 || on.indexOf(low(o.label)) > -1; if (a !== o.added) { o.added = a; o.disabled = a || o.__dis; } });
        if (open) render(); return api;
      },
      selected: function () { return sel.map(function (v) { return find(v) || { value: v, label: v, free: true }; }); },
      refresh: function () { if (open) update(); place(); return api; },
      persist: function (on) { persist = !!on; api.__persist = persist; return api; },
      enable: function (on) { off = on === false; if (off) { var p = persist; persist = false; closeIt(); persist = p; } return api; },   // off: it never opens (a combo box in its sheet mode)
      destroy: function () {
        persist = false; closeIt(); panel.remove(); input.removeEventListener('keydown', onKey);
        input.removeEventListener('input', onInput); input.removeEventListener('focus', onFocus); input.removeEventListener('blur', onBlur); tapEl.removeEventListener('click', onTap);
        doc.removeEventListener('pointerdown', outside, true); global.removeEventListener('resize', re); global.removeEventListener('scroll', onScroll, true);
        if (global.visualViewport) { global.visualViewport.removeEventListener('resize', onVv); global.visualViewport.removeEventListener('scroll', re); }
        all.splice(all.indexOf(api), 1); delete input.__dd;
      }
    };
    api.__persist = persist;
    setOptions(cfg.options || []);
    if (cfg.value != null) { setValue(cfg.value); if (fillInput === true && sel[0] && !(input.tagName === 'INPUT' && input.value)) { var o0 = find(sel[0]); write(o0 ? o0.label : sel[0]); } }
    input.__dd = api; all.push(api);
    return api;
  }

  /* ── declarative: [data-dropdown] ───────────────────────────────── */
  function fromMarkup(el) {
    if (el.__ddHost) return el.__ddHost;
    var input = el.querySelector('[data-dropdown-trigger]') || el.querySelector('input, button, [role="combobox"]'); if (!input) return null;
    var src = el.querySelector('[data-dropdown-options]');
    var options = src ? [].map.call(src.querySelectorAll('li'), function (li) {
      var t = li.textContent.replace(/\s+/g, ' ').trim();
      return { value: li.getAttribute('data-value') || t, label: t, hint: li.getAttribute('data-hint') || '', group: li.getAttribute('data-group') || '',
               disabled: li.hasAttribute('data-disabled'), added: li.hasAttribute('data-added'), reason: li.getAttribute('data-reason') || '', icon: li.querySelector('svg') ? li.querySelector('svg').outerHTML : '' };
    }) : [];
    if (src) src.hidden = true;
    var g = function (a) { return el.getAttribute('data-dropdown-' + a); };
    var d = create({ input: input, mode: el.getAttribute('data-dropdown') || 'search', options: options, free: g('free') || '', heading: g('heading') || '',
                     empty: g('empty') || '', size: g('size') || 'sm', value: g('value') || null });
    el.__ddHost = d; return d;
  }
  function init(root) { [].forEach.call((root || doc).querySelectorAll('[data-dropdown]'), fromMarkup); }
  function get(el) { if (!el) return null; if (el.__dd) return el.__dd; if (el.__ddHost) return el.__ddHost; var h = el.closest && el.closest('[data-dropdown]'); return h ? fromMarkup(h) : null; }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', function () { init(); }); else init();

  global.ShineDropdown = { create: create, init: init, get: get, version: '1.5.1' };
})(window);
