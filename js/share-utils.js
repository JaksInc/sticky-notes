(function (global) {
  'use strict';

  global.MANTLEDB = 'https://mantledb.sh/v2/sticky-notes-share/';

  global.uuidToCode = function (hex) {
    return BigInt('0x' + hex).toString(36).toUpperCase().padStart(25, '0');
  };

  global.codeToUuid = function (code) {
    const s = code.replace(/\s/g, '').toLowerCase();
    let n = 0n;
    for (const ch of s) n = n * 36n + BigInt(parseInt(ch, 36));
    return n.toString(16).padStart(32, '0');
  };

  // Given arbitrary text (full URL or raw code), return {code, param} or null.
  // Handles: URL with ?gist= / ?import-links= / ?sync-import=,
  //          25-char base36, old-format 32-char hex (backward compat).
  global.extractShareCode = function (text) {
    const t = (text || '').trim();
    try {
      const url = new URL(t);
      for (const p of ['gist', 'import-links', 'sync-import']) {
        const v = url.searchParams.get(p);
        if (v) return { code: v.replace(/\s/g, ''), param: p };
      }
    } catch (_) {}
    const raw = t.replace(/[^0-9a-z]/gi, '').toLowerCase();
    if (raw.length === 25 || raw.length === 32) return { code: raw, param: null };
    return null;
  };
})(window);
