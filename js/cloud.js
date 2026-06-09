(function () {
  'use strict';

  if (!window.firebase || !window.FB_CONFIG ||
      window.FB_CONFIG.apiKey === 'YOUR_API_KEY') return;

  var app;
  try {
    app = firebase.initializeApp(window.FB_CONFIG);
  } catch (e) {
    if (e.code !== 'app/duplicate-app') throw e;
    app = firebase.app();
  }
  var auth = firebase.auth();
  var db   = firebase.firestore();
  var SESSION = crypto.randomUUID();

  var SYNC_KEYS = [
    'sticky-notes',
    'sticky-links',
    'qb-layout',
    'sticky-todos',
    'sticky-pinned',
    'sticky-notes-view',
  ];
  var LAST_SYNC_KEY = '_cloud_last_sync';

  // ── localStorage intercept (layout + view only — no explicit hook points) ─

  var origSet = localStorage.setItem.bind(localStorage);
  var INTERCEPT_KEYS = ['qb-layout', 'sticky-notes-view'];
  localStorage.setItem = function (key, value) {
    origSet(key, value);
    if (INTERCEPT_KEYS.includes(key) && auth.currentUser) pushKey(key, value);
  };

  // Catch note saves from note.html popup window
  window.addEventListener('storage', function (e) {
    if (e.key === 'sticky-notes' && auth.currentUser) pushKey('sticky-notes', e.newValue);
  });

  // ── Key-level push ────────────────────────────────────────────────────────

  var dirtyKeys = new Set();

  async function pushKey(key, raw) {
    if (!auth.currentUser) return;
    var value;
    try { value = JSON.parse(raw); } catch (_) { value = raw; }
    var payload = {};
    payload[key]        = value;
    payload.updatedAt   = firebase.firestore.FieldValue.serverTimestamp();
    payload._session    = SESSION;
    payload._changedKey = key;
    updateSyncStatus('Syncing…');
    try {
      await db.doc('users/' + auth.currentUser.uid + '/data/sync').set(payload, { merge: true });
      dirtyKeys.delete(key);
      origSet(LAST_SYNC_KEY, String(Date.now()));
      updateSyncStatus('Synced');
      setTimeout(function () { updateSyncStatus(''); }, 3000);
    } catch (err) {
      console.error('Cloud push failed:', err);
      dirtyKeys.add(key);
      updateSyncStatus('Sync failed', true);
    }
  }

  // Explicit sync trigger called from dashboard.js after each action
  window.cloudSync = function (key) {
    if (!auth.currentUser) return;
    pushKey(key, localStorage.getItem(key));
  };

  // Retry dirty keys on reconnect or tab focus
  function retryDirty() {
    if (!auth.currentUser || dirtyKeys.size === 0) return;
    dirtyKeys.forEach(function (k) { window.cloudSync(k); });
  }
  window.addEventListener('online', retryDirty);
  window.addEventListener('focus',  retryDirty);

  // ── Pull / merge ──────────────────────────────────────────────────────────

  function applyCloudData(d) {
    for (var k of SYNC_KEYS) {
      if (d[k] != null) {
        origSet(k, typeof d[k] === 'string' ? d[k] : JSON.stringify(d[k]));
      }
    }
  }

  function mergeNotes(local, cloud) {
    var map = new Map();
    for (var n of local) map.set(n.id, n);
    for (var n of cloud) {
      var existing = map.get(n.id);
      if (!existing || (n.modified || 0) > (existing.modified || 0)) map.set(n.id, n);
    }
    return Array.from(map.values());
  }

  var justPulled = false;

  async function pullOnLogin(uid) {
    var snap;
    try { snap = await db.doc('users/' + uid + '/data/sync').get(); }
    catch (err) { console.error('Cloud pull failed:', err); return; }

    if (!snap.exists) {
      for (var k of SYNC_KEYS) {
        var raw = localStorage.getItem(k);
        if (raw != null) await pushKey(k, raw);
      }
      return;
    }

    var d = snap.data();
    var lastSync  = Number(localStorage.getItem(LAST_SYNC_KEY) || 0);
    var cloudTime = d.updatedAt ? d.updatedAt.toMillis() : 0;

    if (cloudTime <= lastSync) {
      // Cloud is not newer — push local state to sync any changes made while offline
      for (var k of SYNC_KEYS) {
        var r = localStorage.getItem(k);
        if (r != null) await pushKey(k, r);
      }
      return;
    }

    var localNotes  = [];
    try { localNotes = JSON.parse(localStorage.getItem('sticky-notes') || '[]'); } catch (_) {}

    if (localNotes.length) {
      var cloudNotes = Array.isArray(d['sticky-notes']) ? d['sticky-notes'] : [];
      var merged = mergeNotes(localNotes, cloudNotes);
      origSet('sticky-notes', JSON.stringify(merged));
      var partial = Object.assign({}, d);
      delete partial['sticky-notes'];
      applyCloudData(partial);
    } else {
      applyCloudData(d);
    }

    origSet(LAST_SYNC_KEY, String(Date.now()));
    justPulled = true;
    location.reload();
  }

  // ── Real-time listener ────────────────────────────────────────────────────

  var unsubscribe;
  function startListener(uid) {
    unsubscribe = db.doc('users/' + uid + '/data/sync').onSnapshot(function (snap) {
      if (!snap.exists) return;
      var d = snap.data();
      if (d._session === SESSION) return;
      if (justPulled) { justPulled = false; return; }
      var key = d._changedKey;
      if (!key || !SYNC_KEYS.includes(key)) return;
      var stored = typeof d[key] === 'string' ? d[key] : JSON.stringify(d[key]);
      if (stored === null || stored === 'null') {
        localStorage.removeItem(key);
      } else {
        origSet(key, stored);
      }
      origSet(LAST_SYNC_KEY, String(Date.now()));
      window.dispatchEvent(new CustomEvent('cloud-applied', { detail: { key: key } }));
    });
  }

  // ── Auth state ────────────────────────────────────────────────────────────

  auth.onAuthStateChanged(function (user) {
    if (user) {
      pullOnLogin(user.uid).then(function () {
        if (!justPulled) startListener(user.uid);
      });
      showLoggedIn(user.email);
    } else {
      if (unsubscribe) { unsubscribe(); unsubscribe = null; }
      SYNC_KEYS.forEach(function (k) { localStorage.removeItem(k); });
      origSet(LAST_SYNC_KEY, '0');
      showLoggedOut();
      location.reload();
    }
  });

  // ── Sync status UI ────────────────────────────────────────────────────────

  function updateSyncStatus(msg, isError) {
    var btn = document.getElementById('btn-cloud');
    if (!btn) return;
    var el = btn.querySelector('.cloud-status');
    if (!el) return;
    el.textContent = msg ? ' ' + msg : '';
    el.style.color = isError ? 'var(--color-danger)' : '';
  }

  function relativeTime(tsMs) {
    if (!tsMs) return 'never';
    var diff = Math.floor((Date.now() - tsMs) / 1000);
    if (diff < 10)  return 'just now';
    if (diff < 60)  return diff + ' seconds ago';
    var mins = Math.floor(diff / 60);
    if (mins < 60)  return mins === 1 ? '1 minute ago' : mins + ' minutes ago';
    var hrs = Math.floor(mins / 60);
    if (hrs < 24)   return hrs === 1 ? '1 hour ago' : hrs + ' hours ago';
    var days = Math.floor(hrs / 24);
    return days === 1 ? '1 day ago' : days + ' days ago';
  }

  function populateSyncInfo() {
    var ts = Number(localStorage.getItem(LAST_SYNC_KEY) || 0);
    var lastSyncedEl = document.getElementById('auth-last-synced');
    if (lastSyncedEl) lastSyncedEl.textContent = relativeTime(ts || null);

    var statusEl = document.getElementById('auth-sync-status-text');
    if (statusEl) {
      var btn = document.getElementById('btn-cloud');
      var cloudStatusEl = btn && btn.querySelector('.cloud-status');
      var statusText = cloudStatusEl ? cloudStatusEl.textContent.trim() : '';
      statusEl.textContent = statusText || (auth.currentUser ? 'Synced' : 'not connected');
    }
  }

  function escHtml(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // Username ↔ Firebase email mapping (Firebase requires email format internally)
  var FAKE_DOMAIN = '@qb.internal';
  function toFakeEmail(username) { return username.toLowerCase().trim() + FAKE_DOMAIN; }
  function fromFakeEmail(email)  { return (email || '').replace(FAKE_DOMAIN, ''); }

  function showLoggedIn(email) {
    var username = fromFakeEmail(email);
    var btn = document.getElementById('btn-cloud');
    if (btn) {
      btn.innerHTML = icon('user', 15) +
        '<span class="btn-label cloud-user-email">' + escHtml(username) + '</span>' +
        '<span class="cloud-status"></span>';
      btn.title = 'Cloud sync — ' + username;
    }
    var formSection = document.getElementById('auth-form-section');
    var signedInSection = document.getElementById('auth-signed-in-section');
    var titleEl = document.getElementById('auth-title');
    if (formSection) formSection.style.display = 'none';
    if (signedInSection) signedInSection.style.display = '';
    if (titleEl) titleEl.textContent = 'Signed In';
    var nameEl = document.getElementById('auth-user-email');
    if (nameEl) nameEl.textContent = username;
    populateSyncInfo();
  }

  function showLoggedOut() {
    var btn = document.getElementById('btn-cloud');
    if (btn) {
      btn.innerHTML = icon('user', 15) + '<span class="btn-label"> Sign In</span>';
      btn.title = 'Sign in to sync across devices';
    }
    var formSection = document.getElementById('auth-form-section');
    var signedInSection = document.getElementById('auth-signed-in-section');
    var titleEl = document.getElementById('auth-title');
    if (formSection) formSection.style.display = '';
    if (signedInSection) signedInSection.style.display = 'none';
    if (titleEl) titleEl.textContent = 'Sign In';
  }

  // ── Auth modal ────────────────────────────────────────────────────────────

  var isSignUp = false;

  document.getElementById('btn-cloud').addEventListener('click', function () {
    document.getElementById('auth-modal').style.display = 'flex';
    if (auth.currentUser) {
      populateSyncInfo();
    } else {
      document.getElementById('auth-username').focus();
    }
    clearAuthError();
  });

  document.getElementById('auth-sync-now').addEventListener('click', function () {
    if (!auth.currentUser) return;
    SYNC_KEYS.forEach(function (k) {
      var raw = localStorage.getItem(k);
      if (raw != null) pushKey(k, raw);
    });
  });

  function closeAuthModal() {
    document.getElementById('auth-modal').style.display = 'none';
    document.getElementById('auth-password').value = '';
    document.getElementById('auth-regcode').value  = '';
    clearAuthError();
    if (isSignUp) {
      isSignUp = false;
      document.getElementById('auth-title').textContent  = 'Sign In';
      document.getElementById('auth-submit').textContent = 'Sign In';
      document.getElementById('auth-toggle').textContent = 'Create Account';
      document.getElementById('auth-regcode').style.display = 'none';
    }
  }

  document.getElementById('auth-cancel').addEventListener('click', closeAuthModal);
  document.getElementById('auth-close').addEventListener('click', closeAuthModal);
  document.getElementById('auth-modal').addEventListener('click', function (e) {
    if (e.target.id === 'auth-modal') closeAuthModal();
  });

  document.getElementById('auth-toggle').addEventListener('click', function () {
    isSignUp = !isSignUp;
    document.getElementById('auth-title').textContent  = isSignUp ? 'Create Account' : 'Sign In';
    document.getElementById('auth-submit').textContent = isSignUp ? 'Create Account' : 'Sign In';
    document.getElementById('auth-toggle').textContent = isSignUp ? 'Back to Sign In' : 'Create Account';
    document.getElementById('auth-regcode').style.display = isSignUp ? '' : 'none';
    document.getElementById('auth-regcode').value = '';
    clearAuthError();
  });

  document.getElementById('auth-submit').addEventListener('click', async function () {
    var username = document.getElementById('auth-username').value.trim();
    var password = document.getElementById('auth-password').value;
    var regcode  = document.getElementById('auth-regcode').value;

    if (!username || !password) return;
    if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
      showAuthError('Username may only contain letters, numbers, dots, hyphens, and underscores.');
      return;
    }
    if (isSignUp) {
      var expected = window.FB_CONFIG && window.FB_CONFIG.registrationCode;
      if (!expected || regcode !== expected) {
        showAuthError('Incorrect registration code.');
        return;
      }
    }

    var btn = document.getElementById('auth-submit');
    btn.disabled = true;
    btn.textContent = isSignUp ? 'Creating…' : 'Signing in…';
    clearAuthError();
    try {
      var fakeEmail = toFakeEmail(username);
      if (isSignUp) {
        await auth.createUserWithEmailAndPassword(fakeEmail, password);
      } else {
        await auth.signInWithEmailAndPassword(fakeEmail, password);
      }
      closeAuthModal();
    } catch (err) {
      showAuthError(friendlyAuthError(err.code));
    } finally {
      btn.disabled = false;
      btn.textContent = isSignUp ? 'Create Account' : 'Sign In';
    }
  });

  document.getElementById('auth-signout').addEventListener('click', async function () {
    await auth.signOut();
    closeAuthModal();
  });

  ['auth-username', 'auth-password', 'auth-regcode'].forEach(function (id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') document.getElementById('auth-submit').click();
      if (e.key === 'Escape') closeAuthModal();
    });
  });

  function showAuthError(msg) {
    var el = document.getElementById('auth-error');
    if (el) { el.textContent = msg; el.style.display = ''; }
  }

  function clearAuthError() {
    var el = document.getElementById('auth-error');
    if (el) el.style.display = 'none';
  }

  function friendlyAuthError(code) {
    var map = {
      'auth/user-not-found':         'Username not found.',
      'auth/wrong-password':         'Incorrect password.',
      'auth/invalid-credential':     'Incorrect username or password.',
      'auth/email-already-in-use':   'That username is already taken.',
      'auth/weak-password':          'Password must be at least 6 characters.',
      'auth/invalid-email':          'Invalid username.',
      'auth/too-many-requests':      'Too many attempts. Try again later.',
      'auth/network-request-failed': 'Network error — check your connection.',
    };
    return map[code] || 'An error occurred. Please try again.';
  }

})();
