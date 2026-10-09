/* ═══════════════════════════════════════════════════════════════════════
   SHINE · SEARCH MODAL  (app component)                       v1.3.0
   Pair with search-modal.css. Zero dependencies, no build step.

   Open it from anywhere — three equivalent ways:

   1. Declarative (no JS on the page):
        <button data-shine-search>Explore jobs</button>                    → fresh search
        <button data-shine-search="edit"
                data-ssm-keyword-from="#heroQuery"
                data-ssm-location-from="#heroLocation">Edit search</button>  → prefilled from the page
        <a data-shine-search data-ssm-location="Pune" data-ssm-source="city-page">Search jobs</a>

   2. Programmatic:
        ShineSearch.open({ keyword:'Product Manager', location:'India', source:'jsrp' })
        ShineSearch.close()
        ShineSearch.configure({ resultsUrl:'jsrp.html' })   // app-wide defaults

   3. Drop-in for the existing JSRP contract:
        openSearchOverlay({ keyword, location, experience })              → same as open(), edit mode

   Listen for the result on any page:
        document.addEventListener('shine:search', e => e.detail)
          detail = { keywords:[…], locations:[…], experience, query, location, mode, source }
        Call e.preventDefault() to take over (no default toast / navigation).
   ═══════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  if (global.ShineSearch) return;
  var doc = global.document;

  /* ── Icons (24-grid, stroke = currentColor) ───────────────────────── */
  var I = {
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>',
    pin:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>',
    clock:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    caret:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
    close:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>',
    alert:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>',
    check:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>'
  };

  /* ── App-wide defaults (override with ShineSearch.configure or window.ShineSearchConfig) ── */
  var DEFAULTS = {
    roles: ['Software Engineer','Senior Software Engineer','Product Manager','Senior Product Manager','Product Designer',
      'UX Designer','UI Designer','Data Analyst','Data Scientist','DevOps Engineer','Frontend Developer','Backend Developer',
      'Full Stack Developer','Marketing Manager','Sales Executive','HR Manager','Business Analyst','Project Manager',
      'QA Engineer','Mobile App Developer','Cloud Engineer','Engineering Manager'],
    locations: ['Bangalore','Mumbai','Delhi NCR','Hyderabad','Chennai','Pune','Kolkata','Ahmedabad','Gurgaon','Noida',
      'Jaipur','Indore','Remote','Hybrid','Work From Home'],
    experienceOptions: ['Fresher','0–1 years','1–3 years','3–5 years','5–7 years','7–10 years','10–15 years','15+ years'],
    minChars: 2,                       // suggestions open after this many typed characters
    eyebrow: 'Find your next role',
    title: "What's next for",          // plain text …
    titleAccent: 'you?',               // … + brand-coloured tail
    submitLabel: 'Search Jobs',
    errorText: 'Add a role, city or experience to search.',
    placeholders: { keyword: 'Job title, skill, or keyword', location: 'Location', experience: 'Experience' },
    resultsUrl: null,                  // set to navigate on submit: url?q=…&loc=…&exp=…
    toast: true,                       // confirmation toast when nothing else handles submit
    autofocus: true,                   // focus the keyword field once the modal settles
    onSubmit: null, onOpen: null, onClose: null
  };
  var cfg = merge({}, DEFAULTS, global.ShineSearchConfig || {});
  var session = cfg;                   // per-open options layered on cfg
  var root, card, dialog, els = {}, lastFocus = null, closeTimer = null, toastTimer = null;
  var SEP = ', ';

  function merge(t) {
    for (var i = 1; i < arguments.length; i++) {
      var s = arguments[i]; if (!s) continue;
      for (var k in s) if (Object.prototype.hasOwnProperty.call(s, k)) {
        t[k] = (k === 'placeholders' && t[k]) ? merge({}, t[k], s[k]) : s[k];
      }
    }
    return t;
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]; }); }
  function hl(text, q) {
    if (!q) return esc(text);
    var i = text.toLowerCase().indexOf(q.toLowerCase());
    if (i < 0) return esc(text);
    return esc(text.slice(0, i)) + '<b>' + esc(text.slice(i, i + q.length)) + '</b>' + esc(text.slice(i + q.length));
  }
  function emit(name, detail, cancelable) {
    var ev;
    try { ev = new CustomEvent(name, { detail: detail, cancelable: !!cancelable }); }
    catch (e) { ev = doc.createEvent('CustomEvent'); ev.initCustomEvent(name, false, !!cancelable, detail); }
    doc.dispatchEvent(ev);
    return ev;
  }
  function list(v) { return (Array.isArray(v) ? v : String(v || '').split(',')).map(function (s) { return String(s).trim(); }).filter(Boolean); }

  /* ── Markup — injected once, on first use ─────────────────────────── */
  function mount() {
    if (root) return;
    root = doc.createElement('div');
    root.className = 'ssm';
    root.setAttribute('aria-hidden', 'true');
    root.innerHTML =
      '<div class="ssm-dialog" role="dialog" aria-modal="true" aria-labelledby="ssm-title">' +
      '<div class="ssm-card">' +
        '<button class="ssm-close" type="button" aria-label="Close search">' + I.close + '</button>' +
        '<p class="ssm-eyebrow"><span class="ssm-eyebrow-dot" aria-hidden="true"></span><span data-ssm="eyebrow"></span></p>' +
        '<h2 class="ssm-title" id="ssm-title"></h2>' +
        '<div class="ssm-form" role="search"><div class="ssm-fields">' +
          combo('keyword', I.search) +
          combo('location', I.pin) +
          '<div class="ssm-field ssm-field--select" data-field="experience" tabindex="0" role="combobox" aria-haspopup="listbox" aria-expanded="false" aria-controls="ssm-list-experience" aria-labelledby="ssm-lbl-experience ssm-val-experience">' +
            '<span class="ssm-sr" id="ssm-lbl-experience">Experience</span>' +
            '<span class="ssm-field-icon" aria-hidden="true">' + I.clock + '</span>' +
            '<span class="ssm-value is-empty" id="ssm-val-experience"></span>' +
            '<span class="ssm-caret" aria-hidden="true">' + I.caret + '</span>' +
            '<div class="ssm-dropdown" id="ssm-list-experience" role="listbox" aria-label="Total experience"></div>' +
          '</div>' +
        '</div>' +
          '<button class="ssm-submit" type="button">' + I.search + '<span data-ssm="submit"></span></button>' +
        '</div>' +
      '</div>' +
      // validation alert floats just below the card (v1.2.0), still inside the dialog for screen readers
      '<div class="ssm-error-wrap" aria-live="assertive"><div><p class="ssm-error" role="alert">' + I.alert + '<span data-ssm="error"></span></p></div></div>' +
      '</div>';
    doc.body.appendChild(root);
    card = root.querySelector('.ssm-card'); dialog = root.querySelector('.ssm-dialog');
    els = {
      close: root.querySelector('.ssm-close'),
      eyebrow: root.querySelector('[data-ssm="eyebrow"]'),
      title: root.querySelector('.ssm-title'),
      keyword: root.querySelector('#ssm-in-keyword'),
      location: root.querySelector('#ssm-in-location'),
      expField: root.querySelector('[data-field="experience"]'),
      expValue: root.querySelector('#ssm-val-experience'),
      expList: root.querySelector('#ssm-list-experience'),
      errWrap: root.querySelector('.ssm-error-wrap'),
      errText: root.querySelector('[data-ssm="error"]'),
      submit: root.querySelector('.ssm-submit'),
      submitText: root.querySelector('[data-ssm="submit"]')
    };
    wire();
  }
  function combo(name, icon) {
    var label = name === 'keyword' ? 'Job title, skill, or keyword' : 'Location';
    return '<div class="ssm-field" data-field="' + name + '">' +
      '<label class="ssm-sr" for="ssm-in-' + name + '">' + label + '</label>' +
      '<span class="ssm-field-icon" aria-hidden="true">' + icon + '</span>' +
      '<input class="ssm-input" id="ssm-in-' + name + '" type="text" autocomplete="off" autocapitalize="words" spellcheck="false" enterkeyhint="search"' +
        ' role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="ssm-list-' + name + '" />' +
      '<div class="ssm-dropdown" id="ssm-list-' + name + '" role="listbox" aria-label="' + label + ' suggestions"></div>' +
    '</div>';
  }

  /* ── Behaviour ────────────────────────────────────────────────────── */
  function fields() { return root.querySelectorAll('.ssm-field'); }
  function closeDropdowns(except) {
    Array.prototype.forEach.call(fields(), function (f) {
      if (f === except) return;
      f.classList.remove('is-open');
      var ctl = f.querySelector('[role="combobox"]') || f;
      ctl.setAttribute('aria-expanded', 'false');
      ctl.removeAttribute('aria-activedescendant');
    });
  }
  function closeField(f) {
    f.classList.remove('is-open');
    var ctl = f.querySelector('[role="combobox"]') || f;
    ctl.setAttribute('aria-expanded', 'false'); ctl.removeAttribute('aria-activedescendant');
  }
  function openDropdown(f) {
    closeDropdowns(f);
    f.classList.add('is-open');
    (f.querySelector('[role="combobox"]') || f).setAttribute('aria-expanded', 'true');
  }
  function showError() {
    els.errWrap.classList.add('is-shown');
    dialog.classList.remove('is-shaking'); void dialog.offsetWidth; dialog.classList.add('is-shaking');
    setTimeout(function () { dialog.classList.remove('is-shaking'); }, 400);
  }
  function hideError() { els.errWrap.classList.remove('is-shown'); }

  // keyboard highlight inside an open list
  function move(listEl, ctl, dir) {
    var opts = listEl.querySelectorAll('.ssm-option'); if (!opts.length) return;
    var cur = listEl.querySelector('.ssm-option.is-active'), i = Array.prototype.indexOf.call(opts, cur);
    if (cur) cur.classList.remove('is-active');
    i = i < 0 ? (dir > 0 ? 0 : opts.length - 1) : (i + dir + opts.length) % opts.length;
    opts[i].classList.add('is-active'); opts[i].scrollIntoView({ block: 'nearest' });
    ctl.setAttribute('aria-activedescendant', opts[i].id);
  }

  function setupCombo(name, getOptions, icon) {
    var input = els[name], field = input.closest('.ssm-field'), dd = field.querySelector('.ssm-dropdown');
    function term() { var p = input.value.split(SEP); return (p[p.length - 1] || '').trim(); }
    function committed() { return input.value.split(SEP).slice(0, -1).map(function (p) { return p.trim(); }).filter(Boolean); }
    function commit(v) {
      v = (v || '').trim(); if (!v) return;
      var c = committed();
      if (!c.some(function (x) { return x.toLowerCase() === v.toLowerCase(); })) c.push(v);
      input.value = c.join(SEP) + SEP;
      setTimeout(function () { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }, 0);
      closeDropdowns(); hideError();
    }
    function render(q) {
      var taken = committed().map(function (t) { return t.toLowerCase(); });
      var opts = getOptions().filter(function (o) { return o.toLowerCase().indexOf(q.toLowerCase()) > -1 && taken.indexOf(o.toLowerCase()) < 0; });
      dd.innerHTML = opts.length
        ? opts.map(function (o, i) {
            return '<div class="ssm-option" role="option" id="ssm-opt-' + name + '-' + i + '" data-value="' + esc(o) + '">' +
              '<span class="ssm-option-icon" aria-hidden="true">' + icon + '</span><span>' + hl(o, q) + '</span></div>';
          }).join('')
        : '<div class="ssm-option-empty">No matches. Press <b>Enter</b> to add “<b>' + esc(q) + '</b>”.</div>';
    }
    function maybeOpen() {
      var t = term();
      if (t.length >= session.minChars) { render(t); openDropdown(field); }
      else closeDropdowns();
    }
    // mousedown keeps focus in the input (no blur → no keyboard flicker on mobile)
    dd.addEventListener('mousedown', function (e) {
      var o = e.target.closest('.ssm-option'); if (!o) return;
      e.preventDefault(); commit(o.getAttribute('data-value'));
    });
    input.addEventListener('focus', function () { setTimeout(function () { input.setSelectionRange(input.value.length, input.value.length); }, 0); });
    input.addEventListener('input', function () { hideError(); maybeOpen(); });
    input.addEventListener('blur', function () {
      setTimeout(function () { if (doc.activeElement !== input) closeField(field); }, 120);   // only this field — another may be opening
      input.value = input.value.replace(/(?:,\s*)+$/, '');
    });
    input.addEventListener('keydown', function (e) {
      var open = field.classList.contains('is-open');
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (!open) { var t = term(); if (t.length < session.minChars) return; render(t); openDropdown(field); }
        e.preventDefault(); move(dd, input, e.key === 'ArrowDown' ? 1 : -1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        var act = open && dd.querySelector('.ssm-option.is-active');
        if (act) commit(act.getAttribute('data-value'));
        else if (term()) commit(term());
        else submit();                          // nothing left to commit → keyboard "Search" submits
      } else if (e.key === 'Escape' && open) {
        e.stopPropagation(); closeDropdowns();
      }
    });
    // tap on the field chrome (icon / padding) → continue the list with a fresh term
    field.addEventListener('click', function (e) {
      if (e.target === input || e.target.closest('.ssm-dropdown')) return;
      if (input.value.trim() && !/(?:,\s*)$/.test(input.value)) input.value = input.value.trim() + SEP;
      input.focus();
    });
    input.ssmValues = function () { return list(input.value); };
  }

  function setupExperience() {
    var f = els.expField, dd = els.expList;
    function render() {
      var cur = f.getAttribute('data-value') || '';
      dd.innerHTML = '<span class="ssm-dropdown-eyebrow" aria-hidden="true">Total experience</span>' +
        session.experienceOptions.map(function (o, i) {
          return '<div class="ssm-option" role="option" id="ssm-opt-exp-' + i + '" data-value="' + esc(o) + '" aria-selected="' + (o === cur) + '">' +
            '<span class="ssm-option-icon" aria-hidden="true">' + I.clock + '</span><span>' + esc(o) + '</span></div>';
        }).join('');
    }
    function toggle(force) {
      var open = typeof force === 'boolean' ? force : !f.classList.contains('is-open');
      if (open) {
        render(); openDropdown(f);
        var sel = dd.querySelector('[aria-selected="true"]');
        if (sel) { sel.classList.add('is-active'); f.setAttribute('aria-activedescendant', sel.id); sel.scrollIntoView({ block: 'nearest' }); }
      } else closeDropdowns();
    }
    dd.addEventListener('click', function (e) {
      var o = e.target.closest('.ssm-option'); if (!o) return;
      e.stopPropagation(); setExperience(o.getAttribute('data-value')); toggle(false); f.focus(); hideError();
    });
    f.addEventListener('click', function (e) { if (!e.target.closest('.ssm-dropdown')) toggle(); });
    f.addEventListener('keydown', function (e) {
      var open = f.classList.contains('is-open');
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        var act = open && dd.querySelector('.ssm-option.is-active');
        if (act) { setExperience(act.getAttribute('data-value')); toggle(false); hideError(); } else toggle();
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault(); if (!open) toggle(true); move(dd, f, e.key === 'ArrowDown' ? 1 : -1);
      } else if (e.key === 'Escape' && open) { e.stopPropagation(); toggle(false); }
    });
  }
  function setExperience(v) {
    v = (v || '').trim();
    if (v) { els.expField.setAttribute('data-value', v); els.expValue.textContent = v; els.expValue.classList.remove('is-empty'); }
    else { els.expField.removeAttribute('data-value'); els.expValue.textContent = session.placeholders.experience; els.expValue.classList.add('is-empty'); }
  }

  function trapFocus(e) {
    if (e.key !== 'Tab') return;
    var f = Array.prototype.filter.call(card.querySelectorAll('button, input, [tabindex="0"]'), function (el) { return el.offsetParent !== null; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function wire() {
    setupCombo('keyword', function () { return session.roles; }, I.search);
    setupCombo('location', function () { return session.locations; }, I.pin);
    setupExperience();
    els.close.addEventListener('click', function () { close('close-button'); });
    els.submit.addEventListener('click', submit);
    // backdrop tap does NOT close — matches JSRP (users lose typed input too easily on mobile)
    root.addEventListener('click', function (e) { if (!e.target.closest('.ssm-field')) closeDropdowns(); });
    root.addEventListener('keydown', trapFocus);
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && isOpen()) close('escape'); });
  }

  /* ── Submit ───────────────────────────────────────────────────────── */
  function submit() {
    var keywords = els.keyword.ssmValues(), locations = els.location.ssmValues(), exp = els.expField.getAttribute('data-value') || '';
    if (!keywords.length && !locations.length && !exp) { showError(); els.keyword.focus(); return; }
    var detail = {
      keywords: keywords, locations: locations, experience: exp,
      query: keywords.join(', '), location: locations.join(', '),
      mode: root.getAttribute('data-mode'), source: root.getAttribute('data-source') || ''
    };
    if (typeof session.onSubmit === 'function') {                 // caller owns the outcome
      if (session.onSubmit(detail) === false) return;                // …and may veto (modal stays open)
      close('submit'); emit('shine:search', detail, false); return;
    }
    var ev = emit('shine:search', detail, true);
    close('submit');
    if (ev.defaultPrevented) return;                                 // a page listener handled it
    if (session.resultsUrl) {
      var p = [];
      if (detail.query) p.push('q=' + encodeURIComponent(detail.query));
      if (detail.location) p.push('loc=' + encodeURIComponent(detail.location));
      if (exp) p.push('exp=' + encodeURIComponent(exp));
      global.location.href = session.resultsUrl + (session.resultsUrl.indexOf('?') > -1 ? '&' : '?') + p.join('&');
      return;
    }
    if (session.toast) toast('Searching ' + (detail.query || 'jobs') + (detail.location ? ' in ' + detail.location : '') + (exp ? ' · ' + exp : ''));
  }

  function toast(msg, tone) {
    // v1.3.0: the app-wide notify component owns toasts when it is on the page (same pill everywhere)
    if (global.ShineNotify) return global.ShineNotify.toast(msg, { tone: tone || 'neutral' });
    var t = doc.querySelector('.ssm-toast');
    if (!t) { t = doc.createElement('div'); t.className = 'ssm-toast'; t.setAttribute('role', 'status'); doc.body.appendChild(t); }
    t.innerHTML = I.check + '<span>' + esc(msg) + '</span>';
    requestAnimationFrame(function () { t.classList.add('is-shown'); });
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('is-shown'); }, 3000);
  }

  /* ── Public API ───────────────────────────────────────────────────── */
  function isOpen() { return !!root && root.classList.contains('is-open'); }

  /**
   * open(options?)
   *   keyword, location     string | string[]   prefill (comma-separated or array)
   *   experience            string              must be one of `experienceOptions` to preselect
   *   mode                  'new' | 'edit'      default 'new'; 'edit' = refining an existing search (JSRP)
   *   source                string              where it was opened from (e.g. 'home', 'jsrp') — echoed in the result
   *   + any default (title, titleAccent, eyebrow, submitLabel, resultsUrl, onSubmit, autofocus…) for this open only
   */
  function open(opts) {
    opts = opts || {};
    mount();
    clearTimeout(closeTimer);
    var o = {};                                   // per-open overrides only — prefill keys are state, not config
    for (var k in opts) if (['keyword','location','experience','mode','source','trigger'].indexOf(k) < 0) o[k] = opts[k];
    session = merge({}, cfg, o);
    root.setAttribute('data-mode', opts.mode === 'edit' ? 'edit' : 'new');   // edit only when the caller says so (e.g. JSRP)
    root.setAttribute('data-source', opts.source || '');
    // copy
    els.eyebrow.textContent = session.eyebrow;
    els.title.innerHTML = esc(session.title) + (session.titleAccent ? ' <span class="ssm-accent">' + esc(session.titleAccent) + '</span>' : '');
    els.submitText.textContent = session.submitLabel;
    els.errText.textContent = session.errorText;
    els.keyword.placeholder = session.placeholders.keyword;
    els.location.placeholder = session.placeholders.location;
    // state — always start clean (JSRP left the last dropdown open between opens)
    closeDropdowns(); hideError(); dialog.classList.remove('is-shaking');
    els.keyword.value = list(opts.keyword).join(SEP);
    els.location.value = list(opts.location).join(SEP);
    setExperience(opts.experience && session.experienceOptions.indexOf(opts.experience) > -1 ? opts.experience : '');
    // show
    lastFocus = opts.trigger || doc.activeElement;
    doc.documentElement.classList.add('ssm-lock');
    root.setAttribute('aria-hidden', 'false');
    root.classList.add('is-mounted');
    void root.offsetWidth;
    root.classList.add('is-open');
    if (session.autofocus) setTimeout(function () { if (isOpen()) els.keyword.focus(); }, 320);
    if (typeof session.onOpen === 'function') session.onOpen({ mode: root.getAttribute('data-mode'), source: opts.source || '' });
    emit('shine:search-open', { mode: root.getAttribute('data-mode'), source: opts.source || '' });
  }

  function close(reason) {
    if (!isOpen()) return;
    closeDropdowns();
    root.classList.remove('is-open');
    root.setAttribute('aria-hidden', 'true');
    doc.documentElement.classList.remove('ssm-lock');
    if (doc.activeElement && root.contains(doc.activeElement)) doc.activeElement.blur();
    closeTimer = setTimeout(function () { root.classList.remove('is-mounted'); }, 260);
    if (lastFocus && lastFocus.focus && doc.contains(lastFocus)) { try { lastFocus.focus({ preventScroll: true }); } catch (e) {} }
    if (typeof session.onClose === 'function') session.onClose({ reason: reason || 'api' });
    emit('shine:search-close', { reason: reason || 'api' });
  }

  function configure(o) { cfg = merge(cfg, o || {}); if (!isOpen()) session = cfg; return cfg; }

  /* Declarative triggers — any element with [data-shine-search], present now or added later */
  function readFrom(sel) {
    if (!sel) return '';
    var n = doc.querySelector(sel); if (!n) return '';
    return ('value' in n && n.tagName !== 'BUTTON' ? n.value : n.textContent || '').trim();
  }
  doc.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-shine-search]');
    if (!t) return;
    e.preventDefault();
    var d = t.dataset, mode = (d.shineSearch || '').trim();
    open({
      mode: mode === 'edit' || mode === 'new' ? mode : undefined,
      keyword: d.ssmKeyword || readFrom(d.ssmKeywordFrom),
      location: d.ssmLocation || readFrom(d.ssmLocationFrom),
      experience: d.ssmExperience || readFrom(d.ssmExperienceFrom),
      source: d.ssmSource || '',
      trigger: t
    });
  });

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', mount); else mount();

  global.ShineSearch = { open: open, close: close, configure: configure, isOpen: isOpen, toast: toast, version: '1.3.0' };
  // drop-in for pages already calling the JSRP overlay API
  if (typeof global.openSearchOverlay !== 'function') {
    global.openSearchOverlay = function (prefill) { open(prefill ? merge({ mode: 'edit', source: 'jsrp' }, prefill) : {}); };
  }
})(window);
