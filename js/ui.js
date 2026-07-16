// Shared UI primitives loaded on every page: a single app-wide isMobile()
// (deduped from the per-page copies) and themed, promise-based confirm/alert
// dialogs that replace the native window.confirm/alert (unstyled, blocking,
// and poor for assistive tech).
(function () {
  'use strict';

  // App-wide "is this a phone-sized / touch device" check — used for
  // popup-vs-navigate and pop-out decisions. NOTE: layout.js has a separate,
  // intentionally different breakpoint (isNarrowLayout, <=600) for grid column
  // count; the two answer different questions and should not be merged.
  window.isMobile = function () {
    return window.innerWidth < 768 || 'ontouchstart' in window;
  };

  // ── Styles (injected once; uses tokens.css variables with fallbacks) ──────
  var STYLE = [
    '.qb-dialog-overlay{position:fixed;inset:0;z-index:1000;display:flex;',
    'align-items:center;justify-content:center;padding:20px;',
    'background:rgba(0,0,0,.45);animation:qb-dialog-fade .12s ease-out}',
    '.qb-dialog{background:var(--color-surface,#fff);color:var(--color-text,#222);',
    'border:1px solid var(--color-border-strong,#ccc);border-radius:var(--radius-md,10px);',
    'box-shadow:0 10px 40px rgba(0,0,0,.25);max-width:340px;width:100%;',
    'padding:20px;font-family:inherit;animation:qb-dialog-pop .12s ease-out}',
    '.qb-dialog-msg{font-size:15px;line-height:1.5;margin:0 0 18px;white-space:pre-wrap}',
    '.qb-dialog-actions{display:flex;gap:8px;justify-content:flex-end}',
    '.qb-dialog-btn{font-family:inherit;font-size:14px;font-weight:600;cursor:pointer;',
    'padding:8px 16px;border-radius:var(--radius-sm,6px);border:1px solid transparent;',
    'transition:background .12s,border-color .12s,color .12s}',
    '.qb-dialog-btn:focus-visible{outline:2px solid var(--color-primary,#f96302);outline-offset:2px}',
    '.qb-dialog-btn.secondary{background:transparent;color:var(--color-text,#222);',
    'border-color:var(--color-border-strong,#ccc)}',
    '.qb-dialog-btn.secondary:hover{border-color:var(--color-text-secondary,#666)}',
    '.qb-dialog-btn.primary{background:var(--color-primary,#f96302);color:#fff}',
    '.qb-dialog-btn.primary:hover{background:var(--color-primary-dark,#d94f00)}',
    '.qb-dialog-btn.danger{background:var(--color-danger,#c62828);color:#fff}',
    '.qb-dialog-btn.danger:hover{filter:brightness(.92)}',
    '@keyframes qb-dialog-fade{from{opacity:0}to{opacity:1}}',
    '@keyframes qb-dialog-pop{from{opacity:0;transform:translateY(6px) scale(.98)}',
    'to{opacity:1;transform:none}}',
  ].join('');

  var stylesInjected = false;
  function ensureStyles() {
    if (stylesInjected) return;
    var el = document.createElement('style');
    el.textContent = STYLE;
    document.head.appendChild(el);
    stylesInjected = true;
  }

  // Core builder. `buttons` is an array of { text, value, variant, primary }.
  // Returns a promise resolving to the chosen button's `value`.
  function openDialog(message, buttons) {
    ensureStyles();
    return new Promise(function (resolve) {
      var prevFocus = document.activeElement;

      var overlay = document.createElement('div');
      overlay.className = 'qb-dialog-overlay';

      var dialog = document.createElement('div');
      dialog.className = 'qb-dialog';
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-modal', 'true');

      var msg = document.createElement('p');
      msg.className = 'qb-dialog-msg';
      msg.textContent = message;
      dialog.appendChild(msg);

      var actions = document.createElement('div');
      actions.className = 'qb-dialog-actions';

      function close(value) {
        document.removeEventListener('keydown', onKey, true);
        overlay.remove();
        if (prevFocus && prevFocus.focus) { try { prevFocus.focus(); } catch (_) {} }
        resolve(value);
      }

      var focusables = [];
      buttons.forEach(function (b) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'qb-dialog-btn ' + (b.variant || 'secondary');
        btn.textContent = b.text;
        btn.addEventListener('click', function () { close(b.value); });
        actions.appendChild(btn);
        focusables.push(btn);
        if (b.primary) btn._qbPrimary = true;
      });
      dialog.appendChild(actions);
      overlay.appendChild(dialog);

      // Escape cancels (resolves the first/cancel button's value); Tab is
      // trapped between the dialog's buttons.
      function onKey(e) {
        if (e.key === 'Escape') { e.preventDefault(); close(buttons[0].value); }
        else if (e.key === 'Tab' && focusables.length) {
          var first = focusables[0], last = focusables[focusables.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      }
      // Clicking the backdrop cancels.
      overlay.addEventListener('mousedown', function (e) {
        if (e.target === overlay) close(buttons[0].value);
      });
      document.addEventListener('keydown', onKey, true);

      document.body.appendChild(overlay);
      var toFocus = focusables.find(function (b) { return b._qbPrimary; }) || focusables[0];
      if (toFocus) toFocus.focus();
    });
  }

  // Promise<boolean>. opts: { confirmText, cancelText, danger }.
  window.confirmDialog = function (message, opts) {
    opts = opts || {};
    return openDialog(message, [
      { text: opts.cancelText || 'Cancel', value: false, variant: 'secondary' },
      { text: opts.confirmText || 'OK', value: true,
        variant: opts.danger ? 'danger' : 'primary',
        // Focus the safe choice by default for destructive prompts.
        primary: !opts.danger },
    ]);
  };

  // Promise<void>. A single acknowledge button.
  window.alertDialog = function (message, opts) {
    opts = opts || {};
    return openDialog(message, [
      { text: opts.okText || 'OK', value: undefined, variant: 'primary', primary: true },
    ]).then(function () {});
  };
})();
