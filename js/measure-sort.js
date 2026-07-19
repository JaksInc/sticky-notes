// Measurement-aware comparison for free-text dimension strings like "2x4x8",
// "1/2 in", "2 1/2", "1-1/2 in". Plain string sort is wrong for these: "1/4"
// sorts AFTER "1/2" lexically (because '4' > '2') even though 1/4 < 1/2. We fix
// that by tokenizing each string into number and text runs — evaluating
// fractions and mixed numbers to real values — and comparing token-by-token
// (a "natural sort" that also understands fractions).
//
// Loaded as a classic <script> (window.MeasureSort) and importable under Node
// for unit tests (module.exports). No DOM references.
(function (root) {
  'use strict';

  // Break a string into ordered tokens: { num } for numeric runs (integers,
  // decimals, fractions a/b, and mixed numbers "a b/c" or "a-b/c"), { str } for
  // the text between them (units, separators like "x").
  function dimTokens(str) {
    var s = String(str == null ? '' : str).toLowerCase().trim();
    var tokens = [];
    var i = 0;
    while (i < s.length) {
      var rest = s.slice(i);
      var m;
      if ((m = /^(\d+)[ \-](\d+)\/(\d+)/.exec(rest))) {          // mixed: 2 1/2
        tokens.push({ num: parseInt(m[1], 10) + parseInt(m[2], 10) / parseInt(m[3], 10) });
        i += m[0].length;
      } else if ((m = /^(\d+)\/(\d+)/.exec(rest))) {             // fraction: 1/2
        tokens.push({ num: parseInt(m[1], 10) / parseInt(m[2], 10) });
        i += m[0].length;
      } else if ((m = /^\d+(?:\.\d+)?/.exec(rest))) {            // decimal / integer
        tokens.push({ num: parseFloat(m[0]) });
        i += m[0].length;
      } else {                                                   // text run
        m = /^[^0-9]+/.exec(rest);
        tokens.push({ str: m[0].replace(/\s+/g, ' ') });
        i += m[0].length;
      }
    }
    return tokens;
  }

  // Compare token lists: numbers numerically, text lexically, a number before
  // text at the same position, and a shorter (prefix) list first.
  function cmpTokens(A, B) {
    var n = Math.max(A.length, B.length);
    for (var i = 0; i < n; i++) {
      var a = A[i], b = B[i];
      if (a === undefined) return -1;
      if (b === undefined) return 1;
      var aNum = 'num' in a, bNum = 'num' in b;
      if (aNum && bNum) {
        if (a.num !== b.num) return a.num < b.num ? -1 : 1;
      } else if (aNum !== bNum) {
        return aNum ? -1 : 1;
      } else if (a.str !== b.str) {
        return a.str < b.str ? -1 : 1;
      }
    }
    return 0;
  }

  // -1 / 0 / 1 ordering two dimension strings by measurement. Blank sorts first.
  function compareDimensions(a, b) {
    return cmpTokens(dimTokens(a), dimTokens(b));
  }

  // Canonicalize a free-text dimension so the same measurement is always stored
  // (and searched) the same way. The target form uses characters a person would
  // TYPE — ascii "x" (not ×), single spaces, tidy fractions — so a search like
  // "2x4" reliably matches however the item was entered ("2 X 4", "2*4", …).
  //   "2 X 4 X 8" -> "2x4x8"   "1/2in" -> "1/2 in"   "1 / 2 IN" -> "1/2 in"
  //   "2*4"       -> "2x4"     "8in"   -> "8 in"     "2 1/2 in" -> "2 1/2 in"
  function normalizeDimensions(str) {
    var s = String(str == null ? '' : str).toLowerCase().trim();
    if (!s) return '';
    s = s.replace(/\s+/g, ' ');                 // collapse runs of whitespace
    s = s.replace(/\s*\/\s*/g, '/');            // "1 / 2" -> "1/2"
    s = s.replace(/[×*]/g, 'x');                // ×, * -> x
    s = s.replace(/(\d)([a-z]+)/g, '$1 $2');    // "8in" -> "8 in" (also splits x, fixed next)
    s = s.replace(/(\d)\s*x\s*(?=\d)/g, '$1x'); // "2 x 4" -> "2x4" (x between numbers)
    return s.trim();
  }

  var api = {
    compareDimensions: compareDimensions, dimTokens: dimTokens,
    normalizeDimensions: normalizeDimensions,
  };
  root.MeasureSort = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
