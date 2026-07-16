// Pure, dependency-free reconciliation helpers shared by the cloud-sync layer.
// Loaded as a classic <script> (exposes window.SyncMerge) and also importable
// under Node for unit tests (module.exports). No Firebase / DOM references here
// so the tricky merge logic can be tested in isolation.
(function (root) {
  'use strict';

  // Union of local + cloud notes keyed by id; whichever copy has the newer
  // `modified` timestamp wins. Tombstones ({ deleted: true }) carry a bumped
  // `modified`, so a deletion made on one device survives the merge instead of
  // being resurrected by the other device's still-present copy.
  function mergeNotes(local, cloud) {
    var map = new Map();
    var i, n, existing;
    for (i = 0; i < local.length; i++) { n = local[i]; map.set(n.id, n); }
    for (i = 0; i < cloud.length; i++) {
      n = cloud[i];
      existing = map.get(n.id);
      if (!existing || (n.modified || 0) > (existing.modified || 0)) map.set(n.id, n);
    }
    return Array.from(map.values());
  }

  // Decide whether a pulled cloud document is newer than the last state we
  // applied. BOTH arguments must come from the SAME clock — the Firestore
  // server timestamp (updatedAt.toMillis()). Comparing a server timestamp with
  // client Date.now() is a bug: if the client clock runs behind, every login
  // looks "newer" and reloads spuriously; if it runs ahead, real remote changes
  // look old and are silently skipped.
  function shouldApplyCloud(cloudTimeMs, appliedHighWaterMs) {
    return (cloudTimeMs || 0) > (appliedHighWaterMs || 0);
  }

  var api = { mergeNotes: mergeNotes, shouldApplyCloud: shouldApplyCloud };
  root.SyncMerge = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
