/* ═══════════════════════════════════════════════════════════════════════
   SHINE · INPUT FIELDS · FIELD BASE  (app component · App-login · atoms/input-fields/)      v3.3.0
   Pair with field-base.css. The shared engine under the five components — load it FIRST, then the script of each
   component the page uses: normal-field.js · password-field.js · otp-field.js · combo-box.js · multi-input.js.
   No dependencies (combo-box.js also uses the bottom sheet for its sheet mode).

   One way to write any field:  <div class="field field--md" data-field="email"> … </div>
     data-field   text · email · phone · email phone (either) · amount (v3.3.0)   → normal-field.js
                  password (data-password="current | new | confirm")  → password-field.js
                  otp      (maxlength 6 | 4 on the input)        → otp-field.js
                  combo    (data-combo="inline | sheet | auto")   → combo-box.js
                  date · experience  (a <fieldset>)              → multi-input.js

   What every field shares:
     Messages     ShineField.set(input | field, 'invalid' | 'valid' | 'helper' | 'positive' | null, text) — the one slot under the
                  field: icon + text, aria-invalid, aria-describedby; text may hold one link ("Register instead")
     The API      ShineField.get(field | input) → the component's api: { el, input, type, value(), set(v), clear(),
                  check(submit) → '' or the error text }
     Submit       ShineField.validate(form | any element) → true / false: checks every field inside, shows each
                  error, puts the caret in the first one. Empty fields are an error only when the input is
                  `required` ("Enter your <label>", or data-error-empty).
     Tap focus    a tap anywhere on a box (padding, +91, a unit) puts the caret in its field
     Caret        (v3.1.0) focusing a field never selects its text: the caret goes after the last character, thin and
                  in the focus colour (--fld-caret). A tap in a field that already has the caret moves it as usual.
     Wiring       fields are wired on load; ShineField.init(root) wires fields a page adds later
   Events (bubble from the field): `shine:field` { type, value, valid } — every component sends it when its value
   changes; some send their own as well (shine:otp-complete, shine:combo).
   ═══════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  if (global.ShineField) return;
  var doc = global.document, IC = {"ic_alert-solid": "<svg aria-hidden=\"true\" focusable=\"false\" data-icon=\"ic_alert-solid\" viewBox=\"0 0 20 20\" fill=\"none\"><path d=\"M17.9912 9.47563L17.8548 8.43679L17.7358 7.92607L17.5839 7.42449L17.183 6.45704L16.9359 5.99483L16.3538 5.12348L16.0215 4.71893L15.2802 3.97755L14.8756 3.6453L14.0043 3.06319L13.542 2.81606L12.5746 2.41517L12.073 2.26323L11.0452 2.05912L9.99991 1.99048L9.47637 2.00787L8.43752 2.14425L7.9268 2.26323L7.42522 2.41517L6.45777 2.81606L5.55073 3.34052L5.12421 3.6453L4.71966 3.97755L3.97828 4.71893L3.64604 5.12348L3.06392 5.99483L2.81679 6.45704L2.4159 7.42449L2.26396 7.92607L2.05986 8.95392L1.99121 9.99917L2.0086 10.5227L2.14498 11.5616L2.26396 12.0723L2.4159 12.5739L2.81679 13.5413L3.34125 14.4483L3.64604 14.8749L3.97828 15.2794L4.71966 16.0208L5.55073 16.6578L5.99556 16.9352L6.45777 17.1823L7.42522 17.5832L8.43752 17.8541L8.95466 17.9392L9.47637 17.9905H10.5234L11.5623 17.8541L12.073 17.7351L13.0643 17.3983L13.542 17.1823L14.0043 16.9352L14.8756 16.353L15.2802 16.0208L16.0215 15.2794L16.6586 14.4483L16.9359 14.0035L17.183 13.5413L17.5839 12.5739L17.8548 11.5616L17.94 11.0444L18.0086 9.99917L17.9912 9.47563ZM9.17615 10.8229L9.19171 5.81085L9.31528 5.5143L9.54227 5.28732L9.83882 5.16375H10.161L10.4575 5.28732L10.582 5.38983L10.6845 5.5143L10.8081 5.81085V10.984L10.7605 11.1378L10.582 11.405L10.3148 11.5835L9.99991 11.6467L9.68505 11.5835L9.41779 11.405L9.23931 11.1378L9.17615 10.8229ZM10.9609 13.7518L10.8877 14.1198L10.679 14.431L10.3678 14.6396L9.99991 14.7129L9.63196 14.6396L9.32077 14.431L9.11208 14.1198L9.03886 13.7518L9.11208 13.3839L9.32077 13.0727L9.63196 12.864L9.99991 12.7908L10.3678 12.864L10.679 13.0727L10.8877 13.3839L10.9609 13.7518Z\" fill-rule=\"evenodd\" clip-rule=\"evenodd\" fill=\"currentColor\"/></svg>", "ic_check-circle-solid": "<svg aria-hidden=\"true\" focusable=\"false\" data-icon=\"ic_check-circle-solid\" viewBox=\"0 0 20 20\" fill=\"none\"><path d=\"M18 9.48516L17.8636 8.44631L17.7446 7.93559L17.5927 7.43401L17.1918 6.46656L16.9447 6.00435L16.3626 5.133L16.0303 4.72845L15.2889 3.98707L14.8844 3.65483L14.013 3.07271L13.5508 2.82558L12.5834 2.42469L12.0818 2.27275L11.0539 2.06865L10.0087 2L9.48516 2.01739L8.44631 2.15377L7.93559 2.27275L7.43401 2.42469L6.46656 2.82558L5.55952 3.35004L5.133 3.65483L4.72845 3.98707L3.98707 4.72845L3.65483 5.133L3.07271 6.00435L2.82558 6.46656L2.42469 7.43401L2.27275 7.93559L2.06865 8.96345L2 10.0087L2.01739 10.5322L2.15377 11.5711L2.27275 12.0818L2.42469 12.5834L2.82558 13.5508L3.35004 14.4579L3.65483 14.8844L3.98707 15.2889L4.72845 16.0303L5.55952 16.6674L6.00435 16.9447L6.46656 17.1918L7.43401 17.5927L8.44631 17.8636L8.96345 17.9487L9.48516 18H10.5322L11.5711 17.8636L12.0818 17.7446L13.073 17.4078L13.5508 17.1918L14.013 16.9447L14.8844 16.3626L15.2889 16.0303L16.0303 15.2889L16.6674 14.4579L16.9447 14.013L17.1918 13.5508L17.5927 12.5834L17.8636 11.5711L17.9487 11.0539L18.0174 10.0087L18 9.48516ZM8.41336 13.2149L5.85058 10.7016L5.72427 10.4059L5.70688 10.2458L5.76637 9.92998L5.84143 9.78628L6.06659 9.55746L6.36222 9.43115L6.68348 9.42841L6.98187 9.54831L7.10726 9.64899L8.85636 11.3633L13.0712 7.12923L13.3678 7.00475L13.689 7.00292L13.9865 7.12465L14.1119 7.22716L14.2922 7.49351L14.3398 7.64727L14.3416 7.96854L14.2949 8.12322L14.1174 8.3914L9.44946 13.1051L9.18494 13.2845L9.03118 13.3321L8.71083 13.3348L8.41336 13.2149Z\" fill-rule=\"evenodd\" clip-rule=\"evenodd\" fill=\"currentColor\"/></svg>"}, uid = 0, types = {};

  function fieldOf(el) { return el && el.closest ? el.closest('.field[data-field], .field') : null; }
  function idOf(el, pre) { if (!el.id) el.id = (pre || 'fld') + '-' + (++uid); return el.id; }
  function describe(input, id, on) {
    var ids = (input.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean), i = ids.indexOf(id);
    if (on && i < 0) ids.unshift(id); if (!on && i >= 0) ids.splice(i, 1);
    if (ids.length) input.setAttribute('aria-describedby', ids.join(' ')); else input.removeAttribute('aria-describedby');
  }
  function inputsOf(f) { return [].slice.call(f.querySelectorAll('.field-input, .field-otp-input')).filter(function (i) { return fieldOf(i) === f; }); }
  function slot(f) {                                       // the one message slot under the box (helper or message)
    var m = f.querySelector(':scope > .field-message, :scope > .field-helper');
    if (!m) {
      m = doc.createElement('p'); m.className = 'field-message'; m.hidden = true;
      var after = f.querySelector(':scope > .field-control, :scope > .field-otp-wrap, :scope > .field-multi-boxes');
      if (after && after.nextSibling) f.insertBefore(m, after.nextSibling); else f.appendChild(m);
    }
    idOf(m, 'fld-msg'); return m;
  }

  /* ── messages ─────────────────────────────────────────────────────── */
  function set(target, state, html) {
    var f = target.classList && target.classList.contains('field') ? target : fieldOf(target); if (!f) return;
    var ins = target === f ? inputsOf(f) : [target], m = slot(f);
    f.classList.toggle('field--invalid', state === 'invalid');
    f.classList.toggle('field--valid', state === 'valid');
    ins.forEach(function (i) { if (state === 'invalid') i.setAttribute('aria-invalid', 'true'); else i.removeAttribute('aria-invalid'); });
    if ((state === 'invalid' || state === 'valid') && html) {
      m.className = 'field-message'; m.innerHTML = (state === 'valid' ? IC['ic_check-circle-solid'] : IC['ic_alert-solid']) + '<span>' + html + '</span>';
      m.hidden = false; m.setAttribute('role', state === 'invalid' ? 'alert' : 'status');
    } else if ((state === 'helper' || state === 'positive') && html) {      // v3.3.0 · 'positive' = the helper in the positive colour
      m.className = state === 'positive' ? 'field-helper field-helper--positive' : 'field-helper'; m.innerHTML = html; m.hidden = false; m.removeAttribute('role');
    } else { m.hidden = true; m.innerHTML = ''; m.removeAttribute('role'); }
    ins.forEach(function (i) { describe(i, m.id, !m.hidden); });
  }
  function isInvalid(el) { var f = fieldOf(el); return !!f && f.classList.contains('field--invalid'); }

  /* the field's name, for "Enter your …" — the label (or legend) without its * / (optional) */
  function nameOf(f) {
    var l = f.querySelector(':scope > .field-label'); if (!l) return 'this';
    var c = l.cloneNode(true); [].forEach.call(c.querySelectorAll('.required, .optional'), function (x) { x.remove(); });
    var t = c.textContent.replace(/\s+/g, ' ').trim(); return t ? t.charAt(0).toLowerCase() + t.slice(1) : 'this';
  }
  function emptyText(f) { return f.getAttribute('data-error-empty') || 'Enter your ' + nameOf(f); }
  function required(f) { return inputsOf(f).some(function (i) { return i.required || i.getAttribute('aria-required') === 'true'; }) || f.hasAttribute('data-required'); }
  function emit(f, name, detail) { try { f.dispatchEvent(new CustomEvent(name, { bubbles: true, detail: detail })); } catch (e) {} }

  // a tap anywhere on a box (padding, +91, a unit) puts the caret in its field
  doc.addEventListener('click', function (e) {
    var c = e.target.closest && e.target.closest('.field-control'); if (!c || e.target.closest('button, a, input')) return;
    var i = c.querySelector('.field-input'); if (i && !i.disabled) i.focus();
  });

  /* v3.1.0 · caret at the end (user: "the whole value got selected … too bold on the user's face"). Focusing a field — a
     tap, Tab, a script — never selects its text: the caret lands after the last character. Whoever selected it on focus
     (a browser, a component, iOS placing the caret at the tap) is overruled once, right after the focus settles; a tap
     inside a field that ALREADY has the caret is left alone, so people can still place it mid-word to fix a letter. */
  function caretEnd(i) {
    if (doc.activeElement !== i || i.readOnly) return;
    var n = i.value.length; if (!n) return;
    try { if (i.selectionStart !== n || i.selectionEnd !== n) i.setSelectionRange(n, n); } catch (e) { return; }   // email / number inputs have no selection API
    i.scrollLeft = i.scrollWidth;                          // a long value shows its end
  }
  function isFieldInput(t) { return t && t.classList && t.classList.contains('field-input') && t.tagName !== 'SELECT'; }
  var justFocused = null;
  doc.addEventListener('focusin', function (e) {
    var i = e.target; if (!isFieldInput(i)) return;
    justFocused = i; setTimeout(function () { caretEnd(i); }, 0);
    setTimeout(function () { if (justFocused === i) justFocused = null; }, 700);
  });
  // iOS / Android place the caret at the finger AFTER focus (on touchend / mouseup) — put it back at the end, once
  ['mouseup', 'touchend'].forEach(function (n) {
    doc.addEventListener(n, function (e) {
      var i = e.target && e.target.closest && e.target.closest('.field-input');
      if (i && i === justFocused) setTimeout(function () { caretEnd(i); justFocused = null; }, 0);
    }, true);
  });

  /* ── components register here; every .field[data-field] is wired once ── */
  function tokenOf(f) { return (f.getAttribute('data-field') || '').trim().split(/\s+/)[0]; }
  function wire(f) {
    if (f.__fld) return f.__fld;
    var t = types[tokenOf(f)]; if (!t) return null;
    var api = t(f) || {}; api.el = f; api.type = api.type || tokenOf(f);
    if (!api.input) api.input = inputsOf(f)[0] || null;
    f.__fld = api; return api;
  }
  function init(root) {
    root = root || doc;
    if (root.matches && root.matches('.field[data-field]')) wire(root);
    [].forEach.call(root.querySelectorAll('.field[data-field]'), wire);
  }
  var ready = doc.readyState !== 'loading';
  function add(names, setup) {
    (Array.isArray(names) ? names : [names]).forEach(function (n) { types[n] = setup; });
    if (ready) init();
  }
  if (!ready) doc.addEventListener('DOMContentLoaded', function () { ready = true; init(); });
  function get(el) { var f = el && (el.__fld ? el : fieldOf(el)); return f ? (f.__fld || wire(f)) : null; }

  /* ── submit: check every field inside root ──────────────────────────── */
  function validate(root) {
    root = root || doc; var ok = true, first = null, list = [];
    if (root.matches && root.matches('.field[data-field]')) list.push(root);
    [].push.apply(list, root.querySelectorAll('.field[data-field]'));
    list.forEach(function (f) {
      var api = get(f); if (!api || !api.check) return;
      var ins = inputsOf(f); if (ins.length && ins.every(function (i) { return i.disabled; })) return;
      var msg = api.check(true);
      if (msg) { ok = false; if (api.showError) api.showError(msg); else set(f, 'invalid', msg); if (!first) first = api; }
    });
    if (first) { var t = first.focusTarget ? first.focusTarget() : first.input; if (t) try { t.focus(); } catch (e) {} }
    return ok;
  }

  global.ShineField = { version: '3.3.0', set: set, isInvalid: isInvalid, get: get, validate: validate, add: add, init: init,
    types: function () { return Object.keys(types); }, icons: IC,
    _: { fieldOf: fieldOf, idOf: idOf, describe: describe, inputsOf: inputsOf, emptyText: emptyText, nameOf: nameOf, required: required, emit: emit } };
})(window);
