import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateJsonPath } from './jsonPath.ts';

const data = {
  id: 7,
  name: 'Ada',
  tags: ['admin', 'curator'],
  meta: { createdBy: { id: 'u1' } },
  items: [{ id: 'a' }, { id: 'b' }]
};

test('$.name returns the string', () => {
  assert.deepEqual(evaluateJsonPath(data, '$.name'), { found: true, values: ['Ada'] });
});

test('$.tags[0] returns first item', () => {
  assert.deepEqual(evaluateJsonPath(data, '$.tags[0]'), { found: true, values: ['admin'] });
});

test('$.meta.createdBy.id walks nested props', () => {
  assert.deepEqual(evaluateJsonPath(data, '$.meta.createdBy.id'), { found: true, values: ['u1'] });
});

test('$.items[1].id indexes into array of objects', () => {
  assert.deepEqual(evaluateJsonPath(data, '$.items[1].id'), { found: true, values: ['b'] });
});

test('$..id recursive descent collects all ids', () => {
  const r = evaluateJsonPath(data, '$..id');
  assert.equal(r.found, true);
  assert.deepEqual(new Set(r.values), new Set([7, 'u1', 'a', 'b']));
});

test('missing path returns found:false', () => {
  assert.deepEqual(evaluateJsonPath(data, '$.missing'), { found: false, values: [] });
  assert.deepEqual(evaluateJsonPath(data, '$.tags[9]'), { found: false, values: [] });
});

test('non-object root with $. path fails gracefully', () => {
  assert.equal(evaluateJsonPath('a-string', '$.anything').found, false);
});
