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

  // ── localStorage intercept ────────────────────────────────────────────────

  var origSet = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function (key, value) {
    origSet(key, value);
    if (SYNC_KEYS.includes(key) && auth.currentUser) debouncedPush();
  };

  window.addEventListener('storage', function (e) {
    if (SYNC_KEYS.includes(e.key) && auth.currentUser) debouncedPush();
  });

  // ── Debounced push ────────────────────────────────────────────────────────

  var pushTimer;
  function debouncedPush() {
    clearTimeout(pushTimer);
    pushTimer = setTimeout(pushToCloud, 2000);
  }

  async function pushToCloud() {
    if (!auth.currentUser) return;
    try {
      updateSyncStatus('Syncing…');
      var data = {};
      for (var k of SYNC_KEYS) {
        try { data[k] = JSON.parse(localStorage.getItem(k)); }
        catch (_) { data[k] = localStorage.getItem(k); }
      }
      data.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
      data._session  = SESSION;
      await db.doc('users/' + auth.currentUser.uid + '/data').set(data);
      origSet(LAST_SYNC_KEY, String(Date.now()));
      updateSyncStatus('Synced');
      setTimeout(function () { updateSyncStatus(''); }, 3000);
    } catch (err) {
      console.error('Cloud push failed:', err);
      updateSyncStatus('Sync failed', true);
    }
  }

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
    try { snap = await db.doc('users/' + uid + '/data').get(); }
    catch (err) { console.error('Cloud pull failed:', err); return; }

    if (!snap.exists) {
      await pushToCloud();
      return;
    }

    var d = snap.data();
    var lastSync  = Number(localStorage.getItem(LAST_SYNC_KEY) || 0);
    var cloudTime = d.updatedAt ? d.updatedAt.toMillis() : 0;

    if (cloudTime <= lastSync) return;

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
    unsubscribe = db.doc('users/' + uid + '/data').onSnapshot(function (snap) {
      if (!snap.exists) return;
      var d = snap.data();
      if (d._session === SESSION) return;
      if (justPulled) { justPulled = false; return; }
      applyCloudData(d);
      origSet(LAST_SYNC_KEY, String(Date.now()));
      location.reload();
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
      showLoggedOut();
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

  function escHtml(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function showLoggedIn(email) {
    var btn = document.getElementById('btn-cloud');
    if (btn) {
      btn.innerHTML = icon('user', 15) +
        '<span class="btn-label cloud-user-email">' + escHtml(email.split('@')[0]) + '</span>' +
        '<span class="cloud-status"></span>';
      btn.title = 'Cloud sync — ' + email;
    }
    var formSection = document.getElementById('auth-form-section');
    var signedInSection = document.getElementById('auth-signed-in-section');
    var titleEl = document.getElementById('auth-title');
    if (formSection) formSection.style.display = 'none';
    if (signedInSection) signedInSection.style.display = '';
    if (titleEl) titleEl.textContent = 'Signed In';
    var emailEl = document.getElementById('auth-user-email');
    if (emailEl) emailEl.textContent = email;
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
    var emailEl = document.getElementById('auth-email');
    if (emailEl) emailEl.focus();
    clearAuthError();
  });

  function closeAuthModal() {
    document.getElementById('auth-modal').style.display = 'none';
    var pw = document.getElementById('auth-password');
    if (pw) pw.value = '';
    clearAuthError();
  }

  document.getElementById('auth-cancel').addEventListener('click', closeAuthModal);
  document.getElementById('auth-close').addEventListener('click', closeAuthModal);
  document.getElementById('auth-modal').addEventListener('click', function (e) {
    if (e.target.id === 'auth-modal') closeAuthModal();
  });

  document.getElementById('auth-toggle').addEventListener('click', function () {
    isSignUp = !isSignUp;
    var title  = document.getElementById('auth-title');
    var submit = document.getElementById('auth-submit');
    var toggle = document.getElementById('auth-toggle');
    title.textContent  = isSignUp ? 'Create Account' : 'Sign In';
    submit.textContent = isSignUp ? 'Create Account' : 'Sign In';
    toggle.textContent = isSignUp ? 'Back to Sign In' : 'Create Account';
    clearAuthError();
  });

  document.getElementById('auth-submit').addEventListener('click', async function () {
    var email    = document.getElementById('auth-email').value.trim();
    var password = document.getElementById('auth-password').value;
    if (!email || !password) return;
    var btn = document.getElementById('auth-submit');
    btn.disabled = true;
    btn.textContent = isSignUp ? 'Creating…' : 'Signing in…';
    clearAuthError();
    try {
      if (isSignUp) {
        await auth.createUserWithEmailAndPassword(email, password);
      } else {
        await auth.signInWithEmailAndPassword(email, password);
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

  ['auth-email', 'auth-password'].forEach(function (id) {
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
      'auth/user-not-found':         'No account with that email.',
      'auth/wrong-password':         'Incorrect password.',
      'auth/invalid-credential':     'Incorrect email or password.',
      'auth/email-already-in-use':   'An account with that email already exists.',
      'auth/weak-password':          'Password must be at least 6 characters.',
      'auth/invalid-email':          'Please enter a valid email address.',
      'auth/too-many-requests':      'Too many attempts. Try again later.',
      'auth/network-request-failed': 'Network error — check your connection.',
    };
    return map[code] || 'An error occurred. Please try again.';
  }

})();
