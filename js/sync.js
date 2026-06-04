(function () {
  'use strict';

  const MANTLEDB  = 'https://mantledb.sh/v2/sticky-notes-share/';
  const SYNC_KEYS = [
    'sticky-notes',
    'sticky-links',
    'qb-layout',
    'sticky-todos',
    'sticky-pinned',
    'sticky-notes-view',
  ];

  function uuidToCode(hex) {
    return BigInt('0x' + hex).toString(36).toUpperCase().padStart(25, '0');
  }

  function codeToUuid(code) {
    const s = code.replace(/\s/g, '').toLowerCase();
    let n = 0n;
    for (const ch of s) n = n * 36n + BigInt(parseInt(ch, 36));
    return n.toString(16).padStart(32, '0');
  }

  function gatherAll() {
    const bundle = { v: 1, exported: new Date().toISOString() };
    for (const key of SYNC_KEYS) {
      const raw = localStorage.getItem(key);
      try { bundle[key] = raw !== null ? JSON.parse(raw) : null; }
      catch { bundle[key] = raw; }
    }
    return bundle;
  }

  function restoreAll(bundle) {
    for (const key of SYNC_KEYS) {
      if (bundle[key] != null) {
        localStorage.setItem(key, typeof bundle[key] === 'string'
          ? bundle[key]
          : JSON.stringify(bundle[key]));
      }
    }
  }

  // ── Export ───────────────────────────────────────────────────────────────

  async function generateSyncCode() {
    const codeEl  = document.getElementById('sync-share-code');
    const copyBtn = document.getElementById('sync-copy-btn');
    const qrEl    = document.getElementById('sync-qr');
    const genBtn  = document.getElementById('sync-gen-btn');

    genBtn.disabled = true;
    genBtn.textContent = 'Generating…';
    codeEl.textContent = '…';
    copyBtn.disabled = true;
    if (qrEl) qrEl.innerHTML = '';

    try {
      const id = crypto.randomUUID().replace(/-/g, '');
      await fetch(MANTLEDB + id, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gatherAll()),
      });
      const code = uuidToCode(id);
      const g = code.match(/.{5}/g);
      codeEl.textContent = g[0] + ' ' + g[1] + ' ' + g[2] + '\n' + g[3] + ' ' + g[4];
      copyBtn.disabled = false;
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(code).then(() => {
          copyBtn.textContent = 'Copied!';
          setTimeout(() => { copyBtn.textContent = 'Copy Code'; }, 2000);
        });
      };
      if (qrEl && typeof QRCode !== 'undefined') {
        const url = location.origin + location.pathname + '?sync-import=' + code;
        new QRCode(qrEl, { text: url, width: 160, height: 160,
          colorDark: '#000000', colorLight: '#ffffff' });
      }
    } catch {
      codeEl.textContent = 'Failed — check connection';
    } finally {
      genBtn.disabled = false;
      genBtn.textContent = 'Generate Code';
    }
  }

  // ── Import ───────────────────────────────────────────────────────────────

  function showImportError(msg) {
    const el = document.getElementById('sync-import-error');
    if (el) { el.textContent = msg; el.style.display = ''; }
  }

  function hideImportError() {
    const el = document.getElementById('sync-import-error');
    if (el) el.style.display = 'none';
  }

  function initImportInputs() {
    const container = document.getElementById('sync-import-inputs');
    const chunks = Array.from(container.querySelectorAll('.code-chunk'));

    function getCode() { return chunks.map(c => c.value).join(''); }

    function distributeCode(text, fromIndex) {
      const clean = text.replace(/[^0-9a-z]/gi, '').toLowerCase();
      const start = clean.length >= 25 ? 0 : fromIndex;
      let offset = 0;
      for (let i = start; i < chunks.length && offset < clean.length; i++) {
        chunks[i].value = clean.slice(offset, offset + 5);
        offset += 5;
      }
      const lastFilled = Math.min(start + Math.ceil(clean.length / 5) - 1, chunks.length - 1);
      chunks[lastFilled].focus();
      if (getCode().length >= 25) document.getElementById('sync-import-go').click();
    }

    chunks.forEach((input, i) => {
      input.addEventListener('input', () => {
        input.value = input.value.replace(/[^0-9a-z]/gi, '').toLowerCase();
        hideImportError();
        if (input.value.length === 5) {
          if (i < chunks.length - 1) chunks[i + 1].focus();
          else document.getElementById('sync-import-go').click();
        }
      });
      input.addEventListener('keydown', e => {
        if (e.key === 'Backspace' && input.value.length === 0 && i > 0) chunks[i - 1].focus();
        if (e.key === 'Enter') document.getElementById('sync-import-go').click();
        if (e.key === 'Escape') closeSyncModal();
      });
      input.addEventListener('paste', e => {
        e.preventDefault();
        distributeCode((e.clipboardData || window.clipboardData).getData('text'), i);
      });
    });

    document.getElementById('sync-import-go').addEventListener('click', async () => {
      const code = getCode();
      if (code.length < 25) return;
      const goBtn = document.getElementById('sync-import-go');
      goBtn.disabled = true;
      goBtn.textContent = 'Importing…';
      try {
        const uuid = codeToUuid(code);
        const res = await fetch(MANTLEDB + uuid);
        if (!res.ok) throw new Error('Not found');
        const bundle = await res.json();
        if (!bundle || typeof bundle !== 'object' || bundle.v !== 1) throw new Error('Invalid data');

        const noteCount = Array.isArray(bundle['sticky-notes'])  ? bundle['sticky-notes'].length  : 0;
        const linkCount = Array.isArray(bundle['sticky-links'])  ? bundle['sticky-links'].length  : 0;
        const todoCount = Array.isArray(bundle['sticky-todos'])  ? bundle['sticky-todos'].length  : 0;
        const exportedAt = bundle.exported
          ? new Date(bundle.exported).toLocaleString()
          : 'unknown time';

        if (!confirm(
          'Replace everything on this device with:\n' +
          '• ' + noteCount + ' note' + (noteCount !== 1 ? 's' : '') + '\n' +
          '• ' + linkCount + ' link' + (linkCount !== 1 ? 's' : '') + '\n' +
          '• ' + todoCount + ' to-do item' + (todoCount !== 1 ? 's' : '') + '\n\n' +
          'Exported: ' + exportedAt + '\n\n' +
          'This overwrites all current data. Continue?'
        )) return;

        restoreAll(bundle);
        location.reload();
      } catch {
        showImportError('Import failed — check the code and your connection.');
      } finally {
        goBtn.disabled = false;
        goBtn.textContent = 'Import All';
      }
    });
  }

  // ── Modal ────────────────────────────────────────────────────────────────

  function openSyncModal() {
    document.getElementById('sync-modal').style.display = 'flex';
  }

  function closeSyncModal() {
    document.getElementById('sync-modal').style.display = 'none';
  }

  const syncBtn = document.getElementById('btn-sync');
  syncBtn.innerHTML = icon('refresh', 14) + '<span class="btn-label"> Sync</span>';
  syncBtn.addEventListener('click', openSyncModal);

  document.getElementById('sync-close').addEventListener('click', closeSyncModal);
  document.getElementById('sync-gen-btn').addEventListener('click', generateSyncCode);
  document.getElementById('sync-modal').addEventListener('click', e => {
    if (e.target.id === 'sync-modal') closeSyncModal();
  });

  initImportInputs();

  // Handle ?sync-import= URL param (from QR code scan)
  (function () {
    const importCode = new URLSearchParams(location.search).get('sync-import');
    if (!importCode) return;
    const clean = importCode.replace(/\s/g, '');
    if (clean.length !== 25) return;
    openSyncModal();
    const chunks = Array.from(
      document.querySelectorAll('#sync-import-inputs .code-chunk')
    );
    (clean.match(/.{5}/g) || []).forEach((g, i) => {
      if (chunks[i]) chunks[i].value = g.toLowerCase();
    });
    setTimeout(() => document.getElementById('sync-import-go').click(), 200);
  })();
})();
