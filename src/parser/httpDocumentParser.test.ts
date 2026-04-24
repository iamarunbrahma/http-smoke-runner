import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitIntoBlocks } from './httpDocumentParser.ts';

test('splits a file on ### into blocks with line numbers', () => {
  const text = [
    '@baseUrl = http://localhost:3000',
    '',
    '### health',
    'GET {{baseUrl}}/health',
    '',
    '### users',
    'GET {{baseUrl}}/users'
  ].join('\n');

  const blocks = splitIntoBlocks(text);
  assert.equal(blocks.length, 3, 'file-vars block + 2 request blocks');
  assert.equal(blocks[0].startLine, 1);
  assert.equal(blocks[0].endLine, 2);
  assert.equal(blocks[1].startLine, 3);
  assert.equal(blocks[1].endLine, 5);
  assert.equal(blocks[2].startLine, 6);
  assert.equal(blocks[2].endLine, 7);
  assert.ok(blocks[1].text.startsWith('### health'));
});

test('treats 3+ hashes as separator (####, ##### etc.)', () => {
  const text = '### a\nGET http://x\n#### b\nGET http://y';
  const blocks = splitIntoBlocks(text);
  assert.equal(blocks.length, 2);
});

test('handles CRLF line endings', () => {
  const text = '### a\r\nGET http://x\r\n### b\r\nGET http://y';
  const blocks = splitIntoBlocks(text);
  assert.equal(blocks.length, 2);
  assert.match(blocks[0].text, /GET http:\/\/x/);
});

test('empty file returns no blocks', () => {
  assert.deepEqual(splitIntoBlocks(''), []);
});

test('file with only ### separators and no content returns empty blocks', () => {
  const blocks = splitIntoBlocks('###\n###\n');
  assert.equal(blocks.length, 2);
});
