import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveVariables, createResolver } from './variableResolver.ts';

test('substitutes file vars', () => {
  const out = resolveVariables('GET {{base}}/x', { fileVars: { base: 'http://x' } });
  assert.equal(out.text, 'GET http://x/x');
  assert.deepEqual(out.unresolved, []);
});

test('nested file var references', () => {
  const out = resolveVariables('{{host}}/y', {
    fileVars: { host: '{{protocol}}://example', protocol: 'https' }
  });
  assert.equal(out.text, 'https://example/y');
});

test('unresolved stay intact and are reported', () => {
  const out = resolveVariables('hello {{x}}', { fileVars: {} });
  assert.equal(out.text, 'hello {{x}}');
  assert.deepEqual(out.unresolved, ['x']);
});

test('system vars: $guid, $randomInt min max, $timestamp, $datetime iso8601', () => {
  const out = resolveVariables('{{$guid}}|{{$randomInt 10 11}}|{{$timestamp}}|{{$datetime iso8601}}', { fileVars: {} });
  const parts = out.text.split('|');
  assert.match(parts[0], /[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/);
  assert.equal(Number(parts[1]), 10);
  assert.ok(Number(parts[2]) > 1_600_000_000);
  assert.match(parts[3], /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
});

test('$processEnv reads env var', () => {
  const out = resolveVariables('{{$processEnv MY_TEST_VAR}}', {
    fileVars: {},
    processEnv: { MY_TEST_VAR: 'hello' }
  });
  assert.equal(out.text, 'hello');
});

test('$dotenv reads dotenv value when present', () => {
  const out = resolveVariables('{{$dotenv API_KEY}}', {
    fileVars: {},
    dotenv: { API_KEY: 'sk-1' }
  });
  assert.equal(out.text, 'sk-1');
});

test('$dotenv stays intact + unresolved when key missing', () => {
  const out = resolveVariables('{{$dotenv API_KEY}}', { fileVars: {}, dotenv: {} });
  assert.equal(out.text, '{{$dotenv API_KEY}}');
  assert.deepEqual(out.unresolved, ['$dotenv API_KEY']);
});

test('circular reference guard leaves at least one token intact', () => {
  const out = resolveVariables('{{a}}', { fileVars: { a: '{{b}}', b: '{{a}}' } });
  assert.match(out.text, /\{\{/);
});

test('createResolver pulls @var lines from raw text', () => {
  const { fileVars } = createResolver(
    ['@host = api.example.com', '@port = 8080', '@base = http://{{host}}:{{port}}'].join('\n')
  );
  assert.equal(fileVars.host, 'api.example.com');
  assert.equal(fileVars.port, '8080');
  assert.equal(fileVars.base, 'http://{{host}}:{{port}}');
});
