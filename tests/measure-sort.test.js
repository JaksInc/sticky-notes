'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { compareDimensions } = require('../js/measure-sort.js');

const sign = (n) => (n < 0 ? -1 : n > 0 ? 1 : 0);
// Sort a list with the comparator and return the resulting order.
const order = (arr) => arr.slice().sort(compareDimensions);

test('the motivating case: 1/4 sorts before 1/2 (not lexically after)', () => {
  assert.strictEqual(sign(compareDimensions('1/4', '1/2')), -1);
  assert.strictEqual(sign(compareDimensions('1/2', '1/4')), 1);
});

test('fractions sort in true numeric order', () => {
  assert.deepStrictEqual(order(['3/4', '1/8', '1/2', '1/4']), ['1/8', '1/4', '1/2', '3/4']);
});

test('multi-dimension lumber sorts by each number, not lexically', () => {
  // 2x4x8 before 2x4x10 (8 < 10, not "8" > "10"); 2x4x8 before 2x6x8.
  assert.strictEqual(sign(compareDimensions('2x4x8', '2x4x10')), -1);
  assert.strictEqual(sign(compareDimensions('2x4x8', '2x6x8')), -1);
});

test('mixed numbers evaluate to their real value', () => {
  assert.strictEqual(sign(compareDimensions('2 1/2', '2 3/4')), -1);
  assert.strictEqual(sign(compareDimensions('1-1/2 in', '1 in')), 1); // 1.5 > 1
});

test('a full mixed set of imperial sizes sorts by size', () => {
  assert.deepStrictEqual(
    order(['1 in', '1/2 in', '3/4 in', '1-1/2 in', '1/4 in']),
    ['1/4 in', '1/2 in', '3/4 in', '1 in', '1-1/2 in']
  );
});

test('decimals compare numerically', () => {
  assert.strictEqual(sign(compareDimensions('0.5', '0.25')), 1);
  assert.strictEqual(sign(compareDimensions('1.5x2', '1.5x10')), -1);
});

test('blank sorts before anything', () => {
  assert.strictEqual(sign(compareDimensions('', '1/4')), -1);
  assert.strictEqual(sign(compareDimensions('2x4', '')), 1);
});

test('non-numeric text falls back to a stable lexical compare', () => {
  assert.strictEqual(sign(compareDimensions('large', 'small')), -1);
  assert.strictEqual(compareDimensions('same', 'same'), 0);
});

test('equal dimensions compare equal', () => {
  assert.strictEqual(compareDimensions('2x4x8', '2x4x8'), 0);
  assert.strictEqual(compareDimensions('1/2 in', '1/2 in'), 0);
});
