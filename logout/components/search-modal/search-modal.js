/* ═══════════════════════════════════════════════════════════════════════
   SHINE · SEARCH MODAL  (app component · App-components/Modals/)    v2.0.1
   Pair with search-modal.css. Built ONLY from App-components (v2.0.0, user 2026-11-19):
     buttons atom (close · Search Jobs) · badges atom (eyebrow) · input fields / field-base (3 fields, Small) ·
     inline dropdown (ShineDropdown: role · city suggestions, experience list) · alert (ShineAlert: validation) ·
     notify (ShineNotify: the toast) · icons atom (every glyph).
   Needs on the page, before this script: field-base.js · inline-dropdown.js · alert.js (+ notify.js for toasts).

   Open it from anywhere — three equivalent ways:
   1. Declarative:   <button data-shine-search>Explore jobs</button>                     → fresh search
                     <button data-shine-search="edit" data-ssm-keyword-from="#q">…</button>  → prefilled from the page
   2. Programmatic:  ShineSearch.open({ keyword:'Product Manager', location:'India', source:'jsrp' })
                     ShineSearch.close() · ShineSearch.configure({ resultsUrl:'jsrp.html' }) · ShineSearch.isOpen()
   3. JSRP drop-in:  openSearchOverlay({ keyword, location, experience })              → open(), edit mode
   Result: document.addEventListener('shine:search', e => e.detail)
             detail = { keywords:[…], locations:[…], experience, query, location, mode, source }
           e.preventDefault() takes over (no default navigation / toast).
   ═══════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  if (global.ShineSearch) return;
  var doc = global.document;

  /* ── Icons — the icons atom (atoms/icons, verbatim) ───────────────── */
  var I = { close: "<svg aria-hidden=\"true\" focusable=\"false\" data-icon=\"ic_close-outline\" viewBox=\"0 0 20 20\" fill=\"none\"><path d=\"M16.2528 3.00257L16.3599 3.01371L16.3814 3.01543L16.4028 3.02228L16.5056 3.05313L16.5253 3.05999L16.5433 3.06942L16.6582 3.12941L16.6753 3.14398L16.7584 3.21254L16.7747 3.22625L16.7884 3.24253L16.857 3.32566L16.8716 3.3428L16.9316 3.45764L16.941 3.47564L16.947 3.49535L16.9787 3.59819L16.9855 3.61876L16.9873 3.64104L16.9984 3.74816L17.0001 3.76959L16.9984 3.79101L16.9873 3.89814L16.9855 3.92042L16.9787 3.94099L16.947 4.04383L16.941 4.06354L16.9316 4.08154L16.8716 4.19638L16.857 4.21352L16.7884 4.29665L16.7816 4.30522L11.0859 10L16.7816 15.6956L16.7884 15.7042L16.857 15.7873L16.8716 15.8045L16.9316 15.9193L16.941 15.9373L16.947 15.957L16.9787 16.0599L16.9855 16.0804L16.9873 16.1027L16.9984 16.2098L17.0001 16.2313L16.9984 16.2527L16.9873 16.3598L16.9855 16.3812L16.9787 16.4027L16.947 16.5055L16.941 16.5252L16.9316 16.5432L16.8716 16.6581L16.857 16.6752L16.7884 16.7583L16.7747 16.7746L16.7584 16.7883L16.6753 16.8569L16.6582 16.8714L16.5433 16.9314L16.5253 16.9409L16.5056 16.9469L16.4028 16.9786L16.3814 16.9854L16.3599 16.9871L16.2528 16.9983L16.2314 17L16.21 16.9983L16.1028 16.9871L16.0806 16.9854L16.06 16.9786L15.9571 16.9469L15.9374 16.9409L15.9194 16.9314L15.8046 16.8714L15.7875 16.8569L15.7043 16.7883L15.6958 16.7815L10.0001 11.0858L4.30534 16.7815L4.29676 16.7883L4.21364 16.8569L4.1965 16.8714L4.08166 16.9314L4.06366 16.9409L4.04395 16.9469L3.94111 16.9786L3.92054 16.9854L3.89826 16.9871L3.79113 16.9983L3.76971 17L3.74828 16.9983L3.64116 16.9871L3.61888 16.9854L3.59831 16.9786L3.49547 16.9469L3.47576 16.9409L3.45776 16.9314L3.34292 16.8714L3.32578 16.8569L3.24265 16.7883L3.22637 16.7746L3.21266 16.7583L3.1441 16.6752L3.12953 16.6581L3.06954 16.5432L3.06011 16.5252L3.05325 16.5055L3.0224 16.4027L3.01555 16.3812L3.01383 16.3598L3.00269 16.2527L3.00098 16.2313L3.00269 16.2098L3.01383 16.1027L3.01555 16.0804L3.0224 16.0599L3.05325 15.957L3.06011 15.9373L3.06954 15.9193L3.12953 15.8045L3.1441 15.7873L3.21266 15.7042L3.21951 15.6956L3.22637 15.6879L8.91344 10L3.21866 4.30522L3.21266 4.29665L3.1441 4.21352L3.12953 4.19638L3.06954 4.08154L3.06011 4.06354L3.05325 4.04383L3.0224 3.94099L3.01555 3.92042L3.01383 3.89814L3.00269 3.79101L3.00098 3.76959L3.00269 3.74816L3.01383 3.64104L3.01555 3.61876L3.0224 3.59819L3.05325 3.49535L3.06011 3.47564L3.06954 3.45764L3.12953 3.3428L3.1441 3.32566L3.21266 3.24253L3.22637 3.22625L3.24265 3.21254L3.32578 3.14398L3.34292 3.12941L3.45776 3.06942L3.47576 3.05999L3.49547 3.05313L3.59831 3.02228L3.61888 3.01543L3.64116 3.01371L3.74828 3.00257L3.76971 3L3.79113 3.00257L3.89826 3.01371L3.92054 3.01543L3.94111 3.02228L4.04395 3.05313L4.06366 3.05999L4.08166 3.06942L4.1965 3.12941L4.21364 3.14398L4.29676 3.21254L4.30534 3.21854L10.0001 8.91332L15.688 3.22625L15.6958 3.21939L15.7043 3.21254L15.7875 3.14398L15.8046 3.12941L15.9194 3.06942L15.9374 3.05999L15.9571 3.05313L16.06 3.02228L16.0806 3.01543L16.1028 3.01371L16.21 3.00257L16.2314 3L16.2528 3.00257Z\" fill=\"currentColor\"/></svg>", search: "<svg aria-hidden=\"true\" focusable=\"false\" data-icon=\"ic_search-outline\" viewBox=\"0 0 20 20\" fill=\"none\"><path d=\"M15.5652 7.68295L15.3862 6.78195L15.2522 6.34195L15.0902 5.91195L14.6842 5.08795L14.1732 4.32295L13.8822 3.96795L13.2322 3.31795L12.8772 3.02695L12.5032 2.75895L11.7072 2.29895L11.2882 2.10995L10.4182 1.81395L9.9712 1.70995L9.0592 1.58995L8.6002 1.57495L7.6832 1.63495L7.2292 1.70995L6.3422 1.94795L5.9122 2.10995L5.0882 2.51595L4.6972 2.75895L3.9682 3.31795L3.6332 3.63295L3.0272 4.32295L2.5162 5.08695L2.2992 5.49295L2.1102 5.91195L1.8142 6.78195L1.7102 7.22895L1.5902 8.14095L1.5752 8.59995L1.6352 9.51695L1.7102 9.97095L1.9482 10.858L2.2992 11.707L2.7592 12.503L3.3182 13.232L3.9682 13.882L4.3232 14.173L5.0872 14.684L5.9122 15.09L6.7822 15.386L7.6832 15.565L8.1412 15.61H9.0592L9.9712 15.49L10.4182 15.386L11.2882 15.09L12.1122 14.684L12.8902 14.163L16.9642 18.236L17.2562 18.431L17.4242 18.483H17.7762L18.1002 18.3479L18.3482 18.1L18.4312 17.944L18.4832 17.7759V17.424L18.3482 17.1L14.1632 12.89L14.4412 12.503L14.9012 11.707L15.0902 11.288L15.3862 10.418L15.5652 9.51695L15.6102 9.05895L15.6252 8.59995L15.5652 7.68295ZM14.3632 8.97795L14.2642 9.72695L14.0692 10.456L13.9352 10.81L13.6012 11.488L13.4022 11.808L12.9422 12.408L12.4082 12.942L12.1162 13.182L11.4872 13.601L11.1542 13.779L10.4562 14.069L10.0952 14.178L9.7272 14.264L8.9782 14.363H8.2222L7.8462 14.326L7.1052 14.178L6.74419 14.069L6.0462 13.779L5.7122 13.601L5.3922 13.402L4.7922 12.942L4.5162 12.684L4.0182 12.116L3.7982 11.808L3.4212 11.154L3.2652 10.81L3.0222 10.095L2.8742 9.35395L2.8372 8.97795L2.8252 8.59995L2.8742 7.84595L2.9362 7.47295L3.1312 6.74395L3.4212 6.04595L3.5992 5.71195L4.0182 5.08395L4.2582 4.79195L4.5162 4.51595L5.0842 4.01795L5.3922 3.79795L6.0462 3.42095L6.74419 3.13095L7.1052 3.02195L7.8462 2.87395L8.2222 2.83695L8.6002 2.82495L9.3542 2.87395L9.7272 2.93595L10.4562 3.13095L11.1542 3.42095L11.4882 3.59895L12.1162 4.01795L12.4082 4.25795L12.9422 4.79195L13.1822 5.08395L13.6012 5.71295L13.7792 6.04595L14.0692 6.74395L14.1782 7.10495L14.3262 7.84595L14.3632 8.22195V8.97795Z\" fill-rule=\"evenodd\" clip-rule=\"evenodd\" fill=\"currentColor\"/></svg>", pin: "<svg aria-hidden=\"true\" focusable=\"false\" data-icon=\"ic_location-outline\" viewBox=\"0 0 20 20\" fill=\"none\"><path d=\"M10.0026 2.29163C7.15535 2.2897 4.37046 3.94189 3.62611 7.21322C2.74522 11.1051 5.15666 14.4801 7.42508 16.6664C8.86717 18.0508 11.1338 18.0491 12.5659 16.667L12.567 16.6659C14.8436 14.4796 17.2546 11.1128 16.3737 7.22129C15.6332 3.94975 12.8501 2.29355 10.0026 2.29163ZM17.5928 6.9453C16.6999 3.0002 13.3206 1.04387 10.0035 1.04163C6.68628 1.03939 3.3046 2.99124 2.40716 6.93633C1.37157 11.5109 4.22642 15.3197 6.55788 17.5667L6.55867 17.5674C8.48316 19.4157 11.5159 19.4173 13.4336 17.5667C15.7735 15.3195 18.6284 11.5199 17.5928 6.9453ZM9.99992 6.61663C8.90916 6.61663 8.02492 7.50087 8.02492 8.59163C8.02492 9.68239 8.90916 10.5667 9.99992 10.5667C11.0907 10.5667 11.9749 9.68239 11.9749 8.59163C11.9749 7.50087 11.0907 6.61663 9.99992 6.61663ZM6.77492 8.59163C6.77492 6.81051 8.21881 5.36663 9.99992 5.36663C11.781 5.36663 13.2249 6.81051 13.2249 8.59163C13.2249 10.3728 11.781 11.8167 9.99992 11.8167C8.21881 11.8167 6.77492 10.3728 6.77492 8.59163Z\" fill-rule=\"evenodd\" clip-rule=\"evenodd\" fill=\"currentColor\"/></svg>",
            clock: "<svg aria-hidden=\"true\" focusable=\"false\" data-icon=\"ic_clock-outline\" viewBox=\"0 0 20 20\" fill=\"none\"><path d=\"M9.72865 6.04408C10.0933 6.04427 10.3892 6.33994 10.3892 6.70462V9.71402C10.3893 9.80308 10.4246 9.94758 10.513 10.1028C10.6017 10.2581 10.708 10.3621 10.784 10.4072L10.7865 10.409L10.7883 10.4098L13.0614 11.7662C13.3746 11.9531 13.4772 12.3595 13.2902 12.6727C13.1032 12.9856 12.6977 13.0874 12.3846 12.9006L10.1105 11.5443C9.83078 11.3783 9.60151 11.1308 9.43364 10.87L9.36569 10.7573C9.19401 10.4563 9.06825 10.0872 9.06811 9.71402V6.70462C9.06811 6.33982 9.36384 6.04408 9.72865 6.04408Z\" fill=\"currentColor\"/><path d=\"M9.99957 2C14.4156 2 17.9998 5.58359 18 9.99957C17.9999 14.4156 14.4156 18 9.99957 18C5.58368 17.9999 2.00012 14.4155 2 9.99957C2.00015 5.58368 5.5837 2.00014 9.99957 2ZM9.99957 3.32108C6.31331 3.32122 3.32123 6.31329 3.32108 9.99957C3.32119 13.6859 6.31329 16.6788 9.99957 16.6789C13.686 16.6789 16.6788 13.686 16.6789 9.99957C16.6788 6.31321 13.686 3.32108 9.99957 3.32108Z\" fill-rule=\"evenodd\" clip-rule=\"evenodd\" fill=\"currentColor\"/></svg>", caret: "<svg aria-hidden=\"true\" focusable=\"false\" data-icon=\"ic_caret-down-outline\" viewBox=\"0 0 20 20\" fill=\"none\"><path d=\"M16.0006 5.95728C16.2657 5.95733 16.5198 6.0625 16.7073 6.24999C16.8947 6.43747 16.9999 6.69157 17 6.95673C17 7.22196 16.8948 7.47688 16.7073 7.66443L16.6957 7.67598H16.6938L10.7067 13.664C10.614 13.757 10.5036 13.8313 10.3823 13.8816C10.2609 13.9321 10.1305 13.9577 9.99904 13.9577C9.86783 13.9577 9.73799 13.9319 9.61678 13.8816C9.49536 13.8313 9.38504 13.757 9.2923 13.664L3.29271 7.66443C3.10524 7.47689 3 7.22285 3 6.95769C3.00001 6.69251 3.10523 6.43848 3.29271 6.25095C3.4802 6.06345 3.7343 5.95734 3.99945 5.95728C4.26469 5.95728 4.5196 6.06339 4.70715 6.25095L9.99904 11.5428L15.2928 6.24999C15.4804 6.06243 15.7353 5.95728 16.0006 5.95728Z\" fill=\"currentColor\"/></svg>" };

  /* ── App-wide defaults (override with ShineSearch.configure or window.ShineSearchConfig) ── */
  var DEFAULTS = {
    roles: ['Software Engineer','Senior Software Engineer','Product Manager','Senior Product Manager','Product Designer',
      'UX Designer','UI Designer','Data Analyst','Data Scientist','DevOps Engineer','Frontend Developer','Backend Developer',
      'Full Stack Developer','Marketing Manager','Sales Executive','HR Manager','Business Analyst','Project Manager',
      'QA Engineer','Mobile App Developer','Cloud Engineer','Engineering Manager'],
    locations: ['Bangalore','Mumbai','Delhi NCR','Hyderabad','Chennai','Pune','Kolkata','Ahmedabad','Gurgaon','Noida',
      'Jaipur','Indore','Remote','Hybrid','Work From Home'],
    experienceOptions: ['Fresher','0–1 years','1–3 years','3–5 years','5–7 years','7–10 years','10–15 years','15+ years'],
    minChars: 2,                       // letters before the role / city suggestions open
    eyebrow: 'Find your next role',
    title: "What's next for", titleAccent: 'you?',
    submitLabel: 'Search Jobs',
    errorText: 'Add a role, city or experience to search.',
    placeholders: { keyword: 'Job title, skill, or keyword', location: 'Location', experience: 'Experience' },
    resultsUrl: null, toast: true, autofocus: true,
    onSubmit: null, onOpen: null, onClose: null
  };
  var cfg = merge({}, DEFAULTS, global.ShineSearchConfig || {});
  var session = cfg;
  var root, card, dialog, els = {}, dd = {}, lastFocus = null, closeTimer = null;

  function merge(t) {
    for (var i = 1; i < arguments.length; i++) {
      var s = arguments[i]; if (!s) continue;
      for (var k in s) if (Object.prototype.hasOwnProperty.call(s, k)) t[k] = (k === 'placeholders' && t[k]) ? merge({}, t[k], s[k]) : s[k];
    }
    return t;
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]; }); }
  function emit(name, detail, cancelable) {
    var ev;
    try { ev = new CustomEvent(name, { detail: detail, cancelable: !!cancelable }); }
    catch (e) { ev = doc.createEvent('CustomEvent'); ev.initCustomEvent(name, false, !!cancelable, detail); }
    doc.dispatchEvent(ev);
    return ev;
  }
  function list(v) { return (Array.isArray(v) ? v : String(v || '').split(',')).map(function (s) { return String(s).trim(); }).filter(Boolean); }

  /* ── Markup — injected once, on first use ─────────────────────────── */
  function field(name, icon, label, extra) {     // input fields · field-base · Small (40) · leading icon
    return '<div class="field field--sm" data-ssm-field="' + name + '">' +
      '<label class="field-label field-label--hidden" for="ssm-in-' + name + '">' + label + '</label>' +
      '<div class="field-control"><span class="field-icon" aria-hidden="true">' + icon + '</span>' +
      '<input class="field-input" id="ssm-in-' + name + '" type="text" autocomplete="off" spellcheck="false"' + (extra || '') + '>' +
      (name === 'experience' ? '<span class="field-trailing" aria-hidden="true">' + I.caret + '</span>' : '') +
      '</div></div>';
  }
  function mount() {
    if (root) return;
    root = doc.createElement('div');
    root.className = 'ssm';
    root.setAttribute('aria-hidden', 'true');
    root.innerHTML =
      '<div class="ssm-dialog" role="dialog" aria-modal="true" aria-labelledby="ssm-title"><div class="ssm-card">' +
        '<button class="btn btn--muted btn--sm btn--icon btn--pill ssm-close" type="button" aria-label="Close search">' + I.close + '</button>' +
        '<p class="ssm-eyebrow"><span class="badge badge--sm badge--brand"><span class="badge-dot" aria-hidden="true"></span><span data-ssm="eyebrow"></span></span></p>' +
        '<h2 class="ssm-title" id="ssm-title"></h2>' +
        '<div class="ssm-form" role="search"><div class="ssm-fields">' +
          field('keyword', I.search, 'Job title, skill, or keyword', ' autocapitalize="words" enterkeyhint="search"') +
          field('location', I.pin, 'Location', ' autocapitalize="words" enterkeyhint="search"') +
          field('experience', I.clock, 'Experience', ' readonly') +
        '</div>' +
        '<div class="ssm-alert" hidden></div>' +
        '<button class="btn btn--primary btn--accent btn--lg btn--block ssm-submit" type="button">' + I.search + '<span data-ssm="submit"></span></button>' +
        '</div>' +
      '</div></div>';
    doc.body.appendChild(root);
    card = root.querySelector('.ssm-card'); dialog = root.querySelector('.ssm-dialog');
    els = {
      close: root.querySelector('.ssm-close'), eyebrow: root.querySelector('[data-ssm="eyebrow"]'), title: root.querySelector('.ssm-title'),
      keyword: root.querySelector('#ssm-in-keyword'), location: root.querySelector('#ssm-in-location'), experience: root.querySelector('#ssm-in-experience'),
      alert: root.querySelector('.ssm-alert'), submit: root.querySelector('.ssm-submit'), submitText: root.querySelector('[data-ssm="submit"]')
    };
    if (global.ShineField && global.ShineField.init) global.ShineField.init(root);
    wire();
  }

  /* ── Behaviour ────────────────────────────────────────────────────── */
  function showError() {
    els.alert.innerHTML = global.ShineAlert ? global.ShineAlert.html({ intent: 'negative', text: session.errorText, live: true }) : '';
    els.alert.hidden = false;
    dialog.classList.remove('is-shaking'); void dialog.offsetWidth; dialog.classList.add('is-shaking');
    setTimeout(function () { dialog.classList.remove('is-shaking'); }, 400);
  }
  function hideError() { if (!els.alert.hidden) { els.alert.hidden = true; els.alert.innerHTML = ''; } }
  function anyOpen() { return Object.keys(dd).some(function (k) { return dd[k] && dd[k].isOpen(); }); }
  function closeLists() { Object.keys(dd).forEach(function (k) { if (dd[k]) dd[k].close(); }); }
  function opts(arr, icon) { return arr.map(function (o) { return { value: o, label: o, icon: icon }; }); }

  function dropdowns() {                       // inline dropdown component — one per field
    if (!global.ShineDropdown) { if (global.console) console.warn('ShineSearch: inline-dropdown.js is missing'); return; }
    ['keyword', 'location'].forEach(function (name) {
      dd[name] = global.ShineDropdown.create({
        input: els[name], mode: 'search', size: 'sm',
        options: opts(name === 'keyword' ? session.roles : session.locations, name === 'keyword' ? I.search : I.pin),
        minChars: session.minChars, openOnFocus: false,          // suggestions once they type (a tap shows the list)
        free: 'Use “{q}”', label: name === 'keyword' ? 'Job title, skill, or keyword' : 'Location',
        onPick: function () { hideError(); }
      });
    });
    dd.experience = global.ShineDropdown.create({
      input: els.experience, mode: 'select', size: 'sm', heading: 'Total experience',
      options: opts(session.experienceOptions, I.clock), label: 'Experience',
      onPick: function () { hideError(); }
    });
  }
  function wire() {
    dropdowns();
    ['keyword', 'location'].forEach(function (name) {
      els[name].addEventListener('input', hideError);
      els[name].addEventListener('keydown', function (e) {        // after the list's own keys: Enter with no list open = Search
        if (e.key === 'Enter' && !e.defaultPrevented && !(dd[name] && dd[name].isOpen())) { e.preventDefault(); submit(); }
      });
      els[name].addEventListener('blur', function () { var v = els[name].value, t = v.replace(/(?:,\s*)+$/, '').trim(); if (t !== v) els[name].value = t; });   // trailing commas go
    });
    els.close.addEventListener('click', function () { close('close-button'); });
    els.submit.addEventListener('click', submit);
    root.addEventListener('keydown', trapFocus);
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && isOpen() && !anyOpen()) close('escape'); });
    // backdrop tap does NOT close — users lose typed input too easily on mobile (✕ or Escape close it)
  }
  function trapFocus(e) {
    if (e.key !== 'Tab') return;
    var f = Array.prototype.filter.call(card.querySelectorAll('button:not([tabindex="-1"]), input'), function (el) { return el.offsetParent !== null; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  function expValue() { var v = (els.experience.value || '').trim(); return session.experienceOptions.indexOf(v) > -1 ? v : ''; }
  function setExperience(v) {
    v = v && session.experienceOptions.indexOf(v) > -1 ? v : '';
    els.experience.value = v;
    if (dd.experience) dd.experience.value(v || null);
  }

  /* ── Submit ───────────────────────────────────────────────────────── */
  function submit() {
    var keywords = list(els.keyword.value), locations = list(els.location.value), exp = expValue();
    if (!keywords.length && !locations.length && !exp) { closeLists(); showError(); els.keyword.focus(); return; }
    var detail = { keywords: keywords, locations: locations, experience: exp, query: keywords.join(', '), location: locations.join(', '),
                   mode: root.getAttribute('data-mode'), source: root.getAttribute('data-source') || '' };
    if (typeof session.onSubmit === 'function') {
      if (session.onSubmit(detail) === false) return;
      close('submit'); emit('shine:search', detail, false); return;
    }
    var ev = emit('shine:search', detail, true);
    close('submit');
    if (ev.defaultPrevented) return;
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
  function toast(msg, tone) {                  // notify component (the page's) — the one toast in the app
    if (global.ShineNotify) return global.ShineNotify.toast(msg, { tone: tone || 'neutral' });
  }

  /* ── Status bar (v2.0.1) ──────────────────────────────────────────────
     iOS 26 paints the status bar from html / body's background-color or from a fixed, full-width box at the top
     edge — never from the scrim's image layer. While the modal is open: html + body take the page colour dimmed by
     the scrim, and a strip (.ssm-statusbar) on top carries the same colour (Safari re-reads it live; the Android
     app's bar sampler reads it too). Restored the moment the modal closes. Same technique as bottom-sheet. */
  var bar = null, tintSaved = null;
  function rgba(c) { var m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?/.exec(c || ''); return m ? [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]] : null; }
  function tint(on) {
    var r = doc.documentElement, b = doc.body; if (!b) return;
    if (!bar) { bar = doc.createElement('div'); bar.className = 'ssm-statusbar'; bar.setAttribute('aria-hidden', 'true'); b.appendChild(bar); }
    if (!on) {
      if (tintSaved) { r.style.backgroundColor = tintSaved[0]; b.style.backgroundColor = tintSaved[1]; tintSaved = null; }
      bar.classList.remove('is-on'); return;
    }
    if (!tintSaved) tintSaved = [r.style.backgroundColor, b.style.backgroundColor];
    var base = rgba(getComputedStyle(b).backgroundColor);
    if (!base || base[3] < 0.5) base = rgba(getComputedStyle(r).backgroundColor);
    if (!base || base[3] < 0.5) base = [250, 249, 246, 1];                       // surface.neutral.base
    var sc = rgba(getComputedStyle(root).getPropertyValue('--ssm-surface-scrim')) || [13, 17, 23, 0.55];
    var css = 'rgb(' + [0, 1, 2].map(function (k) { return Math.round(sc[k] * sc[3] + base[k] * (1 - sc[3])); }).join(',') + ')';
    r.style.backgroundColor = css; b.style.backgroundColor = css;
    bar.style.backgroundColor = css; bar.classList.add('is-on');
  }

  /* ── Public API ───────────────────────────────────────────────────── */
  function isOpen() { return !!root && root.classList.contains('is-open'); }
  function open(o) {
    o = o || {};
    mount();
    clearTimeout(closeTimer);
    var x = {};
    for (var k in o) if (['keyword','location','experience','mode','source','trigger'].indexOf(k) < 0) x[k] = o[k];
    session = merge({}, cfg, x);
    root.setAttribute('data-mode', o.mode === 'edit' ? 'edit' : 'new');
    root.setAttribute('data-source', o.source || '');
    els.eyebrow.textContent = session.eyebrow;
    els.title.innerHTML = esc(session.title) + (session.titleAccent ? ' <span class="ssm-accent">' + esc(session.titleAccent) + '</span>' : '');
    els.submitText.textContent = session.submitLabel;
    els.keyword.placeholder = session.placeholders.keyword;
    els.location.placeholder = session.placeholders.location;
    els.experience.placeholder = session.placeholders.experience;
    if (dd.keyword) { dd.keyword.options(opts(session.roles, I.search)); dd.location.options(opts(session.locations, I.pin)); dd.experience.options(opts(session.experienceOptions, I.clock)); }
    closeLists(); hideError(); dialog.classList.remove('is-shaking');
    els.keyword.value = list(o.keyword).join(', ');
    els.location.value = list(o.location).join(', ');
    setExperience(o.experience);
    lastFocus = o.trigger || doc.activeElement;
    doc.documentElement.classList.add('ssm-lock');
    tint(true);
    root.setAttribute('aria-hidden', 'false');
    root.classList.add('is-mounted');
    void root.offsetWidth;
    root.classList.add('is-open');
    if (session.autofocus) setTimeout(function () { if (isOpen()) els.keyword.focus(); }, 320);
    if (typeof session.onOpen === 'function') session.onOpen({ mode: root.getAttribute('data-mode'), source: o.source || '' });
    emit('shine:search-open', { mode: root.getAttribute('data-mode'), source: o.source || '' });
  }
  function close(reason) {
    if (!isOpen()) return;
    closeLists();
    root.classList.remove('is-open');
    root.setAttribute('aria-hidden', 'true');
    doc.documentElement.classList.remove('ssm-lock');
    tint(false);
    if (doc.activeElement && root.contains(doc.activeElement)) doc.activeElement.blur();
    closeTimer = setTimeout(function () { root.classList.remove('is-mounted'); }, 260);
    if (lastFocus && lastFocus.focus && doc.contains(lastFocus)) { try { lastFocus.focus({ preventScroll: true }); } catch (e) {} }
    if (typeof session.onClose === 'function') session.onClose({ reason: reason || 'api' });
    emit('shine:search-close', { reason: reason || 'api' });
  }
  function configure(o) { cfg = merge(cfg, o || {}); if (!isOpen()) session = cfg; return cfg; }

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
    open({ mode: mode === 'edit' || mode === 'new' ? mode : undefined,
      keyword: d.ssmKeyword || readFrom(d.ssmKeywordFrom), location: d.ssmLocation || readFrom(d.ssmLocationFrom),
      experience: d.ssmExperience || readFrom(d.ssmExperienceFrom), source: d.ssmSource || '', trigger: t });
  });

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', mount); else mount();

  global.ShineSearch = { open: open, close: close, configure: configure, isOpen: isOpen, toast: toast, version: '2.0.1' };
  if (typeof global.openSearchOverlay !== 'function') {
    global.openSearchOverlay = function (prefill) { open(prefill ? merge({ mode: 'edit', source: 'jsrp' }, prefill) : {}); };
  }
})(window);
