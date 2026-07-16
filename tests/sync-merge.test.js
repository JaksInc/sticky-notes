'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { mergeById, mergeNotes, shouldApplyCloud } = require('../js/sync-merge.js');

test('mergeNotes keeps notes unique to each side', () => {
  const local = [{ id: 'a', modified: 1 }];
  const cloud = [{ id: 'b', modified: 1 }];
  const merged = mergeNotes(local, cloud);
  assert.deepStrictEqual(merged.map(n => n.id).sort(), ['a', 'b']);
});

test('mergeNotes: newer modified wins (cloud newer)', () => {
  const local = [{ id: 'a', content: 'old', modified: 1 }];
  const cloud = [{ id: 'a', content: 'new', modified: 2 }];
  assert.strictEqual(mergeNotes(local, cloud)[0].content, 'new');
});

test('mergeNotes: newer modified wins (local newer)', () => {
  const local = [{ id: 'a', content: 'new', modified: 5 }];
  const cloud = [{ id: 'a', content: 'old', modified: 2 }];
  assert.strictEqual(mergeNotes(local, cloud)[0].content, 'new');
});

test('mergeNotes: a local tombstone survives a still-live cloud copy', () => {
  // The bug this guards: deleting a note must not be resurrected on next login.
  const local = [{ id: 'a', deleted: true, content: '', modified: 100 }];
  const cloud = [{ id: 'a', content: 'alive', modified: 2 }];
  const merged = mergeNotes(local, cloud);
  assert.strictEqual(merged.length, 1);
  assert.strictEqual(merged[0].deleted, true);
});

test('mergeNotes: a newer cloud tombstone propagates to local', () => {
  const local = [{ id: 'a', content: 'alive', modified: 2 }];
  const cloud = [{ id: 'a', deleted: true, content: '', modified: 100 }];
  assert.strictEqual(mergeNotes(local, cloud)[0].deleted, true);
});

test('mergeNotes: missing modified treated as 0, does not clobber a timestamped copy', () => {
  const local = [{ id: 'a', content: 'has-time', modified: 5 }];
  const cloud = [{ id: 'a', content: 'no-time' }];
  assert.strictEqual(mergeNotes(local, cloud)[0].content, 'has-time');
});

test('mergeNotes is an alias of mergeById', () => {
  assert.strictEqual(mergeNotes, mergeById);
});

test('mergeById merges todos per-item: concurrent edits on two devices both survive', () => {
  // Device A toggled todo t1 done; device B added todo t2. Neither should be lost.
  const local = [
    { id: 't1', text: 'buy milk', done: true, modified: 20 },
    { id: 't2', text: 'call mom', done: false, modified: 30 },
  ];
  const cloud = [
    { id: 't1', text: 'buy milk', done: false, modified: 10 }, // stale copy
  ];
  const merged = mergeById(local, cloud);
  const byId = Object.fromEntries(merged.map(t => [t.id, t]));
  assert.strictEqual(merged.length, 2);
  assert.strictEqual(byId.t1.done, true, 'newer toggle wins');
  assert.ok(byId.t2, 'the item only on one device is not dropped');
});

test('mergeById propagates a deleted todo/link tombstone', () => {
  const local = [{ id: 'l1', name: 'Docs', url: 'https://x', modified: 5 }];
  const cloud = [{ id: 'l1', deleted: true, modified: 50 }];
  assert.strictEqual(mergeById(local, cloud)[0].deleted, true);
});

test('shouldApplyCloud: newer cloud applies, same/older does not', () => {
  assert.strictEqual(shouldApplyCloud(200, 100), true);
  assert.strictEqual(shouldApplyCloud(100, 100), false);
  assert.strictEqual(shouldApplyCloud(50, 100), false);
});

test('shouldApplyCloud: first login (no high-water mark) applies', () => {
  assert.strictEqual(shouldApplyCloud(1234, 0), true);
});

test('shouldApplyCloud: no skew false-positive when values share a clock', () => {
  // Same server time on both sides must NOT look "newer" (the clock-skew bug
  // was comparing a server timestamp against a client Date.now()).
  const serverNow = 1_700_000_000_000;
  assert.strictEqual(shouldApplyCloud(serverNow, serverNow), false);
});
