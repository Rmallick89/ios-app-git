/* ═══════════════════════════════════════════════════════════════════════
   SHINE · SORT & FILTER  (app component)                       v1.0.0
   Pair with sort-filter.css. Requires ShineSheet (bottom-sheet.js/.css).

   var sf = ShineSortFilter.create({
     mount:   document.body,                      // where the bar + sheets render
     sort:    { options: [{ value:'relevance', label:'Relevance · Best match' }, …],
                value: 'relevance', defaultValue: 'relevance' },
     filters: { groups: [{ key:'location', name:'Location', searchable:true,
                           popular:['bangalore','pune'],            // shown inline (≤4)
                           options:[{ id:'pune', label:'Pune', count:4180 }, …] }, …],
                value: { location:['pune'] } },
     count:   function (draft) { return 1234; },  // live "Show N jobs" — number or Promise
     source:  'jsrp'                              // echoed in every event
   });

   Events (bubble from the bar, so `document` can listen):
     shine:sort    detail { value, previous, label, source }
     shine:filter  detail { value, previous, count, applied, source }
                   value = { groupKey: [optionId, …] } — empty groups omitted
   The component never touches results: the screen re-queries on these
   events (same contract as the search modal's `shine:search`).

   Instance API
     sf.getState()                    → { sort, filters }
     sf.setState({ sort, filters }, { silent })   restore from URL / history
     sf.reset({ silent })             default sort + no filters
     sf.open('sort' | 'filter')  ·  sf.close()
     sf.setBarHidden(true|false, reason)   reasons stack (footer, other UI…)
     sf.destroy()

   Behaviour
     Sort applies on tap (radio group) and closes after a beat.
     Filter edits a DRAFT: chips, per-group Clear, Clear all and the
     "See all" sub-sheet all change the draft; the CTA shows the live
     count; Apply commits. Closing any other way discards the draft.
     The bar badge and sort dot reflect APPLIED state only.
   ═══════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  if (global.ShineSortFilter) return;
  var doc = global.document;
  var uid = 0;

  var I = {
    sort:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M6 12h12M10 18h4"/></svg>',
    filter: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>',
    close:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>',
    check:  '<svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>'
  };
  var LABELS = {
    bar: 'Sort and filter results', sort: 'Sort', filter: 'Filter',
    sortTitle: 'Sort by', filterTitle: 'Filter jobs',
    clear: 'Clear', clearAll: 'Clear', subClear: 'Clear',
    seeAll: 'See all {n}', done: 'Done', search: 'Search…', noMatches: 'No matches',
    selected: 'Selected · {n}', all: 'All {n} {group}',
    apply: 'Show <b>{n}</b> jobs', applyZero: 'No matching jobs', applyAria: 'Show {n} jobs',
    close: 'Close', back: 'Back to filters',
    filterApplied: 'Filter, {n} applied', sortApplied: 'Sort, {label}'
  };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]; }); }
  function tpl(s, o) { return String(s).replace(/\{(\w+)\}/g, function (_, k) { return o[k] != null ? o[k] : ''; }); }
  function fmt(n) { return n == null ? '' : Number(n).toLocaleString('en-IN'); }
  function emit(el, name, detail) {
    var ev; try { ev = new CustomEvent(name, { bubbles: true, detail: detail }); }
    catch (e) { ev = doc.createEvent('CustomEvent'); ev.initCustomEvent(name, true, false, detail); }
    el.dispatchEvent(ev);
  }
  function clone(v) { var o = {}; Object.keys(v || {}).forEach(function (k) { o[k] = (v[k] || []).slice(); }); return o; }
  function same(a, b) { return JSON.stringify(norm(a)) === JSON.stringify(norm(b)); }

  function create(opts) {
    if (!global.ShineSheet) throw new Error('ShineSortFilter needs ShineSheet (bottom-sheet.js)');
    opts = opts || {};
    var L = Object.assign({}, LABELS, opts.labels || {});
    var P = 'sf' + (++uid);
    var mount = opts.mount || doc.body;
    var sortCfg = opts.sort || { options: [] };
    var groups = (opts.filters && opts.filters.groups) || [];
    var defaultSort = sortCfg.defaultValue || (sortCfg.options[0] && sortCfg.options[0].value);
    var state = { sort: sortCfg.value || defaultSort, filters: normWith(groups, opts.filters && opts.filters.value) };
    var draft = null, sub = null, subQuery = '', countToken = 0, hideReasons = {}, closingApply = false;

    /* ── markup ──────────────────────────────────────────────────── */
    var bar = doc.createElement('div');
    bar.className = 'sf-bar';
    bar.setAttribute('role', 'toolbar');
    bar.setAttribute('aria-label', L.bar);
    bar.innerHTML =
      '<button class="sf-bar-btn sf-bar-btn--sort" type="button" id="' + P + '-sort-btn" aria-haspopup="dialog">' + I.sort + '<span>' + esc(L.sort) + '</span><span class="sf-dot" aria-hidden="true"></span></button>' +
      '<span class="sf-bar-div" aria-hidden="true"></span>' +
      '<button class="sf-bar-btn sf-bar-btn--filter" type="button" id="' + P + '-filter-btn" aria-haspopup="dialog">' + I.filter + '<span>' + esc(L.filter) + '</span><span class="sf-badge" aria-hidden="true">0</span></button>';

    var sortSheet = doc.createElement('div');
    sortSheet.className = 'bs sf-sheet sf-sort'; sortSheet.id = P + '-sort'; sortSheet.hidden = true;
    sortSheet.innerHTML =
      '<div class="bs-handle" aria-hidden="true"></div>' +
      '<div class="bs-head"><h2 class="bs-title" id="' + P + '-sort-title">' + esc(L.sortTitle) + '</h2>' +
        '<button class="bs-close" type="button" data-bs-close aria-label="' + esc(L.close) + '">' + I.close + '</button></div>' +
      '<div class="bs-body" role="radiogroup" aria-labelledby="' + P + '-sort-title"></div>';

    var filterSheet = doc.createElement('div');
    filterSheet.className = 'bs sf-sheet sf-filter'; filterSheet.id = P + '-filter'; filterSheet.hidden = true;
    filterSheet.innerHTML =
      '<div class="bs-handle" aria-hidden="true"></div>' +
      '<div class="bs-head"><h2 class="bs-title">' + esc(L.filterTitle) + '</h2>' +
        '<button class="bs-close" type="button" data-bs-close aria-label="' + esc(L.close) + '">' + I.close + '</button></div>' +
      '<div class="bs-body"></div>' +
      '<div class="bs-foot sf-foot">' +
        '<button class="sf-btn-secondary" type="button" data-sf-clear-all>' + esc(L.clearAll) + '</button>' +
        '<button class="sf-btn-primary" type="button" data-sf-apply aria-live="polite"></button>' +
      '</div>' +
      // nested "See all" sheet lives inside the filter sheet and covers it
      '<div class="bs bs--nested sf-sheet sf-sub" id="' + P + '-sub" hidden>' +
        '<div class="bs-head"><h2 class="bs-title"></h2>' +
          '<button class="sf-sub-clear" type="button" data-sf-sub-clear>' + esc(L.subClear) + '</button>' +
          '<button class="bs-close" type="button" data-bs-close aria-label="' + esc(L.back) + '">' + I.close + '</button></div>' +
        '<label class="sf-search" hidden>' + I.search + '<span class="sf-sr">' + esc(L.search) + '</span><input type="search" enterkeyhint="search" autocomplete="off" placeholder="' + esc(L.search) + '"></label>' +
        '<div class="bs-body" role="group"></div>' +
        '<div class="bs-foot"><button class="sf-btn-primary" type="button" data-sf-done>' + esc(L.done) + '</button></div>' +
      '</div>';

    var live = doc.createElement('div'); live.className = 'sf-sr'; live.setAttribute('aria-live', 'polite');
    [bar, sortSheet, filterSheet, live].forEach(function (n) { mount.appendChild(n); });
    global.ShineSheet.init(mount);

    var sortBtn = bar.querySelector('.sf-bar-btn--sort'), filterBtn = bar.querySelector('.sf-bar-btn--filter');
    var badge = bar.querySelector('.sf-badge');
    var sortBody = sortSheet.querySelector('.bs-body');
    var fBody = filterSheet.querySelector(':scope > .bs-body');
    var applyBtn = filterSheet.querySelector('[data-sf-apply]');
    var subSheet = filterSheet.querySelector('.sf-sub');
    var subTitle = subSheet.querySelector('.bs-title'), subBody = subSheet.querySelector('.bs-body');
    var subSearch = subSheet.querySelector('.sf-search'), subInput = subSearch.querySelector('input');
    var subClearBtn = subSheet.querySelector('[data-sf-sub-clear]');

    /* ── helpers ─────────────────────────────────────────────────── */
    function group(k) { for (var i = 0; i < groups.length; i++) if (groups[i].key === k) return groups[i]; return null; }
    function opt(g, id) { for (var i = 0; i < g.options.length; i++) if (g.options[i].id === id) return g.options[i]; return null; }
    function has(v, k, id) { return (v[k] || []).indexOf(id) > -1; }
    function toggleIn(v, k, id) {
      var a = v[k] || (v[k] = []), i = a.indexOf(id);
      if (i > -1) a.splice(i, 1); else a.push(id);
      // keep option order stable (config order), not tap order
      var g = group(k); if (g) a.sort(function (x, y) { return idx(g, x) - idx(g, y); });
    }
    function idx(g, id) { for (var i = 0; i < g.options.length; i++) if (g.options[i].id === id) return i; return 1e9; }
    function total(v) { return Object.keys(v).reduce(function (n, k) { return n + (v[k] || []).length; }, 0); }
    function sortLabel(v) { for (var i = 0; i < sortCfg.options.length; i++) if (sortCfg.options[i].value === v) return sortCfg.options[i].label; return v; }
    function popularOf(g) { return (g.popular && g.popular.length ? g.popular : g.options.slice(0, 4).map(function (o) { return o.id; })); }

    /* ── bar ─────────────────────────────────────────────────────── */
    function paintBar() {
      var n = total(state.filters);
      badge.textContent = n; badge.classList.toggle('is-shown', n > 0);
      filterBtn.setAttribute('aria-label', n ? tpl(L.filterApplied, { n: n }) : L.filter);
      var changed = state.sort !== defaultSort;
      sortBtn.classList.toggle('is-active', changed);
      sortBtn.setAttribute('aria-label', changed ? tpl(L.sortApplied, { label: sortLabel(state.sort) }) : L.sort);
    }
    function setBarHidden(on, reason) {
      reason = reason || 'api';
      if (on) hideReasons[reason] = 1; else delete hideReasons[reason];
      bar.classList.toggle('is-hidden', Object.keys(hideReasons).length > 0);
    }

    /* ── sort ────────────────────────────────────────────────────── */
    function renderSort() {
      sortBody.innerHTML = sortCfg.options.map(function (o) {
        var on = o.value === state.sort;
        return '<button class="sf-sort-row" type="button" role="radio" aria-checked="' + on + '" tabindex="' + (on ? 0 : -1) + '" data-value="' + esc(o.value) + '">' +
          '<span class="sf-sort-lbl">' + esc(o.label) + '</span><span class="sf-radio" aria-hidden="true"></span></button>';
      }).join('');
    }
    function pickSort(value) {
      var prev = state.sort;
      state.sort = value; renderSort(); paintBar();
      if (value !== prev) {
        emit(bar, 'shine:sort', { value: value, previous: prev, label: sortLabel(value), source: opts.source || null });
        if (typeof opts.onSort === 'function') opts.onSort(value, prev);
      }
      setTimeout(function () { global.ShineSheet.close(sortSheet, 'select'); }, opts.closeDelay == null ? 200 : opts.closeDelay);
    }
    sortBody.addEventListener('click', function (e) {
      var r = e.target.closest('.sf-sort-row'); if (r) pickSort(r.getAttribute('data-value'));
    });
    sortBody.addEventListener('keydown', function (e) {           // roving focus; Enter/Space selects
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].indexOf(e.key) < 0) return;
      var rows = Array.prototype.slice.call(sortBody.querySelectorAll('.sf-sort-row'));
      var i = rows.indexOf(doc.activeElement);
      var n = e.key === 'Home' ? 0 : e.key === 'End' ? rows.length - 1 : (i + (e.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length;
      e.preventDefault(); rows.forEach(function (r, k) { r.tabIndex = k === n ? 0 : -1; }); rows[n].focus();
    });

    /* ── filter ──────────────────────────────────────────────────── */
    function renderFilter() {
      fBody.innerHTML = groups.map(function (g) {
        var sel = draft[g.key] || [], pop = popularOf(g);
        var extras = sel.filter(function (id) { return pop.indexOf(id) < 0; });    // picked in See all → keep visible
        var ids = extras.concat(pop.filter(function (id) { return extras.indexOf(id) < 0; }));
        var pills = ids.map(function (id) {
          var o = opt(g, id); if (!o) return '';
          var on = has(draft, g.key, id);
          return '<button class="sf-pill" type="button" aria-pressed="' + on + '" data-group="' + esc(g.key) + '" data-opt="' + esc(id) + '">' +
            '<span>' + esc(o.label) + '</span>' + (o.count != null ? '<span class="sf-pill-count">' + fmt(o.count) + '</span>' : '') + '</button>';
        }).join('');
        var hidden = g.options.filter(function (o) { return pop.indexOf(o.id) < 0 && !has(draft, g.key, o.id); }).length;
        var hid = P + '-g-' + g.key;
        return '<div class="sf-group' + (sel.length ? ' has-selection' : '') + '" role="group" aria-labelledby="' + hid + '">' +
          '<div class="sf-group-h"><h3 class="sf-group-title" id="' + hid + '">' + esc(g.name) +
            '<span class="sf-group-count">' + sel.length + '<span class="sf-sr"> selected</span></span></h3>' +
            '<button class="sf-link" type="button" data-sf-clear="' + esc(g.key) + '" aria-label="' + esc(L.clear + ' ' + g.name) + '">' + esc(L.clear) + '</button></div>' +
          '<div class="sf-pills">' + pills + '</div>' +
          (hidden > 0 ? '<button class="sf-seeall" type="button" data-sf-seeall="' + esc(g.key) + '" aria-haspopup="dialog">' + esc(tpl(L.seeAll, { n: g.options.length })) + '</button>' : '') +
        '</div>';
      }).join('');
      requestCount();
    }
    function requestCount() {
      var token = ++countToken, v = norm(draft);
      var r = typeof opts.count === 'function' ? opts.count(v) : null;
      if (r && typeof r.then === 'function') { applyBtn.setAttribute('aria-busy', 'true'); r.then(function (n) { if (token === countToken) paintApply(n); }); }
      else paintApply(r);
    }
    function paintApply(n) {
      applyBtn.removeAttribute('aria-busy');
      applyBtn.__count = n;
      if (n === 0) { applyBtn.disabled = true; applyBtn.textContent = L.applyZero; applyBtn.removeAttribute('aria-label'); return; }
      applyBtn.disabled = false;
      applyBtn.innerHTML = n == null ? esc(L.done) : tpl(L.apply, { n: fmt(n) });
      if (n != null) applyBtn.setAttribute('aria-label', tpl(L.applyAria, { n: fmt(n) }));
    }
    function changed() { renderFilter(); if (sub) renderSub(); }

    fBody.addEventListener('click', function (e) {
      var p = e.target.closest('.sf-pill');
      if (p) { toggleIn(draft, p.getAttribute('data-group'), p.getAttribute('data-opt')); var k = p.getAttribute('data-group'), id = p.getAttribute('data-opt'); changed(); refocus('.sf-pill[data-group="' + k + '"][data-opt="' + id + '"]'); return; }
      var c = e.target.closest('[data-sf-clear]');
      if (c) { draft[c.getAttribute('data-sf-clear')] = []; changed(); return; }
      var s = e.target.closest('[data-sf-seeall]');
      if (s) openSub(s.getAttribute('data-sf-seeall'), s);
    });
    function refocus(sel) { var n = fBody.querySelector(sel); if (n && doc.activeElement === doc.body) n.focus({ preventScroll: true }); }
    filterSheet.querySelector('[data-sf-clear-all]').addEventListener('click', function () { draft = {}; changed(); });
    applyBtn.addEventListener('click', function () {
      var prev = clone(state.filters);
      state.filters = norm(draft); paintBar();
      closingApply = true;
      global.ShineSheet.close(filterSheet, 'apply');
      closingApply = false;
      if (!same(prev, state.filters)) {
        var n = total(state.filters);
        live.textContent = n ? tpl(L.filterApplied, { n: n }) : 'Filters cleared';
        emit(bar, 'shine:filter', { value: clone(state.filters), previous: prev, count: applyBtn.__count, applied: n, source: opts.source || null });
        if (typeof opts.onFilter === 'function') opts.onFilter(clone(state.filters), prev);
      }
    });

    /* ── See all (nested sheet) ──────────────────────────────────── */
    function openSub(key, trigger) {
      sub = group(key); if (!sub) return;
      subQuery = ''; subInput.value = '';
      subTitle.textContent = sub.name;
      subSearch.hidden = !sub.searchable;
      renderSub();
      global.ShineSheet.open(subSheet, { trigger: trigger });
    }
    function row(o, on) {
      return '<button class="sf-check" type="button" role="checkbox" aria-checked="' + on + '" data-opt="' + esc(o.id) + '">' +
        '<span class="sf-check-lbl">' + esc(o.label) + '</span>' + (o.count != null ? '<span class="sf-check-cnt">' + fmt(o.count) + '</span>' : '') +
        '<span class="sf-box" aria-hidden="true">' + I.check + '</span></button>';
    }
    function renderSub() {
      if (!sub) return;
      var g = sub, q = subQuery.toLowerCase().trim(), html = '';
      subClearBtn.classList.toggle('is-active', (draft[g.key] || []).length > 0);
      subBody.setAttribute('aria-label', g.name);
      if (q) {
        var hits = g.options.filter(function (o) { return o.label.toLowerCase().indexOf(q) > -1; });
        subBody.innerHTML = hits.length ? hits.map(function (o) { return row(o, has(draft, g.key, o.id)); }).join('') : '<div class="sf-empty" role="status">' + esc(L.noMatches) + '</div>';
        return;
      }
      var on = g.options.filter(function (o) { return has(draft, g.key, o.id); });
      var off = g.options.filter(function (o) { return !has(draft, g.key, o.id); });
      if (on.length) html += '<div class="sf-section">' + esc(tpl(L.selected, { n: on.length })) + '</div>' + on.map(function (o) { return row(o, true); }).join('');
      if (off.length) html += '<div class="sf-section">' + esc(tpl(L.all, { n: g.options.length, group: g.name.toLowerCase() })) + '</div>' + off.map(function (o) { return row(o, false); }).join('');
      subBody.innerHTML = html;
    }
    subBody.addEventListener('click', function (e) {
      var r = e.target.closest('.sf-check'); if (!r || !sub) return;
      var id = r.getAttribute('data-opt');
      toggleIn(draft, sub.key, id); changed();
      var n = subBody.querySelector('.sf-check[data-opt="' + id + '"]'); if (n) n.focus({ preventScroll: true });
    });
    subInput.addEventListener('input', function () { subQuery = subInput.value; renderSub(); });
    subClearBtn.addEventListener('click', function () { if (sub) { draft[sub.key] = []; changed(); } });
    subSheet.querySelector('[data-sf-done]').addEventListener('click', function () { global.ShineSheet.close(subSheet, 'done'); });
    subSheet.addEventListener('shine:sheet-closed', function (e) { if (e.target === subSheet) sub = null; });

    /* ── open / close ────────────────────────────────────────────── */
    function open(which) {
      if (which === 'filter') {
        draft = clone(state.filters);
        renderFilter();
        global.ShineSheet.open(filterSheet, { trigger: filterBtn });
        fBody.scrollTop = 0;
      } else {
        renderSort();
        global.ShineSheet.open(sortSheet, { trigger: sortBtn });
      }
    }
    function close() { global.ShineSheet.close(filterSheet); global.ShineSheet.close(sortSheet); }
    sortBtn.addEventListener('click', function () { open('sort'); });
    filterBtn.addEventListener('click', function () { open('filter'); });
    filterSheet.addEventListener('shine:sheet-close', function (e) {
      if (e.target === filterSheet && !closingApply) draft = clone(state.filters);    // dismiss = discard draft
    });

    // keep the floating bar out of the way while another screen-level sheet is up
    function onOther(e) {
      var s = e.target; if (!s.classList || !s.classList.contains('bs')) return;
      if (s === sortSheet || s === filterSheet || s === subSheet || s.classList.contains('bs--nested')) return;
      setBarHidden(e.type === 'shine:sheet-open', 'sheet:' + s.id);
    }
    doc.addEventListener('shine:sheet-open', onOther);
    doc.addEventListener('shine:sheet-close', onOther);

    /* ── state API ───────────────────────────────────────────────── */
    function getState() { return { sort: state.sort, filters: clone(state.filters) }; }
    function setState(s, o) {
      s = s || {}; o = o || {};
      var prev = getState();
      if (s.sort != null) state.sort = sortCfg.options.some(function (x) { return x.value === s.sort; }) ? s.sort : defaultSort;
      if (s.filters != null) state.filters = normWith(groups, s.filters);
      paintBar();
      if (!o.silent) {
        if (prev.sort !== state.sort) emit(bar, 'shine:sort', { value: state.sort, previous: prev.sort, label: sortLabel(state.sort), source: opts.source || null });
        if (!same(prev.filters, state.filters)) emit(bar, 'shine:filter', { value: clone(state.filters), previous: prev.filters, count: null, applied: total(state.filters), source: opts.source || null });
      }
      return getState();
    }
    function reset(o) { return setState({ sort: defaultSort, filters: {} }, o); }
    function destroy() {
      close();
      doc.removeEventListener('shine:sheet-open', onOther);
      doc.removeEventListener('shine:sheet-close', onOther);
      [bar, sortSheet, filterSheet, live].forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
      var sc = mount.querySelectorAll('.bs-scrim'); Array.prototype.forEach.call(sc, function (n) { if (!n.nextElementSibling || !n.nextElementSibling.classList.contains('bs')) n.remove(); });
    }

    renderSort(); paintBar();
    return { getState: getState, setState: setState, reset: reset, open: open, close: close,
             setBarHidden: setBarHidden, destroy: destroy, el: { bar: bar, sort: sortSheet, filter: filterSheet, sub: subSheet } };
  }

  // drop unknown groups/ids, empty groups and duplicates
  function normWith(groups, v) {
    var out = {}; v = v || {};
    groups.forEach(function (g) {
      var ids = (Array.isArray(v[g.key]) ? v[g.key] : String(v[g.key] || '').split(',')).map(function (s) { return String(s).trim(); });
      var ok = g.options.map(function (o) { return o.id; }).filter(function (id) { return ids.indexOf(id) > -1; });
      if (ok.length) out[g.key] = ok;
    });
    return out;
  }
  function norm(v) {
    var out = {}; Object.keys(v || {}).sort().forEach(function (k) { if (v[k] && v[k].length) out[k] = v[k].slice(); });
    return out;
  }

  global.ShineSortFilter = { create: create, version: '1.0.0' };
})(window);
