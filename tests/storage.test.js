'use strict';
const { test, beforeEach } = require('node:test');
const assert = require('node:assert');

// Minimal in-memory localStorage so storage.js (a browser script) runs in Node.
function memStorage() {
  const m = new Map();
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: k => { m.delete(k); },
    clear: () => m.clear(),
  };
}
global.localStorage = memStorage();

const store = require('../js/storage.js');
const { createNote, saveNote, deleteNote, getAllNotes, getVisibleNotes, getNote } = store;

beforeEach(() => { global.localStorage.clear(); });

test('createNote is visible and persisted', () => {
  const n = createNote();
  assert.strictEqual(getVisibleNotes().length, 1);
  assert.strictEqual(getNote(n.id).id, n.id);
});

test('deleteNote soft-deletes: tombstone kept, hidden from views', () => {
  const n = createNote();
  deleteNote(n.id);

  const raw = getAllNotes();
  assert.strictEqual(raw.length, 1, 'tombstone stays in storage so it can sync');
  assert.strictEqual(raw[0].deleted, true);
  assert.strictEqual(raw[0].content, '', 'deleted content is cleared');

  assert.strictEqual(getVisibleNotes().length, 0, 'hidden from the grid');
  assert.strictEqual(getNote(n.id), null, 'getNote ignores tombstones (auto-unpins)');
});

test('deleteNote bumps modified above the original so the merge favors it', () => {
  const n = createNote();
  const before = getNote(n.id).modified;
  deleteNote(n.id);
  const tomb = getAllNotes()[0];
  assert.ok(tomb.modified >= before);
});

test('saveNote updates content and bumps modified', () => {
  const n = createNote();
  saveNote({ ...n, content: 'hello' });
  const updated = getNote(n.id);
  assert.strictEqual(updated.content, 'hello');
  assert.ok(updated.modified >= n.modified);
});
