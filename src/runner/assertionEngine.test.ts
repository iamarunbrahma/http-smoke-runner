import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePredicates, type ResponseSnapshot } from './assertionEngine.ts';

const resp = (over: Partial<ResponseSnapshot> = {}): ResponseSnapshot => ({
  status: 200,
  headers: new Map([['content-type', 'application/json']]),
  body: '{"id":5,"name":"Ada","active":true}',
  durationMs: 42,
  ...over
});

test('status eq passes when matching', () => {
  const r = evaluatePredicates(resp(), [{ kind: 'status', op: 'eq', code: 200 }]);
  assert.equal(r.ok, true);
  assert.equal(r.failures.length, 0);
});

test('status eq fails with diffable message', () => {
  const r = evaluatePredicates(resp({ status: 500 }), [{ kind: 'status', op: 'eq', code: 201 }]);
  assert.equal(r.ok, false);
  assert.equal(r.failures[0].diffable, true);
  assert.equal(r.failures[0].expected, '201');
  assert.equal(r.failures[0].actual, '500');
});

test('status range 2xx passes for 204', () => {
  const r = evaluatePredicates(resp({ status: 204 }), [{ kind: 'status', op: 'range', range: '2xx' }]);
  assert.equal(r.ok, true);
});

test('header contains (case-insensitive)', () => {
  const r = evaluatePredicates(resp(), [
    { kind: 'header', name: 'content-type', op: 'contains', value: 'json' }
  ]);
  assert.equal(r.ok, true);
});

test('header exists fails when absent', () => {
  const r = evaluatePredicates(resp(), [{ kind: 'header', name: 'x-nope', op: 'exists' }]);
  assert.equal(r.ok, false);
});

test('body contains text', () => {
  const r = evaluatePredicates(resp(), [{ kind: 'body', op: 'contains', value: 'Ada' }]);
  assert.equal(r.ok, true);
});

test('body path equals number', () => {
  const r = evaluatePredicates(resp(), [{ kind: 'bodyPath', path: '$.id', op: 'equals', value: 5 }]);
  assert.equal(r.ok, true);
});

test('body path exists', () => {
  const r = evaluatePredicates(resp(), [{ kind: 'bodyPath', path: '$.name', op: 'exists' }]);
  assert.equal(r.ok, true);
});

test('body path matches regex', () => {
  const r = evaluatePredicates(resp(), [{ kind: 'bodyPath', path: '$.name', op: 'matches', pattern: /^A/ }]);
  assert.equal(r.ok, true);
});

test('body path on non-JSON body fails with "not JSON"', () => {
  const r = evaluatePredicates(resp({ body: '<html/>' }), [{ kind: 'bodyPath', path: '$.x', op: 'exists' }]);
  assert.equal(r.ok, false);
  assert.match(r.failures[0].summary, /not JSON/i);
});

test('time < ms passes when fast', () => {
  const r = evaluatePredicates(resp({ durationMs: 100 }), [{ kind: 'time', op: 'lt', ms: 500 }]);
  assert.equal(r.ok, true);
});

test('time < ms fails when slow', () => {
  const r = evaluatePredicates(resp({ durationMs: 900 }), [{ kind: 'time', op: 'lt', ms: 500 }]);
  assert.equal(r.ok, false);
  assert.match(r.failures[0].summary, /exceeded/i);
});
