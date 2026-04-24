import { test } from 'node:test';
import assert from 'node:assert/strict';
import { redactHeaders } from './redactor.ts';

test('redacts authorization (case-insensitive)', () => {
  assert.deepEqual(redactHeaders([['Authorization', 'Bearer abcdefghij']]), [
    ['Authorization', 'Bear***']
  ]);
  assert.deepEqual(redactHeaders([['authorization', 'Bearer abcdefghij']]), [
    ['authorization', 'Bear***']
  ]);
});

test('redacts multiple set-cookie values', () => {
  const r = redactHeaders([
    ['Set-Cookie', 'session=abc; Path=/'],
    ['Set-Cookie', 'csrf=xyz']
  ]);
  assert.ok(r.every(([, v]) => v.endsWith('***')));
});

test('custom redaction list supersedes defaults', () => {
  const r = redactHeaders([['X-Special', 'supersecret']], ['x-special']);
  assert.equal(r[0][1], 'supe***');
});

test('short values are fully masked', () => {
  assert.equal(redactHeaders([['Authorization', 'abc']])[0][1], '***');
});

test('headers not in the list are untouched', () => {
  assert.deepEqual(redactHeaders([['Content-Type', 'application/json']]), [
    ['Content-Type', 'application/json']
  ]);
});
