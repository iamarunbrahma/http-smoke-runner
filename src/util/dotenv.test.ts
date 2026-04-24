import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDotenv } from './dotenv.ts';

test('parses KEY=VALUE pairs', () => {
  assert.deepEqual(parseDotenv('A=1\nB=two\nC_3=three'), { A: '1', B: 'two', C_3: 'three' });
});

test('ignores comments and blank lines', () => {
  assert.deepEqual(parseDotenv('# comment\n\nA=1\n# another\nB=2'), { A: '1', B: '2' });
});

test('strips surrounding single and double quotes', () => {
  assert.deepEqual(parseDotenv(`A="one"\nB='two'`), { A: 'one', B: 'two' });
});

test('tolerates surrounding whitespace', () => {
  assert.deepEqual(parseDotenv('  A = 1  '), { A: '1' });
});

test('later definitions override earlier', () => {
  assert.deepEqual(parseDotenv('A=1\nA=2'), { A: '2' });
});
