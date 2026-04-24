import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveRequest } from './resolveRequest.ts';
import type { ParsedRequest } from '../types.ts';

const req = (over: Partial<ParsedRequest> = {}): ParsedRequest => ({
  startLine: 1,
  endLine: 2,
  name: 'a',
  method: 'GET',
  url: '{{base}}/health',
  headers: [],
  body: undefined,
  expects: [],
  diagnostics: [],
  ...over
});

test('substitutes in url, headers, body', () => {
  const r = resolveRequest(
    req({
      url: '{{base}}/items/{{id}}',
      headers: [['Authorization', 'Bearer {{token}}']],
      body: '{"id":{{id}},"host":"{{base}}"}'
    }),
    { fileVars: { base: 'http://x', id: '7', token: 't1' } }
  );
  assert.equal(r.resolved.url, 'http://x/items/7');
  assert.equal(r.resolved.headers[0][1], 'Bearer t1');
  assert.equal(r.resolved.body, '{"id":7,"host":"http://x"}');
  assert.deepEqual(r.unresolved, []);
});

test('collects unresolved tokens', () => {
  const r = resolveRequest(req({ url: '{{missing}}/x' }), { fileVars: {} });
  assert.deepEqual(r.unresolved, ['missing']);
});
