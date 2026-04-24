import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseExpectLine } from './expectParser.ts';

test('status exact', () => {
  assert.deepEqual(parseExpectLine('# expect status 200'), { kind: 'status', op: 'eq', code: 200 });
});

test('status range', () => {
  assert.deepEqual(parseExpectLine('# expect status 2xx'), { kind: 'status', op: 'range', range: '2xx' });
  assert.deepEqual(parseExpectLine('# expect status 4xx'), { kind: 'status', op: 'range', range: '4xx' });
});

test('header contains / equals / exists', () => {
  assert.deepEqual(parseExpectLine('# expect header Content-Type contains json'), {
    kind: 'header',
    name: 'content-type',
    op: 'contains',
    value: 'json'
  });
  assert.deepEqual(parseExpectLine('# expect header X-Foo equals bar'), {
    kind: 'header',
    name: 'x-foo',
    op: 'equals',
    value: 'bar'
  });
  assert.deepEqual(parseExpectLine('# expect header X-Foo exists'), {
    kind: 'header',
    name: 'x-foo',
    op: 'exists'
  });
});

test('body contains "quoted"', () => {
  assert.deepEqual(parseExpectLine('# expect body contains "ok"'), {
    kind: 'body',
    op: 'contains',
    value: 'ok'
  });
});

test('body path equals with quoted string', () => {
  assert.deepEqual(parseExpectLine('# expect body path $.name equals "Ada"'), {
    kind: 'bodyPath',
    path: '$.name',
    op: 'equals',
    value: 'Ada'
  });
});

test('body path equals with number / boolean / null', () => {
  assert.deepEqual(parseExpectLine('# expect body path $.id equals 5'), {
    kind: 'bodyPath',
    path: '$.id',
    op: 'equals',
    value: 5
  });
  assert.deepEqual(parseExpectLine('# expect body path $.active equals true'), {
    kind: 'bodyPath',
    path: '$.active',
    op: 'equals',
    value: true
  });
  assert.deepEqual(parseExpectLine('# expect body path $.meta equals null'), {
    kind: 'bodyPath',
    path: '$.meta',
    op: 'equals',
    value: null
  });
});

test('body path exists', () => {
  assert.deepEqual(parseExpectLine('# expect body path $.id exists'), {
    kind: 'bodyPath',
    path: '$.id',
    op: 'exists'
  });
});

test('body path matches /regex/', () => {
  const r = parseExpectLine('# expect body path $.email matches /@example\\.com$/');
  assert.equal(r?.kind, 'bodyPath');
  assert.equal(r?.op, 'matches');
  assert.ok((r as { pattern: RegExp }).pattern instanceof RegExp);
  assert.equal((r as { pattern: RegExp }).pattern.source, '@example\\.com$');
});

test('time < Nms / Ns', () => {
  assert.deepEqual(parseExpectLine('# expect time < 500ms'), { kind: 'time', op: 'lt', ms: 500 });
  assert.deepEqual(parseExpectLine('# expect time < 1s'), { kind: 'time', op: 'lt', ms: 1000 });
});

test('malformed returns null', () => {
  assert.equal(parseExpectLine('# expect wombats'), null);
  assert.equal(parseExpectLine('# expect status cheese'), null);
});
