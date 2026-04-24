import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHttpFile } from './parseFile.ts';

test('parses a full file with vars, requests, and expects', () => {
  const text = [
    '@base = http://x',
    '',
    '### health',
    'GET {{base}}/health',
    '# expect status 200',
    '',
    '### create',
    'POST {{base}}/users',
    'Content-Type: application/json',
    '',
    '{"name":"Ada"}',
    '# expect status 201',
    '# expect body path $.name equals "Ada"'
  ].join('\n');

  const { requests, fileVars, diagnostics } = parseHttpFile(text);
  assert.equal(Object.keys(fileVars).length, 1);
  assert.equal(fileVars.base, 'http://x');
  assert.equal(requests.length, 2);
  assert.equal(requests[0].name, 'health');
  assert.equal(requests[0].expects.length, 1);
  assert.equal(requests[1].name, 'create');
  assert.equal(requests[1].expects.length, 2);
  assert.deepEqual(diagnostics, []);
});

test('emits diagnostic for request chaining', () => {
  const text = [
    '### a',
    'POST http://x/login',
    '# @name login',
    '',
    '### b',
    'GET http://x/me',
    'Authorization: Bearer {{login.response.body.$.token}}'
  ].join('\n');
  const { diagnostics } = parseHttpFile(text);
  assert.ok(diagnostics.some(d => /chaining/i.test(d.message)));
});

test('emits diagnostic for # @prompt', () => {
  const text = ['### a', '# @prompt foo', 'GET http://x/'].join('\n');
  const { diagnostics } = parseHttpFile(text);
  assert.ok(diagnostics.some(d => /@prompt/i.test(d.message)));
});
