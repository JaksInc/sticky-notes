'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { detectBarcode } = require('../js/barcode.js');

test('6 digits → Home Depot HD6, formatted ###-###', () => {
  const b = detectBarcode('123456');
  assert.strictEqual(b.type, 'HD6');
  assert.strictEqual(b.formatted, '123-456');
  assert.strictEqual(b.valid, true);
});

test('10 digits → HD10, formatted ####-###-###', () => {
  const b = detectBarcode('1234567890');
  assert.strictEqual(b.type, 'HD10');
  assert.strictEqual(b.formatted, '1234-567-890');
});

test('12 digits → UPC with correct check digit is valid', () => {
  const b = detectBarcode('036000291452');
  assert.strictEqual(b.type, 'UPC');
  assert.strictEqual(b.valid, true);
});

test('12 digits → UPC with a wrong check digit is invalid', () => {
  const b = detectBarcode('036000291453');
  assert.strictEqual(b.type, 'UPC');
  assert.strictEqual(b.valid, false);
});

test('13 digits → EAN13 with correct check digit is valid', () => {
  const b = detectBarcode('4006381333931');
  assert.strictEqual(b.type, 'EAN13');
  assert.strictEqual(b.valid, true);
});

test('13 digits → EAN13 with a wrong check digit is invalid', () => {
  const b = detectBarcode('4006381333932');
  assert.strictEqual(b.valid, false);
});

test('unsupported lengths and non-digits return null', () => {
  assert.strictEqual(detectBarcode('12345'), null);
  assert.strictEqual(detectBarcode('12-34-56'), null);
  assert.strictEqual(detectBarcode(''), null);
});
