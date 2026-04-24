import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDurationMs } from './durations.ts';

test('ms suffix', () => {
  assert.equal(parseDurationMs('500ms'), 500);
});
test('s suffix', () => {
  assert.equal(parseDurationMs('2s'), 2000);
});
test('whitespace tolerant', () => {
  assert.equal(parseDurationMs('  500 ms '), 500);
});
test('malformed returns null', () => {
  assert.equal(parseDurationMs('wat'), null);
  assert.equal(parseDurationMs('5'), null);
});
